/**
 * Funnel Deconstruct Agent — Phase 2
 *
 * Fetches spy data for a candidate's page, calls Claude Haiku to extract
 * a structured funnel blueprint, and writes a `funnel_blueprints` row.
 * Also logs a `pipeline_events` entry and advances candidate status to
 * `deconstructing`.
 *
 * Never returns a score or any operator data to the caller.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateIntakeSchema, type IntakeSchema } from '@/lib/intake-schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlueprintData = {
  page_type: 'advertorial' | 'quiz' | 'vsl' | 'direct' | 'long_form' | 'unknown';
  promise: string;
  trust_device: string;
  conversion_path: string;
  friction_reducers: string[];
  risky_claims: string[];
  /** Phase 9: form recipe that mirrors the competitor's capture pattern. */
  intake_pattern?: IntakeSchema | null;
};

export type DeconstructResult =
  | { ok: true;  blueprint: BlueprintData; blueprint_id: string }
  | { ok: false; reason: string };

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runFunnelDeconstruct(
  supabase: SupabaseClient,
  candidateId: string
): Promise<DeconstructResult> {
  // 1. Fetch the candidate
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select('id, vertical, page_url, page_name, status')
    .eq('id', candidateId)
    .single();

  if (candErr || !candidate) return { ok: false, reason: 'Candidate not found' };
  if (!candidate.page_url)  return { ok: false, reason: 'Candidate has no page_url — re-run Detect' };

  // 2. Guard: don't overwrite an existing blueprint
  const { data: existing } = await supabase
    .from('funnel_blueprints')
    .select('id')
    .eq('candidate_id', candidateId)
    .maybeSingle();

  if (existing) return { ok: false, reason: 'Blueprint already exists for this candidate' };

  // 3. Mark as in-progress
  await supabase
    .from('candidates')
    .update({ status: 'deconstructing' })
    .eq('id', candidateId);

  // 4. Fetch spy data for this page
  const domain = extractDomain(candidate.page_url);
  const { data: ads } = await supabase
    .from('spy_ads')
    .select(`
      page_headline, page_product, page_offer, page_cta,
      page_pricing, page_ai_summary, intelligence_json,
      ad_body, ad_title, winner_score
    `)
    .ilike('destination_url', `%${domain}%`)
    .order('winner_score', { ascending: false })
    .limit(6);

  // 5. Build context string from spy data
  const context = buildContext({
    vertical: candidate.vertical,
    page_url: candidate.page_url,
    page_name: candidate.page_name,
    ads: ads ?? [],
  });

  // 6. Call Claude Haiku to extract the blueprint
  let blueprint: BlueprintData;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2400, // bumped for intake_pattern (can include 20+ step quizzes)
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    blueprint = parseBlueprint(text);
  } catch (err) {
    // Roll back status on error
    await supabase.from('candidates').update({ status: 'scored' }).eq('id', candidateId);
    return { ok: false, reason: err instanceof Error ? err.message : 'Claude call failed' };
  }

  // 7. Insert blueprint row (intake_pattern only included if it validated cleanly)
  const { data: bpRow, error: insertErr } = await supabase
    .from('funnel_blueprints')
    .insert({
      candidate_id: candidateId,
      page_type: blueprint.page_type,
      promise: blueprint.promise,
      trust_device: blueprint.trust_device,
      conversion_path: blueprint.conversion_path,
      friction_reducers: blueprint.friction_reducers,
      risky_claims: blueprint.risky_claims,
      intake_pattern: blueprint.intake_pattern ?? null,
      raw_json: { domain, ad_count: (ads ?? []).length },
    })
    .select('id')
    .single();

  if (insertErr || !bpRow) {
    await supabase.from('candidates').update({ status: 'scored' }).eq('id', candidateId);
    return { ok: false, reason: insertErr?.message ?? 'Blueprint insert failed' };
  }

  // 8. Log pipeline event
  await supabase.from('pipeline_events').insert({
    candidate_id: candidateId,
    event_type: 'artifact_written',
    message: `Blueprint extracted — ${blueprint.page_type}: "${blueprint.promise.slice(0, 80)}"`,
    payload: { blueprint_id: bpRow.id, page_type: blueprint.page_type },
  });

  return { ok: true, blueprint, blueprint_id: bpRow.id };
}

// ─── Context builder ─────────────────────────────────────────────────────────

