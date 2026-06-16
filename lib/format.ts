export function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

export function money(lower: number | null, upper: number | null): string {
  if (lower == null && upper == null) return "—";
  const mid = ((lower ?? 0) + (upper ?? 0)) / 2;
  return "$" + compact(mid);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/);
  return (parts[0]?.[0] || "?").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

const VERTICAL_LABEL: Record<string, string> = {
  glp1: "GLP-1",
  trt: "TRT",
  peptides: "Peptides",
  joint_pain: "Joint Pain",
};
export function verticalLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return VERTICAL_LABEL[v] || v;
}
