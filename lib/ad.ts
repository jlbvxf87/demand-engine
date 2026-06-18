/* Ad-text helpers — isomorphic (no server-only imports), used by both the data
   layer and the Source UI.

   Meta returns *boilerplate disclaimer text* in ad_creative_bodies for ads it
   has disabled or that ran without a required disclaimer (e.g. "This ad was run
   by an account or Page we later disabled…"). That text is NOT the creative —
   it's identical across hundreds of unrelated ads, so left unchecked it both
   poses as the real copy on a card and collapses unrelated ads into one fake
   "scaled winner". These helpers strip it. */

const BOILERPLATE_RE: RegExp[] = [
  /we later disabled/i,
  /not following our advertising standards/i,
  /without a required disclaimer/i,
  /this ad ran without/i,
  /this ad was run by an account or page/i,
];

/** True when the body is Meta's disclaimer boilerplate, not real creative copy. */
export function isBoilerplate(body: string | null | undefined): boolean {
  if (!body) return false;
  return BOILERPLATE_RE.some((re) => re.test(body));
}

/** The real creative hook, or null when there's no public creative text. */
export function adHook(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const t = c.trim();
    if (t && !isBoilerplate(t)) return t;
  }
  return null;
}

/** Public Meta Ad Library deep link for a single ad — no token, anyone can view it. */
export function metaAdUrl(metaAdId: string | null | undefined): string | null {
  return metaAdId ? `https://www.facebook.com/ads/library/?id=${metaAdId}` : null;
}
