/**
 * Force a Supabase Storage URL to download instead of open in-tab. A cross-origin
 * `<a download>` attribute is ignored by browsers, but Supabase honors a
 * `?download=<filename>` query param by setting `Content-Disposition: attachment`.
 */
export function withDownload(url: string, filename?: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return filename ? `${url}${sep}download=${encodeURIComponent(filename)}` : `${url}${sep}download`;
}
