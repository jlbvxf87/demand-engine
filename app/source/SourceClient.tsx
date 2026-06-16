"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, ExternalLink, Loader2, CornerDownRight } from "lucide-react";
import {
  ScreenHeader,
  Card,
  Badge,
  WinnerBadge,
  Tabs,
  FilterPill,
  EmptyState,
} from "@/components/ui";
import AdThumb from "@/components/AdThumb";
import { compact, verticalLabel } from "@/lib/format";
import { searchAds } from "@/app/actions";
import type { Advertiser, AdRow, IdentityRollup } from "@/lib/data";

const ACCENT = "var(--color-source)";

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
  const [selected, setSelected] = useState<{ id: string; name: string; sub: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const vFilter = (v: string | null) => vertical === "all" || v === vertical;

  const adv = useMemo(() => advertisers.filter((a) => vFilter(a.vertical)), [advertisers, vertical]);
  const crv = useMemo(() => creatives.filter((a) => vFilter(a.vertical)), [creatives, vertical]);

  function runSearch() {
    if (!query.trim()) return;
    setNote(null);
    startTransition(async () => {
      const r = await searchAds(query.trim());
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

      {/* Tabs */}
      <div className="mb-3">
        <Tabs
          accent={ACCENT}
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "advertisers", label: "Advertisers" },
            { id: "creatives", label: "Creatives" },
            { id: "identity", label: "Identity" },
          ]}
        />
      </div>

      {/* Filters */}
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <FilterPill
          label="Vertical"
          value={vertical === "all" ? "All" : verticalLabel(vertical)}
          onClick={() => {
            const opts = ["all", ...verticals];
            const i = opts.indexOf(vertical);
            setVertical(opts[(i + 1) % opts.length]);
          }}
        />
        <FilterPill label="Country" value="USA" />
        <FilterPill label="Window" value="30 days" />
        <FilterPill label="Badge" value="All" />
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
                    setSelected({
                      id: a.topCreativeId || "",
                      name: a.page_name,
                      sub: `${a.activeAds} active ads · ${verticalLabel(a.vertical)}`,
                    })
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
                    onClick={() =>
                      setSelected({
                        id: c.id,
                        name: c.ad_title || c.page_headline || c.page_name || "Untitled",
                        sub: `${c.page_name} · ${c.days_running}d running`,
                      })
                    }
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
                  {c.destination_url && (
                    <a
                      href={c.destination_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[var(--color-ink-muted)]"
                      title="Open destination"
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
    </div>
  );
}
