/* Shared URL helpers — one source of truth for "is this a real site link" and
   "reduce it to a clean domain" (used by Source, the scaled grouping, and the
   search route's destination picker). */

/** A clickable site URL only if the value really looks like one (no whitespace). */
export function toSiteUrl(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/\s/.test(t)) return null; // captions / disclaimers contain spaces
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(t)) return "https://" + t;
  return null;
}

export function looksLikeUrl(s: string | null | undefined): boolean {
  return toSiteUrl(s) !== null;
}

/** Reduce a URL/caption to its bare host (no protocol, no www, no path). */
export function toDomain(s: string | null | undefined): string {
  const u = toSiteUrl(s);
  if (!u) return "";
  return u
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");
}
