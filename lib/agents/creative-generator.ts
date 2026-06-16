/**
 * Creative Generator Agent — Phase 4
 *
 * Reads a candidate's blueprint, selects hook types matched to the page
 * type, calls Claude Haiku once to generate N ad creative variants, and
 * writes `ad_creatives` rows with the `candidate_id` FK set.
 *
 * Generates copy only — image generation is a separate async step.
 * Each creative is written immediately so there are never orphan rows.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type BlueprintRow = {
  page_type: string;
  promise: string;
  trust_device: string;
  conversion_path: string;
  friction_reducers: string[];
};

export type GeneratedCreative = {
  hook_type: string;
  platform: 'meta' | 'tiktok';
  hook_text: string;
  bridge_text: string;
  cta_text: string;
  image_prompt: string;
};

export type CreativeGenerateResult =
  | { ok: true;  count: number; creative_ids: string[] }
  | { ok: false; reason: string };

// ─── Hook type → page type mapping ───────────────────────────────────────────

const HOOK_TYPES_BY_PAGE: Record<string, string[]> = {
  quiz:        ['social_proof_surge', 'curiosity_gap', 'fear_transfer'],
  advertorial: ['authority_reveal',   'newsjacking',    'transformation_before_after'],
  vsl:         ['fear_transfer',      'transformation_before_after', 'identity_challenge'],
  direct:      ['fear_transfer',      'social_proof_surge',          'contrarian'],
  long_form:   ['curiosity_gap',      'silent_epidemic',             'contrarian'],
  unknown:     ['social_proof_surge', 'fear_transfer',               'curiosity_gap'],
};

const HOOK_DESCRIPTIONS: Record<string, string> = {
  social_proof_surge:         'Open with undeniable scale of adoption — a crowd rushing toward the solution creates FOMO and validation. Do NOT mention the product in the hook itself.',
  curiosity_gap:              'Create an information gap the brain must resolve. An incomplete statement that creates irresistible tension. Product resolves it.',
  fear_transfer:              'Activate a specific visceral fear the audience already carries. Transfer it onto a scenario where the product is the intelligent response.',
  authority_reveal:           'Insider knowledge the audience has not heard before. "What doctors don\'t tell you" / "The study they buried." Creates us-vs-them dynamic.',
  newsjacking:                'Open with a real concerning trend or current event. Product is NOT mentioned — it emerges as the intelligent response to an undeniable reality.',
  transformation_before_after:'Lead with a specific quantified transformation. Numbers make it real. Specificity makes it believable. Subject feels exactly like the viewer.',
  identity_challenge:         'Challenge the viewer\'s current identity or behavior. They see themselves as health-conscious — the hook implies they\'re not living up to that.',
  contrarian:                 'Directly contradict a belief the audience holds about their problem. They\'ve been told X — but actually it\'s Y. Makes everything before feel wrong.',
  silent_epidemic:            'Surface a hidden underdiagnosed condition affecting this exact audience. They didn\'t know they had it. Now they can\'t unknow it.',
};

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runCreativeGenerator(
  supabase: SupabaseClient,
  candidateId: string
): Promise<CreativeGenerateResult> {
  // 1. Fetch candidate
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, vertical, page_name, page_url, status')
    .eq('id', candidateId)
    .single();

  if (!candidate) return { ok: false, reason: 'Candidate not found' };

  // 2. Fetch blueprint
  const { data: blueprint } = await supabase
    .from('funnel_blueprints')
    .select('page_type, promise, trust_device, conversion_path, friction_reducers')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!blueprint) return { ok: false, reason: 'No blueprint — run Deconstruct first' };

  // 3. Guard: don't re-generate if creatives already exist
  const { count: existing } = await supabase
    .from('ad_creatives')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', candidateId);

  if ((existing ?? 0) > 0) {
    return { ok: false, reason: `${existing} creatives already exist for this candidate` };
  }

  // 4. Select hook types for this page type
  const pageType = (blueprint as BlueprintRow).page_type ?? 'unknown';
  const hookTypes = HOOK_TYPES_BY_PAGE[pageType] ?? HOOK_TYPES_BY_PAGE.unknown;
  const platforms: Array<'meta' | 'tiktok'> = ['meta', 'tiktok'];

  // 5. Generate all copy in a single Claude call
  let creatives: GeneratedCreative[];
  try {
    creatives = await generateCreatives(candidate.vertical, blueprint as BlueprintRow, hookTypes, platforms);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Claude call failed' };
  }

  // 6. Insert ad_creatives rows — all with candidate_id FK
  const creative_ids: string[] = [];

  for (const c of creatives) {
    const { data: row, error } = await supabase
      .from('ad_creatives')
      .insert({
        candidate_id:  candidateId,
        vertical:      candidate.vertical,
        hook_type:     c.hook_type,
        platform:      c.platform,
        hook_text:     c.hook_text,
        bridge_text:   c.bridge_text,
        cta_text:      c.cta_text,
        image_prompt:  c.image_prompt,
        creative_type: 'composite',
        // image_url is null until image generation runs (Phase 7)
      })
      .select('id')
      .single();

    if (!error && row) creative_ids.push(row.id);
  }

  // 7. Advance status — 'rebuilding' → 'creative'. The orchestrator USED to
  //    do this for us, but per-node Run buttons in FactoryConsole call this
  //    agent directly, so the agent owns the transition.
  await supabase.from('candidates').update({ status: 'creative' }).eq('id', candidateId);

  // 8. Log pipeline event
  await supabase.from('pipeline_events').insert({
    candidate_id: candidateId,
    event_type: 'artifact_written',
    message: `${creative_ids.length} ad creatives generated — ${hookTypes.join(', ')} × ${platforms.join('/')}`,
    payload: { creative_ids, hook_types: hookTypes, platforms },
  });

  return { ok: true, count: creative_ids.length, creative_ids };
}

// ─── Copy generation ──────────────────────────────────────────────────────────

async function generateCreatives(
  vertical: string,
  blueprint: BlueprintRow,
  hookTypes: string[],
  platforms: Array<'meta' | 'tiktok'>,
): Promise<GeneratedCreative[]> {
  const client = new Anthropic();

  const combos = hookTypes.flatMap(h => platforms.map(p => ({ hook: h, platform: p })));

  const prompt = `You are a direct-response ad creative director for health/telehealth verticals.

VERTICAL: ${vertical}
PAGE TYPE: ${blueprint.page_type}
CORE PROMISE: ${blueprint.promise}
TRUST DEVICE: ${blueprint.trust_device}
CONVERSION PATH: ${blueprint.conversion_path}
FRICTION REDUCERS: ${blueprint.friction_reducers?.join(', ') || 'none listed'}

Generate ${combos.length} ad creative variants. Each uses a different hook type and platform combination.
Never use the word "free" — use "Complimentary" or "No-cost".
Do NOT make drug claims or guarantee outcomes.
Write for the first 1.5 seconds of a scroll — hook must stop the thumb.

Return ONLY a JSON array with exactly ${combos.length} objects. No markdown. Each object:
{
  "hook_type": "<hook type key>",
  "platform": "<meta or tiktok>",
  "hook_text": "<opening hook, 1-2 punchy sentences, stops the scroll>",
  "bridge_text": "<connects hook to the offer, 1-2 sentences>",
  "cta_text": "<call to action, 4-7 words, action verb + specific outcome>",
  "image_prompt": "<detailed image generation prompt, no text overlays, photorealistic>"
}

Variants to generate (in order):
${combos.map((c, i) => `${i + 1}. hook_type: "${c.hook}" | platform: "${c.platform}" | instruction: ${HOOK_DESCRIPTIONS[c.hook] ?? c.hook}`).join('\n')}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const clean = text.replace(/```[a-z]*\n?/g, '').trim();

  let parsed: GeneratedCreative[];
  try {
    parsed = JSON.parse(clean);
  } catch {
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not parse creative JSON from Claude');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed)) throw new Error('Claude returned non-array creative response');

  // Ensure FK fields are filled from our combos list (Claude may omit them)
  return parsed.map((c, i) => ({
    hook_type:    c.hook_type   || combos[i]?.hook     || 'unknown',
    platform:     (c.platform === 'tiktok' ? 'tiktok' : 'meta') as 'meta' | 'tiktok',
    hook_text:    c.hook_text   || '',
    bridge_text:  c.bridge_text || '',
    cta_text:     c.cta_text    || 'See If You Qualify →',
    image_prompt: c.image_prompt || '',
  }));
}