function buildContext(opts: {
  vertical: string;
  page_url: string;
  page_name: string | null;
  ads: Record<string, unknown>[];
}): string {
  const lines: string[] = [
    `VERTICAL: ${opts.vertical}`,
    `PAGE: ${opts.page_name ?? opts.page_url}`,
    `URL: ${opts.page_url}`,
    '',
  ];

  for (const ad of opts.ads) {
    if (ad.page_headline) lines.push(`HEADLINE: ${ad.page_headline}`);
    if (ad.page_product)  lines.push(`PRODUCT: ${ad.page_product}`);
    if (ad.page_offer)    lines.push(`OFFER: ${ad.page_offer}`);
    if (ad.page_cta)      lines.push(`CTA: ${ad.page_cta}`);
    if (ad.page_pricing)  lines.push(`PRICING: ${ad.page_pricing}`);
    if (ad.page_ai_summary) lines.push(`PAGE SUMMARY: ${ad.page_ai_summary}`);
    if (ad.ad_title)      lines.push(`AD TITLE: ${ad.ad_title}`);
    if (ad.ad_body)       lines.push(`AD BODY: ${String(ad.ad_body).slice(0, 300)}`);

    const intel = ad.intelligence_json as Record<string, unknown> | null;
    if (intel) {
      if (intel.funnel_type)   lines.push(`FUNNEL TYPE: ${intel.funnel_type}`);
      if (intel.offer_type)    lines.push(`OFFER TYPE: ${intel.offer_type}`);
      if (intel.hook_type)     lines.push(`HOOK: ${intel.hook_type}`);
      if (intel.trust_signals) lines.push(`TRUST SIGNALS: ${JSON.stringify(intel.trust_signals)}`);
      if (intel.compliance_flags) lines.push(`COMPLIANCE FLAGS: ${JSON.stringify(intel.compliance_flags)}`);
      if (intel.urgency_mechanism) lines.push(`URGENCY: ${intel.urgency_mechanism}`);
      if (intel.cta_pattern)   lines.push(`CTA PATTERN: ${intel.cta_pattern}`);
    }
    lines.push('---');
  }

  return lines.join('\n');
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a conversion funnel analyst. Analyze competitor funnel data and extract a structured blueprint AND a form recipe (intake_pattern) that mirrors how the competitor captures leads.

Respond ONLY with a JSON object. No markdown fences. No explanation. No extra text. Just the JSON.

Required format:
{
  "page_type": "advertorial|quiz|vsl|direct|long_form|unknown",
  "promise": "The core value proposition in one clear sentence",
  "trust_device": "Primary trust-building mechanism on the page",
  "conversion_path": "How the funnel converts (e.g., Quiz → Email → VSL → CTA)",
  "friction_reducers": ["objection handler found", "another handler"],
  "risky_claims": ["any compliance risk or unsubstantiated claim found"],
  "intake_pattern": {
    "steps": [
      {
        "id": "stable_snake_case_id",
        "type": "single_choice | multi_choice | text | textarea | email | phone | number | date | scale",
        "question": "The prompt shown to the visitor",
        "description": "Optional subtext under the question",
        "options": ["A", "B", "C"],
        "placeholder": "for text/number/email",
        "required": true,
        "min": 18, "max": 80,
        "unit": "lbs",
        "skip_if": { "question_id": "prior_q_id", "equals": "value" }
      }
    ],
    "capture": {
      "email_step": "first | last | <step-index>",
      "phone_required": false
    },
    "end": { "kind": "submit | calendar_book | redirect", "message": "..." },
    "progress": { "show": true, "style": "bar" }
  }
}

Rules for the blueprint:
- page_type must be exactly one of the enum values
- promise must be one sentence, under 120 characters
- friction_reducers: list ONLY ones you have evidence for, empty array if none
- risky_claims: be conservative — only flag clear compliance issues

Rules for the intake_pattern (CRITICAL — this is the form your output will build):
- Mirror the COMPETITOR'S form structure as closely as possible: same step count, same question types, same flow
- Inspect the page summary, CTA pattern, and funnel_type cues to infer how many steps the form has, what types, and where email is captured
- If the competitor uses a long quiz (10-30 questions), include all of them — don't truncate. Real quizzes have lots of qualifying questions.
- Write fresh question copy in clear consumer language — do NOT copy competitor wording verbatim
- options[] is required for single_choice and multi_choice; omit otherwise
- skip_if is optional; only include when an answer should branch
- email_step: 'first' for cold-traffic email-up-front gates, 'last' for warm-traffic close-then-capture, or a numeric step index for mid-quiz gates
- end.kind: 'submit' is default; 'calendar_book' only when the competitor ends with a calendar; 'redirect' rarely
- If data is genuinely too sparse to infer a real form, use { "steps": [{ "id": "email", "type": "email", "question": "Where should we send your results?", "required": true }], "capture": { "email_step": "first" }, "end": { "kind": "submit" } }

If data is sparse, make best-effort inferences. Do NOT omit intake_pattern — always return one, even if minimal.`;

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseBlueprint(text: string): BlueprintData {
  const VALID_TYPES = ['advertorial', 'quiz', 'vsl', 'direct', 'long_form', 'unknown'] as const;
  type PageType = typeof VALID_TYPES[number];

  // Strip any accidental markdown fences
  const clean = text.replace(/```[a-z]*\n?/g, '').trim();

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Try to extract JSON from anywhere in the string
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* fall through to defaults */ }
    }
  }

  const rawType = String(parsed.page_type ?? '').toLowerCase() as PageType;
  const page_type: PageType = VALID_TYPES.includes(rawType) ? rawType : 'unknown';

  // Validate intake_pattern — only save it if it passes the schema check.
  // Bad/missing intake_pattern just leaves the field null and the renderer
  // falls back to DEFAULT_INTAKE_SCHEMA.
  let intake_pattern: IntakeSchema | null = null;
  if (parsed.intake_pattern && typeof parsed.intake_pattern === 'object') {
    // Stamp provenance metadata before validating
    const candidate = parsed.intake_pattern as Record<string, unknown>;
    candidate.meta = {
      ...((candidate.meta as Record<string, unknown> | undefined) ?? {}),
      inferred_at: new Date().toISOString(),
    };
    const v = validateIntakeSchema(candidate);
    if (v.ok && v.schema) intake_pattern = v.schema;
  }

  return {
    page_type,
    intake_pattern,
    promise:          String(parsed.promise          ?? 'Value proposition not detected').slice(0, 200),
    trust_device:     String(parsed.trust_device     ?? 'Not detected').slice(0, 200),
    conversion_path:  String(parsed.conversion_path  ?? 'Not detected').slice(0, 300),
    friction_reducers: Array.isArray(parsed.friction_reducers)
      ? (parsed.friction_reducers as unknown[]).map(String).slice(0, 8)
      : [],
    risky_claims: Array.isArray(parsed.risky_claims)
      ? (parsed.risky_claims as unknown[]).map(String).slice(0, 8)
      : [],
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    // If URL parsing fails, strip protocol manually
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}
