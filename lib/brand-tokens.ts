/**
 * Per-brand design tokens. Each brand has a refined identity inspired by
 * a category benchmark but distinct. Used by app/[brand]/page.tsx and the
 * shared zone components.
 *
 * Reference benchmarks (NOT copying — drawing from):
 *   glp1guide      → editorial / scientific authority (NEJM-meets-NYT)
 *   qualifyforglp1 → Claya-style direct conversion (navy + display serif)
 *   weightreset    → SHED sage + warm portrait blocks
 *   peptideguide   → clean clinical, deep botanical green
 *   jointrestore   → editorial "before-your-shot" warning, bronze
 */

export type BrandTokens = {
  /** Page background — usually a soft off-white, never #FFFFFF flat. */
  bg: string;
  /** Card / surface bg — slightly different from `bg` for depth. */
  surface: string;
  /** Primary text. */
  text: string;
  /** Muted text (sub-headlines, meta). */
  textMuted: string;
  /** Accent — used on CTA, key numbers, brand details. */
  accent: string;
  /** Text on accent (usually white or near-white for contrast). */
  accentText: string;
  /** Heading accent — used for the highlighted phrase inside the headline. */
  headingAccent: string;
  /** Soft accent surface — for benefit bars, badges, micro-callouts. */
  softAccent: string;
  /** Display headline style hint. */
  display: 'serif-bold' | 'serif-italic-mixed';
  /** Audience size shown in member-count line. */
  memberCount: string;
  /** Audience label shown after member count. */
  memberLabel: string;
  /** Star rating shown in trust block. */
  rating: string;
  /** Number of reviews shown in trust block. */
  reviewCount: string;
};

export const BRAND_TOKENS: Record<string, BrandTokens> = {
  glp1guide: {
    bg: '#F7F4EF',
    surface: '#FFFFFF',
    text: '#0F1F33',
    textMuted: '#475569',
    accent: '#0F1F33',
    accentText: '#FFFFFF',
    headingAccent: '#0E8C7B',
    softAccent: '#E8F1EE',
    display: 'serif-italic-mixed',
    memberCount: '12,400+',
    memberLabel: 'patients matched in 2026',
    rating: '4.8',
    reviewCount: '2,400+',
  },
  qualifyforglp1: {
    bg: '#F0F4F9',
    surface: '#FFFFFF',
    text: '#0B1736',
    textMuted: '#475569',
    accent: '#0B1736',
    accentText: '#FFFFFF',
    headingAccent: '#1F4FFF',
    softAccent: '#E5EDFB',
    display: 'serif-italic-mixed',
    memberCount: '12,400+',
    memberLabel: 'patients qualified',
    rating: '4.8',
    reviewCount: '5,400+',
  },
  weightreset: {
    bg: '#EDEFE9',
    surface: '#FFFFFF',
    text: '#1F2A1A',
    textMuted: '#5C6655',
    accent: '#5C7C4D',
    accentText: '#FFFFFF',
    headingAccent: '#9C7A4A',
    softAccent: '#E2DFD2',
    display: 'serif-bold',
    memberCount: '12,400+',
    memberLabel: 'members nationwide',
    rating: '4.9',
    reviewCount: '3,100+',
  },
  peptideguide: {
    bg: '#F2F4F1',
    surface: '#FFFFFF',
    text: '#0E2A2A',
    textMuted: '#4A5C5C',
    accent: '#114F46',
    accentText: '#FFFFFF',
    headingAccent: '#0E8C7B',
    softAccent: '#DCEBE7',
    display: 'serif-bold',
    memberCount: '8,200+',
    memberLabel: 'matched with a licensed provider',
    rating: '4.7',
    reviewCount: '1,200+',
  },
  jointrestore: {
    bg: '#F8F4EE',
    surface: '#FFFFFF',
    text: '#1D2240',
    textMuted: '#4D5772',
    accent: '#1D2240',
    accentText: '#FFFFFF',
    headingAccent: '#B5562B',
    softAccent: '#F0E0D2',
    display: 'serif-italic-mixed',
    memberCount: '6,800+',
    memberLabel: 'questions reviewed before any procedure',
    rating: '4.7',
    reviewCount: '900+',
  },
};

/** Default fallback tokens — used if a brand slug isn't in the map. */
export const DEFAULT_TOKENS: BrandTokens = {
  bg: '#F7F4EF',
  surface: '#FFFFFF',
  text: '#0F1F33',
  textMuted: '#475569',
  accent: '#0F1F33',
  accentText: '#FFFFFF',
  headingAccent: '#0E8C7B',
  softAccent: '#E8F1EE',
  display: 'serif-bold',
  memberCount: '10,000+',
  memberLabel: 'patients served',
  rating: '4.8',
  reviewCount: '1,000+',
};

export function getBrandTokens(slug: string): BrandTokens {
  return BRAND_TOKENS[slug] ?? DEFAULT_TOKENS;
}
