"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, ExternalLink, Loader2, CornerDownRight } from "lucide-react";
import {
  ScreenHeader,
  Card,
  WinnerBadge,
  Tabs,
  EmptyState,
  Modal,
  Stat,
} from "@/components/ui";
import AdThumb from "@/components/AdThumb";
import { compact, money, verticalLabel } from "@/lib/format";
import { searchAds } from "@/app/actions";
import type { Advertiser, AdRow, IdentityRollup } from "@/lib/data";

const ACCENT = "var(--color-source)";

const COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "BR", label: "Brazil" },
  { value: "IN", label: "India" },
  { value: "MX", label: "Mexico" },
];

/** Public Meta Ad Library page for an ad (no token, viewable by anyone). */
function metaAdUrl(metaAdId: string | null) {
  return metaAdId ? `https://www.facebook.com/ads/library/?id=${metaAdId}` : null;
}

/** Return a clickable site URL only if the value actually looks like one. */
function siteUrl(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/\s/.test(t)) return null; // captions/disclaimers contain spaces
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(t)) return "https://" + t;
  return null;
}

/** Pill-styled native dropdown for the advanced filter bar. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-semibold">
      <span className="text-[var(--color-ink-muted)]">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-bold text-[var(--color-ink)] outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SourceClient({
  advertisers,
  creatives,
  identity,
  verticals,
}: {
  advertisers: Advertiser[];
  creatives: AdRow[];
  identity: IdentityRollup[];
  verticals: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("advertisers");
  const [vertical, setVertical] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("US");
  const [status, setStatus] = useState<"ACTIVE" | "ALL" | "INACTIVE">("ACTIVE");
  const [media, setMedia] = useState<"ALL" | "VIDEO" | "IMAGE">("ALL");
  const [windowDays, setWindowDays] = useState(0); // 0 = any time
  const [platform, setPlatform] = useState(""); // "" = all platforms
  const [selected, setSelected] = useState<{ id: string; name: string; sub: string } | null>(null);
  const [detail, setDetail] = useState<AdRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const vFilter = (v: string | null) => vertical === "all" || v === vertical;

  const adv = useMemo(() => advertisers.filter((a) => vFilter(a.vertical)), [advertisers, vertical]);
  const crv = useMemo(() => creatives.filter((a) => vFilter(a.vertical)), [creatives, vertical]);
  const byId = useMemo(() => new Map(creatives.map((c) => [c.id, c])), [creatives]);

  /** Open the rich ad viewer when we have the full row; else fall back to select. */
  function openAd(id: string | null, name: string, sub: string) {
    const row = id ? byId.get(id) : undefined;
    if (row) setDetail(row);
    else setSelected({ id: id || "", name, sub });
  }

  function runSearch() {
    if (!query.trim()) return;
    setNote(null);
    startTransition(async () => {
      const r = await searchAds(query.trim(), { country, status, media, windowDays, platform });
      if (!r.ok) setNote(r.error || "Search failed");
      else router.refresh();
    });
  }

  function toDecode(id: string) {
    router.push(`/decode?ad=${id}`);
  }

  return (
    <div>
      <ScreenHeader
        title="Source"
        subtitle="Find winning ads from the Meta Ad Library."
        badge="live"
        badgeTone="source"
      />

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-3">
        <Search size={18} className="text-[var(--color-ink-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Search brand, page, doctor, hook…"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--color-ink-muted)]"
        />
        <button
          onClick={runSearch}
          disabled={pending || !query.trim()}
          className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[13px] font-bold text-white disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : "Search"}
        </button>
      </div>
      {note && (
        <p className="mb-3 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
          {note}
        </p>
      )}

      {/* Advanced filters — drive the Meta search */}
      <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
        <FilterSelect label="Country" value={country} onChange={setCountry} options={COUNTRIES} />
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as "ACTIVE" | "ALL" | "INACTIVE")}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "ALL", label: "All" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
        <FilterSelect
          label="Media"
          value={media}
          onChange={(v) => setMedia(v as "ALL" | "VIDEO" | "IMAGE")}
          options={[
            { value: "ALL", label: "All" },
            { value: "VIDEO", label: "Video" },
            { value: "IMAGE", label: "Image" },
          ]}
        />
        <FilterSelect
          label="Window"
          value={String(windowDays)}
          onChange={(v) => setWindowDays(Number(v))}
          options={[
            { value: "0", label: "Any time" },
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
        <FilterSelect
          label="Platform"
          value={platform}
          onChange={setPlatform}
          options={[
            { value: "", label: "All" },
            { value: "facebook", label: "Facebook" },
            { value: "instagram", label: "Instagram" },
          ]}
        />
        <FilterSelect
          label="Vertical"
          value={vertical}
          onChange={setVertical}
          options={[
            { value: "all", label: "All" },
            ...verticals.map((v) => ({ value: v, label: verticalLabel(v) })),
          ]}
        />
      </div>
      <p className="mb-4 px-1 text-[11px] text-[var(--color-ink-muted)]">
        Set filters, then Search. Vertical filters the results shown.
      </p>

      {/* Tabs */}
      <div className="mb-4">
        <Tabs
          accent={ACCENT}
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "advertisers", label: `Advertisers${adv.length ? ` · ${adv.length}` : ""}` },
            { id: "creatives", label: `Creatives${crv.length ? ` · ${crv.length}` : ""}` },
            { id: "identity", label: `Identity${identity.length ? ` · ${identity.length}` : ""}` },
          ]}
        />
      </div>

      {/* ── Advertisers ─────────────────────────────────────────────────── */}
      {tab === "advertisers" &&
        (adv.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No advertisers yet"
            hint="Run a search above to pull winners from the Meta Ad Library."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[var(--color-line)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
              <span>Advertiser</span>
              <span className="text-right">Active</span>
              <span className="text-right">Winner</span>
            </div>
            {adv.map((a) => {
              const on = selected?.id === a.topCreativeId;
              return (
                <button
                  key={a.page_name}
                  onClick={() =>
                    openAd(
                      a.topCreativeId,
                      a.page_name,
                      `${a.activeAds} active ads · ${verticalLabel(a.vertical)}`
                    )
                  }
                  className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 text-left transition-colors last:border-0"
                  style={{ background: on ? "var(--color-source-soft)" : "transparent" }}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-[14px] font-bold">
                      {a.page_name}
                      {a.isPersona && (
                        <span className="rounded bg-[var(--color-decode-soft)] px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--color-decode)]">
                          PERSONA
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[12px] text-[var(--color-ink-muted)]">
                      {a.topCreative || "—"}
                    </span>
                  </span>
                  <span className="text-right text-[14px] font-bold tabular-nums">
                    {compact(a.activeAds)}
                  </span>
                  <span className="text-right text-[14px] font-extrabold tabular-nums" style={{ color: ACCENT }}>
                    {Math.round(a.maxScore)}
                  </span>
                </button>
              );
            })}
          </Card>
        ))}

      {/* ── Creatives ───────────────────────────────────────────────────── */}
      {tab === "creatives" &&
        (crv.length === 0 ? (
          <EmptyState icon={Search} title="No creatives yet" hint="Run a search to populate winners." />
        ) : (
          <div className="flex flex-col gap-3">
            {crv.map((c) => {
              const on = selected?.id === c.id;
              return (
                <Card
                  key={c.id}
                  className="flex items-center gap-3 p-3"
                  accent={on ? ACCENT : undefined}
                >
                  <AdThumb src={c.page_screenshot_url} name={c.page_name} size={56} />
                  <button
                    onClick={() => setDetail(c)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[14px] font-bold">
                      {c.ad_title || c.page_headline || "Untitled creative"}
                    </p>
                    <p className="truncate text-[12px] text-[var(--color-ink-muted)]">
                      {c.page_name} · running {c.days_running}d
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <WinnerBadge badge={c.badge} />
                      <span className="text-[11.5px] font-semibold text-[var(--color-ink-muted)]">
                        Score {Math.round(c.winner_score)}
                      </span>
                    </div>
                  </button>
                  {c.meta_ad_id && (
                    <a
                      href={metaAdUrl(c.meta_ad_id) as string}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[var(--color-ink-muted)]"
                      title="View ad on Meta"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </Card>
              );
            })}
          </div>
        ))}

      {/* ── Identity ────────────────────────────────────────────────────── */}
      {tab === "identity" &&
        (identity.length === 0 ? (
          <EmptyState
            icon={CornerDownRight}
            title="No personas detected"
            hint="When advertisers run under a 'Dr. ABC' name, they're resolved up to the real brand here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {identity.map((p) => (
              <Card key={p.persona} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14.5px] font-bold">{p.persona}</p>
                  <WinnerBadge badge={p.badge} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[13px]">
                  <CornerDownRight size={15} className="text-[var(--color-ink-muted)]" />
                  {p.resolvedBrand ? (
                    <span className="font-semibold text-[var(--color-source)]">
                      rolls up to {p.resolvedBrand}
                    </span>
                  ) : (
                    <span className="text-[var(--color-ink-muted)]">
                      unresolved — needs brand mapping
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-[var(--color-ink-muted)]">
                  {compact(p.activeAds)} active ads
                </p>
              </Card>
            ))}
          </div>
        ))}

      {/* ── Selected winner + CTA ───────────────────────────────────────── */}
      {selected && (
        <Card className="mt-5 p-4" accent={ACCENT}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Selected winner
          </p>
          <p className="mt-1 text-[16px] font-extrabold leading-snug">{selected.name}</p>
          <p className="text-[12.5px] text-[var(--color-ink-muted)]">{selected.sub}</p>
          <button
            onClick={() => selected.id && toDecode(selected.id)}
            disabled={!selected.id}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            Send Winner to Decode
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
        </Card>
      )}

      {/* ── Ad viewer ───────────────────────────────────────────────────── */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        accent={ACCENT}
        title={
          <span className="flex items-center gap-2">
            <span className="truncate">{detail?.page_name || "Ad detail"}</span>
            <WinnerBadge badge={detail?.badge} />
          </span>
        }
      >
        {detail && (
          <div className="flex flex-col gap-4">
            {/* Creative image */}
            <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)]">
              {detail.page_screenshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.page_screenshot_url}
                  alt={detail.page_name || "ad creative"}
                  className="max-h-[340px] w-full object-cover object-top"
                />
              ) : (
                <div className="grid h-40 place-items-center text-[13px] text-[var(--color-ink-muted)]">
                  No landing-page snapshot captured yet
                </div>
              )}
            </div>

            {/* Headline */}
            <div>
              <p className="text-[17px] font-extrabold leading-snug">
                {detail.ad_title || detail.page_headline || "Untitled creative"}
              </p>
              <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-muted)]">
                {detail.page_name} · running {detail.days_running}d ·{" "}
                {verticalLabel(detail.vertical)}
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Winner" value={Math.round(detail.winner_score)} accent={ACCENT} />
              <Stat label="Days" value={detail.days_running} />
              <Stat label="Spend" value={money(detail.spend_lower, detail.spend_upper)} />
              <Stat
                label="Impr."
                value={compact(
                  ((detail.impressions_lower ?? 0) + (detail.impressions_upper ?? 0)) / 2 || null
                )}
              />
            </div>

            {/* Ad copy */}
            {detail.ad_body && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Ad copy
                </p>
                <p className="whitespace-pre-wrap rounded-xl bg-[var(--color-surface-2)] px-3.5 py-3 text-[13.5px] leading-relaxed">
                  {detail.ad_body}
                </p>
              </div>
            )}

            {/* Landing intel (post-crawl) */}
            {(detail.page_offer || detail.page_cta || detail.page_pricing) && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-line)] px-3.5 py-3 text-[13px]">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Landing intel
                </p>
                {detail.page_offer && (
                  <p>
                    <span className="font-semibold">Offer:</span> {detail.page_offer}
                  </p>
                )}
                {detail.page_cta && (
                  <p>
                    <span className="font-semibold">CTA:</span> {detail.page_cta}
                  </p>
                )}
                {detail.page_pricing && (
                  <p>
                    <span className="font-semibold">Pricing:</span> {detail.page_pricing}
                  </p>
                )}
              </div>
            )}

            {/* External links */}
            <div className="flex flex-wrap gap-2">
              {detail.meta_ad_id && (
                <a
                  href={metaAdUrl(detail.meta_ad_id) as string}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-white"
                  style={{ background: ACCENT }}
                >
                  <ExternalLink size={14} /> View ad on Meta
                </a>
              )}
              {siteUrl(detail.destination_url) && (
                <a
                  href={siteUrl(detail.destination_url) as string}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3 py-2 text-[12.5px] font-semibold"
                >
                  <ExternalLink size={14} /> Visit site
                </a>
              )}
            </div>
            {detail.destination_url && !siteUrl(detail.destination_url) && (
              <p className="-mt-1 text-[11.5px] text-[var(--color-ink-muted)]">
                Ad caption: “{detail.destination_url}” — open it on Meta to see the real destination.
              </p>
            )}

            {/* Primary CTA */}
            <button
              onClick={() => toDecode(detail.id)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-bold text-white active:scale-[0.99]"
              style={{ background: ACCENT }}
            >
              Send Winner to Decode
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
