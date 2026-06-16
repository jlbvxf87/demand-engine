"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Zap,
  Heart,
  Eye,
  ListOrdered,
  Target,
  ExternalLink,
  Loader2,
  Diamond,
} from "lucide-react";
import { ScreenHeader, Card, Badge, WinnerBadge, Tabs, EmptyState } from "@/components/ui";
import AdThumb from "@/components/AdThumb";
import { verticalLabel } from "@/lib/format";
import { decodeAd } from "@/app/actions";
import type { AdRow, HookPattern } from "@/lib/data";

const ACCENT = "var(--color-decode)";

type WhyRow = { icon: typeof Zap; label: string; value: string | null };

export default function DecodeClient({
  ad,
  patterns,
}: {
  ad: AdRow | null;
  patterns: HookPattern[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("why");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const p = patterns[0];
  const defaultBrief = ad
    ? `Recreate the ${p?.hook_type || "winning"} angle for our brand. Promise: ${
        ad.page_headline || ad.ad_title || "—"
      }. Keep the proof and ${p?.bridge_mechanism || "structure"}; change the voice, visuals, and offer. ${
        p?.why_it_works || ad.page_ai_summary || ""
      } Avoid therapeutic claims.`
    : "";
  const [brief, setBrief] = useState(defaultBrief);

  if (!ad) {
    return (
      <div>
        <ScreenHeader title="Decode" subtitle="Understand why the selected creative wins." />
        <EmptyState
          icon={Diamond}
          title="No ad selected"
          hint="Pick a winner on the Source screen, then send it to Decode."
        />
      </div>
    );
  }

  const why: WhyRow[] = [
    { icon: Zap, label: "Hook", value: p?.hook_sentence || p?.hook_type || ad.ad_title },
    { icon: Heart, label: "Emotional trigger", value: p?.emotional_trigger || null },
    { icon: Eye, label: "Visual mechanic", value: p?.visual_technique || null },
    {
      icon: ListOrdered,
      label: "Copy structure",
      value: p?.copy_structure
        ? typeof p.copy_structure === "string"
          ? p.copy_structure
          : JSON.stringify(p.copy_structure)
        : p?.bridge_mechanism || null,
    },
    { icon: Target, label: "CTA / offer", value: p?.cta_text || ad.page_cta || ad.page_offer },
  ];

  const decoded = patterns.length > 0 || ad.crawl_status === "crawled";

  function runDecode() {
    setNote(null);
    startTransition(async () => {
      const r = await decodeAd(ad!.id);
      if (!r.ok) setNote(r.error || "Decode failed");
      else router.refresh();
    });
  }

  function toRebuild() {
    try {
      sessionStorage.setItem(`brief:${ad!.id}`, brief);
    } catch {}
    router.push(`/rebuild?ad=${ad!.id}`);
  }

  return (
    <div>
      <ScreenHeader
        title="Decode"
        subtitle="Understand why the selected creative wins."
        badge={decoded ? "brief ready" : "needs decode"}
        badgeTone={decoded ? "decode" : "warn"}
      />

      {/* Selected creative */}
      <Card className="mb-4 flex items-center gap-3 p-4" accent={ACCENT}>
        <AdThumb src={ad.page_screenshot_url} name={ad.page_name} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold">
            {ad.ad_title || ad.page_headline || "Untitled creative"}
          </p>
          <p className="truncate text-[12px] text-[var(--color-ink-muted)]">
            {ad.page_name} · running {ad.days_running}d · {verticalLabel(ad.vertical)}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <WinnerBadge badge={ad.badge} />
            <span className="text-[11.5px] font-semibold text-[var(--color-ink-muted)]">
              Score {Math.round(ad.winner_score)}
            </span>
          </div>
        </div>
      </Card>

      <div className="mb-4">
        <Tabs
          accent={ACCENT}
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "why", label: "Why it Works" },
            { id: "page", label: "Page Intel" },
            { id: "brief", label: "Brief" },
          ]}
        />
      </div>

      {/* Why it works */}
      {tab === "why" && (
        <div className="flex flex-col gap-2.5">
          {!decoded && (
            <Card className="flex items-center justify-between gap-3 p-4">
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                This ad hasn&apos;t been decoded yet. Crawl its page to extract the hook.
              </p>
              <button
                onClick={runDecode}
                disabled={pending}
                className="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                style={{ background: ACCENT }}
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : "Decode ad"}
              </button>
            </Card>
          )}
          {why.map((r) => (
            <Card key={r.label} className="flex items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-decode-soft)] text-[var(--color-decode)]">
                <r.icon size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold">{r.label}</p>
                <p className="mt-0.5 text-[13px] text-[var(--color-ink-muted)]">
                  {r.value || "—"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Page intel (the landing/page-builder fork) */}
      {tab === "page" && (
        <div className="flex flex-col gap-3">
          {ad.page_screenshot_url && (
            <Card className="overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ad.page_screenshot_url}
                alt="destination page"
                className="max-h-80 w-full object-cover object-top"
              />
            </Card>
          )}
          {[
            ["Headline", ad.page_headline],
            ["Product", ad.page_product],
            ["Offer", ad.page_offer],
            ["CTA", ad.page_cta],
            ["Pricing", ad.page_pricing],
            ["Summary", ad.page_ai_summary],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <Card key={k as string} className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  {k}
                </p>
                <p className="mt-1 text-[13.5px]">{v}</p>
              </Card>
            ))}
          {ad.destination_url && (
            <a
              href={ad.destination_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-line)] py-3 text-[14px] font-semibold text-[var(--color-decode)]"
            >
              Open destination page <ExternalLink size={15} />
            </a>
          )}
          {!ad.page_screenshot_url && !ad.page_headline && (
            <EmptyState
              title="No page intel yet"
              hint="Decode the ad to crawl its destination page and screenshot."
            />
          )}
          <p className="px-1 text-[11.5px] text-[var(--color-ink-muted)]">
            Page intel feeds the optional Landing Page lane — decoupled from the creative line.
          </p>
        </div>
      )}

      {/* Editable brief */}
      {tab === "brief" && (
        <Card className="p-4">
          <p className="text-[14px] font-bold">Editable Creative Brief</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-muted)]">
            This is what Rebuild turns into new on-brand creative. Edit freely.
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={7}
            className="mt-3 w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 text-[13.5px] outline-none focus:border-[var(--color-decode)]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {p?.hook_type && <Badge tone="decode">Hook: {p.hook_type}</Badge>}
            <Badge tone="neutral">Format: 9:16</Badge>
          </div>
        </Card>
      )}

      {note && (
        <p className="mt-3 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
          {note}
        </p>
      )}

      <button
        onClick={toRebuild}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[16px] font-bold text-white active:scale-[0.99]"
        style={{ background: ACCENT }}
      >
        Rebuild Creative
        <ArrowRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
