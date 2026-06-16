/**
 * Deterministic compliance scanner for Demand Engine content.
 *
 * Regex-based — no AI, no cost, runs synchronously.
 * Catches the violations that LLM prompts miss probabilistically.
 *
 * Severity:
 *   block — hard violation, article should not go live without fix
 *   flag  — soft violation, reviewer should check but not auto-block
 */

export type Severity = 'block' | 'flag';

export type ComplianceViolation = {
  rule: string;
  match: string;
  severity: Severity;
  context?: string; // surrounding text snippet for reviewer
};

export type ComplianceResult = {
  passed: boolean; // true = no block-severity violations
  violations: ComplianceViolation[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snippet(text: string, index: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function check(
  text: string,
  pattern: RegExp,
  rule: string,
  severity: Severity,
  violations: ComplianceViolation[]
): void {
  const lower = text;
  let match: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  while ((match = re.exec(lower)) !== null) {
    violations.push({
      rule,
      match: match[0],
      severity,
      context: snippet(lower, match.index),
    });
    // Prevent infinite loop on zero-width matches
    if (match.index === re.lastIndex) re.lastIndex++;
  }
}

// ─── Rule sets ────────────────────────────────────────────────────────────────

const UNIVERSAL_BLOCK: Array<{ pattern: RegExp; rule: string }> = [
  // The word "free" used as an adjective/adverb (not "freely", "freedom")
  { pattern: /\bfree\b(?!\s*(ly|dom|lance|way|style|hold|range|dom))/i, rule: 'Word "free" — use "complimentary" or "no-cost"' },

  // Guaranteed outcome language
  { pattern: /\bguarantee[sd]?\b/i, rule: 'Guaranteed results claim' },
  { pattern: /\byou (will|can) (definitely|certainly) (lose|gain|heal|cure|fix|reverse)/i, rule: 'Implied guaranteed outcome' },

  // Direct therapeutic claims
  { pattern: /\b(cures?|cured|curative)\b/i, rule: 'Cure claim — use "may support" or "research suggests"' },
  { pattern: /\bthis (will|can) (heal|fix|cure|reverse|eliminate)\b/i, rule: 'Absolute therapeutic claim' },

  // Banned CTAs
  { pattern: /\bget started\b/i, rule: 'Banned CTA: "Get Started"' },
  { pattern: /\bsign up\b/i, rule: 'Banned CTA: "Sign Up"' },
  { pattern: /\blearn more\b/i, rule: 'Banned CTA: "Learn More"' },
  { pattern: /\bclick here\b/i, rule: 'Banned CTA: "Click Here"' },
  { pattern: /\bsubscribe\b/i, rule: 'Banned CTA: "Subscribe"' },

  // Vague stats — numbers required
  { pattern: /\bthousands of (people|patients|users|men|women)\b/i, rule: 'Vague stat — use a specific number' },
  { pattern: /\bmillions of (people|patients|users|men|women)\b/i, rule: 'Vague stat — use a specific number' },
];

const UNIVERSAL_FLAG: Array<{ pattern: RegExp; rule: string }> = [
  // Implied equivalence to prescription drugs without caveat
  { pattern: /\balternative to (ozempic|wegovy|mounjaro|semaglutide|tirzepatide)\b/i, rule: 'Implied drug equivalence — add clinical caveat' },
  { pattern: /\bjust like (ozempic|wegovy|mounjaro)\b/i, rule: 'Implied drug equivalence' },

  // Discount / pricing language
  { pattern: /\d+\s*%\s*off\b/i, rule: 'Discount percentage — may violate pricing rules' },
  { pattern: /lowest price\b/i, rule: 'Price superlative claim' },
  { pattern: /cheapest\b/i, rule: 'Price superlative claim' },

  // FDA framing
  { pattern: /\bfda[- ]approved\b/i, rule: 'FDA-approved claim — verify approval status' },
  { pattern: /\bfda[- ]cleared\b/i, rule: 'FDA-cleared claim — verify clearance status' },

  // Medical professional equivalence
  { pattern: /\bjust like (seeing|visiting) (a |your )?(doctor|physician|specialist)\b/i, rule: 'Medical equivalence claim' },

  // "Submit" CTA
  { pattern: /\bsubmit\b/i, rule: 'Banned CTA candidate: "Submit" — use action-oriented label' },
];

const PEPTIDE_BLOCK: Array<{ pattern: RegExp; rule: string }> = [
  { pattern: /\b(heals?|healing|healed)\b/i, rule: 'Peptides: "heal" claim — use "support"' },
  { pattern: /\btreats?\s+(injury|injuries|condition|pain|wound)\b/i, rule: 'Peptides: therapeutic "treat" claim' },
  { pattern: /\brestores?\s+(tissue|muscle|joint|cartilage|tendon)\b/i, rule: 'Peptides: "restore" claim — use "support"' },
  { pattern: /\bbuilds?\s+muscle\b/i, rule: 'Peptides: "build muscle" claim — use "support muscle recovery"' },
  { pattern: /\bcure(s|d)?\b/i, rule: 'Peptides: cure claim' },
];

const PEPTIDE_FLAG: Array<{ pattern: RegExp; rule: string }> = [
  { pattern: /\btherapeutic (dose|effect|benefit)\b/i, rule: 'Peptides: "therapeutic" framing — use "research peptide"' },
  { pattern: /\bpeptide (therapy|treatment)\b/i, rule: 'Peptides: use "peptide protocol" not "therapy/treatment"' },
];

const JOINT_PAIN_BLOCK: Array<{ pattern: RegExp; rule: string }> = [
  { pattern: /\balternative to (cortisone|surgery|joint replacement|knee replacement)\b/i, rule: 'Joint pain: implied medical equivalence — use "second opinion" framing' },
  { pattern: /\beliminate (your |the )?(pain|discomfort)\b/i, rule: 'Joint pain: guaranteed pain elimination claim' },
  { pattern: /\bno more (pain|surgery|shots)\b/i, rule: 'Joint pain: absolute outcome claim' },
];

const GLP1_BLOCK: Array<{ pattern: RegExp; rule: string }> = [
  { pattern: /\byou will lose\s+\d+/i, rule: 'GLP-1: guaranteed weight loss number — use trial data with attribution' },
  { pattern: /\blose\s+\d+\s*(lbs?|pounds?|kg)\s+(guaranteed|for sure|definitely)\b/i, rule: 'GLP-1: guaranteed weight loss' },
];

const GLP1_FLAG: Array<{ pattern: RegExp; rule: string }> = [
  { pattern: /\bOzempic\b/i, rule: 'GLP-1: brand name "Ozempic" — ensure context is editorial not promotional' },
  { pattern: /\bweight loss (drug|shot|injection) your doctor\b/i, rule: 'GLP-1: verify this framing clears your compliance review' },
];

const TRT_FLAG: Array<{ pattern: RegExp; rule: string }> = [
  { pattern: /\braise your testosterone to\b/i, rule: 'TRT: implied guaranteed lab result' },
  { pattern: /\bproven to increase testosterone\b(?!.*trial|.*study|.*research)/i, rule: 'TRT: unattributed "proven" claim — cite the study' },
];

// ─── Headline length check ────────────────────────────────────────────────────

function checkHeadlineLength(headlines: string[], violations: ComplianceViolation[]): void {
  for (const h of headlines) {
    const wordCount = h.trim().split(/\s+/).length;
    if (wordCount > 10) {
      violations.push({
        rule: 'Headline exceeds 10 words',
        match: h,
        severity: 'flag',
        context: `${wordCount} words`,
      });
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type Vertical = 'glp1' | 'trt' | 'peptides' | 'joint_pain';

export function scanCompliance(
  content: string,
  vertical?: Vertical | string | null,
  headlines: string[] = []
): ComplianceResult {
  const violations: ComplianceViolation[] = [];
  const lower = content.toLowerCase();

  // Universal
  for (const { pattern, rule } of UNIVERSAL_BLOCK) check(lower, pattern, rule, 'block', violations);
  for (const { pattern, rule } of UNIVERSAL_FLAG)  check(lower, pattern, rule, 'flag',  violations);

  // Vertical-specific
  if (vertical === 'peptides') {
    for (const { pattern, rule } of PEPTIDE_BLOCK) check(lower, pattern, rule, 'block', violations);
    for (const { pattern, rule } of PEPTIDE_FLAG)  check(lower, pattern, rule, 'flag',  violations);
  }
  if (vertical === 'joint_pain') {
    for (const { pattern, rule } of JOINT_PAIN_BLOCK) check(lower, pattern, rule, 'block', violations);
  }
  if (vertical === 'glp1') {
    for (const { pattern, rule } of GLP1_BLOCK) check(lower, pattern, rule, 'block', violations);
    for (const { pattern, rule } of GLP1_FLAG)  check(lower, pattern, rule, 'flag',  violations);
  }
  if (vertical === 'trt') {
    for (const { pattern, rule } of TRT_FLAG) check(lower, pattern, rule, 'flag', violations);
  }

  // Headline length
  if (headlines.length > 0) checkHeadlineLength(headlines, violations);

  // Deduplicate by rule + match
  const seen = new Set<string>();
  const unique = violations.filter(v => {
    const key = `${v.rule}::${v.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    passed: unique.every(v => v.severity !== 'block'),
    violations: unique,
  };
}
