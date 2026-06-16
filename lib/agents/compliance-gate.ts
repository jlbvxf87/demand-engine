/**
 * Compliance Gate Agent — Phase 5
 *
 * Fetches the candidate's landing_variant page_config and all ad_creatives,
 * extracts text from each, runs the deterministic scanCompliance() checker,
 * and writes `compliance_checks` rows (one per artifact).
 *
 * Verdict mapping:
 *   green  — zero violations
 *   yellow — flag-only violations (review recommended, does not block)
 *   red    — any block-severity violation (candidate cannot advance)
 *
 * If any check is red → candidate.status = 'blocked'
 * If all checks green/yellow → candidate.status = 'compliance' (ready to advance)
 *
 * Idempotent: calling twice on the same candidate replaces existing checks.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { scanCompliance, type Vertical } from './compliance';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckRow = {
  artifact_type: 'page' | 'creative';
  artifact_id: string;
  artifact_label: string;
  verdict: 'green' | 'yellow' | 'red';
  violations: Array<{ rule: string; match: string; severity: string; context?: string }>;
};

export type ComplianceGateResult =
  | { ok: true;  passed: boolean; blocked: boolean; checks: CheckRow[] }
  | { ok: false; reason: string };

// ─── Vertical normaliser ──────────────────────────────────────────────────────

function detectVertical(raw: string): Vertical | null {
  const v = raw.toLowerCase();
  if (/glp|weight|semaglutide|ozempic|tirzepatide/.test(v)) return 'glp1';
  if (/trt|testosterone/.test(v)) return 'trt';
  if (/peptide|bpc|sermorelin|tb-?500|cjc/.test(v)) return 'peptides';
  if (/joint|cortisone|ortho|knee|cartilage/.test(v)) return 'joint_pain';
  return null;
}

// ─── Text extractors ──────────────────────────────────────────────────────────

/** Pull all string values from a page_config's copyProps recursively. */
function extractPageText(pageConfig: Record<string, unknown>): { body: string; headlines: string[] } {
  const strings: string[] = [];
  const headlines: string[] = [];

  function walk(obj: unknown) {
    if (typeof obj === 'string') {
      strings.push(obj);
      return;
    }
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    if (obj && typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
        if (key === 'headline' || key === 'advertorial_headline' || key === 'h1') {
          if (typeof val === 'string') headlines.push(val);
        }
        walk(val);
      }
    }
  }

  walk(pageConfig);
  return { body: strings.join(' '), headlines };
}

function extractCreativeText(c: {
  hook_text: string | null;
  bridge_text: string | null;
  cta_text: string | null;
}): string {
  return [c.hook_text, c.bridge_text, c.cta_text].filter(Boolean).join(' ');
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

function toVerdict(violations: Array<{ severity: string }>): 'green' | 'yellow' | 'red' {
  if (violations.length === 0) return 'green';
  if (violations.some(v => v.severity === 'block')) return 'red';
  return 'yellow';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runComplianceGate(
  supabase: SupabaseClient,
  candidateId: string
): Promise<ComplianceGateResult> {
  // 1. Fetch candidate
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, vertical, status')
    .eq('id', candidateId)
    .single();

  if (!candidate) return { ok: false, reason: 'Candidate not found' };

  const vertical = detectVertical(candidate.vertical ?? '');

  // 2. Fetch artifacts
  const [variantRes, creativesRes] = await Promise.all([
    supabase
      .from('landing_variants')
      .select('id, name, page_config')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ad_creatives')
      .select('id, hook_type, platform, hook_text, bridge_text, cta_text')
      .eq('candidate_id', candidateId),
  ]);

  const variant  = variantRes.data;
  const creatives = creativesRes.data ?? [];

  if (!variant && creatives.length === 0) {
    return { ok: false, reason: 'No page variant or creatives found — run Rebuild + Creative first' };
  }

  // 3. Delete stale checks for idempotency
  await supabase.from('compliance_checks').delete().eq('candidate_id', candidateId);

  // 4. Run checks
  const checks: CheckRow[] = [];

  // Page check
  if (variant?.page_config) {
    const { body, headlines } = extractPageText(variant.page_config as Record<string, unknown>);
    const result = scanCompliance(body, vertical, headlines);
    checks.push({
      artifact_type: 'page',
      artifact_id: variant.id,
      artifact_label: variant.name ?? 'Landing Page',
      verdict: toVerdict(result.violations),
      violations: result.violations,
    });
  }

  // Creative checks
  for (const c of creatives) {
    const text = extractCreativeText(c as { hook_text: string | null; bridge_text: string | null; cta_text: string | null });
    const result = scanCompliance(text, vertical);
    checks.push({
      artifact_type: 'creative',
      artifact_id: c.id,
      artifact_label: `${(c.platform ?? 'meta').toUpperCase()} — ${(c.hook_type ?? 'unknown').replace(/_/g, ' ')}`,
      verdict: toVerdict(result.violations),
      violations: result.violations,
    });
  }

  // 5. Write compliance_checks rows
  for (const check of checks) {
    await supabase.from('compliance_checks').insert({
      candidate_id:  candidateId,
      artifact_type: check.artifact_type,
      artifact_id:   check.artifact_id,
      verdict:       check.verdict,
      violations:    check.violations,
      checked_at:    new Date().toISOString(),
    });
  }

  // 6. Advance or block candidate
  const blocked = checks.some(c => c.verdict === 'red');
  const newStatus = blocked ? 'blocked' : 'compliance';

  await supabase.from('candidates').update({ status: newStatus }).eq('id', candidateId);

  // 7. Log pipeline event
  const redCount    = checks.filter(c => c.verdict === 'red').length;
  const yellowCount = checks.filter(c => c.verdict === 'yellow').length;
  const greenCount  = checks.filter(c => c.verdict === 'green').length;

  await supabase.from('pipeline_events').insert({
    candidate_id: candidateId,
    event_type: blocked ? 'error' : 'status_change',
    message: blocked
      ? `Compliance BLOCKED — ${redCount} red artifact${redCount !== 1 ? 's' : ''}`
      : `Compliance passed — ${greenCount} green, ${yellowCount} yellow, ${redCount} red`,
    payload: { checks: checks.map(c => ({ artifact_id: c.artifact_id, verdict: c.verdict, violation_count: c.violations.length })) },
  });

  return { ok: true, passed: !blocked, blocked, checks };
}
