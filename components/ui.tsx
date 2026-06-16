"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";

/* ── Screen header ─────────────────────────────────────────────────────── */
export function ScreenHeader({
  title,
  subtitle,
  badge,
  badgeTone = "neutral",
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: Tone;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[30px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[14px] text-[var(--color-ink-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {badge && (
        <Badge tone={badgeTone} className="mt-1.5 shrink-0">
          {badge}
        </Badge>
      )}
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────────────── */
export function Card({
  children,
  className = "",
  onClick,
  as: As = "div",
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  as?: "div" | "button";
  accent?: string;
}) {
  return (
    <As
      onClick={onClick}
      className={`w-full rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] text-left shadow-[0_1px_2px_rgba(16,27,22,0.04)] ${
        onClick ? "cursor-pointer transition-shadow hover:shadow-[0_4px_16px_rgba(16,27,22,0.08)]" : ""
      } ${className}`}
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      {children}
    </As>
  );
}

/* ── Badge ─────────────────────────────────────────────────────────────── */
export type Tone =
  | "neutral"
  | "win"
  | "warn"
  | "danger"
  | "source"
  | "decode"
  | "rebuild"
  | "publish";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--color-surface-2)", fg: "var(--color-ink-muted)" },
  win: { bg: "var(--color-win-soft)", fg: "var(--color-win)" },
  warn: { bg: "var(--color-warn-soft)", fg: "var(--color-warn)" },
  danger: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  source: { bg: "var(--color-source-soft)", fg: "var(--color-source)" },
  decode: { bg: "var(--color-decode-soft)", fg: "var(--color-decode)" },
  rebuild: { bg: "var(--color-rebuild-soft)", fg: "var(--color-rebuild)" },
  publish: { bg: "var(--color-publish-soft)", fg: "var(--color-publish)" },
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-[11.5px] font-bold ${className}`}
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

/* ── Winner badge (Dominant / Proven / Scaling / Testing) ──────────────── */
export function WinnerBadge({ badge }: { badge?: string | null }) {
  const map: Record<string, Tone> = {
    dominant: "win",
    proven: "source",
    scaling: "warn",
    testing: "neutral",
  };
  const key = (badge || "testing").toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return <Badge tone={map[key] ?? "neutral"}>{label}</Badge>;
}

/* ── Button ────────────────────────────────────────────────────────────── */
export function Button({
  children,
  onClick,
  accent = "var(--color-source)",
  variant = "primary",
  full = true,
  disabled = false,
  icon: Icon,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  accent?: string;
  variant?: "primary" | "outline";
  full?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const style =
    variant === "primary"
      ? { background: accent, color: "#fff" }
      : { background: "transparent", color: accent, border: `1.5px solid ${accent}` };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${full ? "w-full" : ""} active:scale-[0.99]`}
      style={style}
    >
      {Icon && <Icon size={18} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

/* ── Segmented tabs ────────────────────────────────────────────────────── */
export function Tabs({
  tabs,
  active,
  onChange,
  accent = "var(--color-source)",
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  accent?: string;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="shrink-0 rounded-[var(--radius-pill)] border px-4 py-2 text-[13.5px] font-semibold transition-colors"
            style={{
              background: on ? accent : "var(--color-surface)",
              color: on ? "#fff" : "var(--color-ink-muted)",
              borderColor: on ? accent : "var(--color-line)",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Filter pill (dropdown-style) ──────────────────────────────────────── */
export function FilterPill({
  label,
  value,
  onClick,
}: {
  label?: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-ink)]"
    >
      {label && <span className="text-[var(--color-ink-muted)]">{label}:</span>}
      {value}
      <ChevronDown size={13} className="text-[var(--color-ink-muted)]" />
    </button>
  );
}

/* ── Status chip (factory line stations) ───────────────────────────────── */
export type StationStatus =
  | "built"
  | "ready"
  | "review"
  | "running"
  | "complete"
  | "locked";

const STATION: Record<StationStatus, { label: string; tone: Tone }> = {
  built: { label: "Built", tone: "source" },
  ready: { label: "Ready", tone: "win" },
  review: { label: "Needs review", tone: "warn" },
  running: { label: "Running", tone: "decode" },
  complete: { label: "Complete", tone: "win" },
  locked: { label: "Not built", tone: "neutral" },
};

export function StatusChip({ status }: { status: StationStatus }) {
  const s = STATION[status];
  return (
    <Badge tone={s.tone}>
      {status === "running" && (
        <span className="mr-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {s.label}
    </Badge>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

/* ── Section label ─────────────────────────────────────────────────────── */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-6 text-[15px] font-bold tracking-tight">
      {children}
    </h2>
  );
}

/* ── Empty / hint state ────────────────────────────────────────────────── */
export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-12 text-center">
      {Icon && <Icon size={26} className="text-[var(--color-ink-muted)]" />}
      <p className="text-[15px] font-semibold">{title}</p>
      {hint && (
        <p className="max-w-xs text-[13px] text-[var(--color-ink-muted)]">{hint}</p>
      )}
    </div>
  );
}
