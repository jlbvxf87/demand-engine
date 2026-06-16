"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Loader2, Check, ShieldCheck, PenLine } from "lucide-react";
import { ScreenHeader, Card, Badge, Tabs, EmptyState } from "@/components/ui";
import AdThumb from "@/components/AdThumb";
import { verticalLabel } from "@/lib/format";
import { generateCopy, generateImage } from "@/app/actions";
import type { AdRow, Brand, Creative } from "@/lib/data";

const ACCENT = "var(--color-rebuild)";

export default function RebuildClient({
  ad,
  brands,
  creatives,
}: {
  ad: AdRow | null;
  brands: Brand[];
  creatives: Creative[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("copy");
  const [brief, setBrief] = useState("");
  const [brandSlug, setBrandSlug] = useState<string>(brands[0]?.slug || "");
  const [format, setFormat] = useState("9:16");
  const [style, setStyle] = useState("Realistic UGC");
  const [tone, setTone] = useState("Relatable");
  const [variants, setVariants] = useState(3);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (ad) {
      try {
        const saved = sessionStorage.getItem(`brief:${ad.id}`);
        if (saved) setBrief(saved);
        else setBrief(ad.page_ai_summary || ad.ad_title || "");
        const b = sessionStorage.getItem(`brand:${ad.id}`);
        if (b) setBrandSlug(b);
      } catch {}
    }
  }, [ad]);

  if (!ad) {
    return (
      <div>
        <ScreenHeader title="Rebuild" subtitle="Generate new on-brand creative from the brief." />
        <EmptyState
          icon={PenLine}
          title="No brief selected"
          hint="Decode a winning ad first, then rebuild it here."
        />
      </div>
    );
  }

  const selectedBrand = brands.find((b) => b.slug === brandSlug);

  function generate() {
    setNote(null);
    try {
      sessionStorage.setItem(`brief:${ad!.id}`, brief);
      sessionStorage.setItem(`brand:${ad!.id}`, brandSlug);
    } catch {}
    startTransition(async () => {
      const copy = await generateCopy(ad!.id, "hooks");
      if (!copy.ok) {
        setNote(copy.error || "Copy generation failed");
        return;
      }
      const img = await generateImage(ad!.id);
      if (!img.ok) {
        setNote(`Copy done; image: ${img.error || "failed"}`);
      }
      router.refresh();
    });
  }

  return (
    <div>
      <ScreenHeader
        title="Rebuild"
        subtitle="Generate new on-brand T2V creative from the brief."
        badge="T2V"
        badgeTone="rebuild"
      />

      {/* Brief */}
      <Card className="mb-4 p-4" accent={ACCENT}>
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-bold">Creative Brief</p>
          <AdThumb src={ad.page_screenshot_url} name={ad.page_name} size={34} rounded="rounded-lg" />
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 text-[13px] outline-none focus:border-[var(--color-rebuild)]"
        />
      </Card>

      {/* Brand selector — the brand-spec injection point */}
      <p className="mb-2 text-[13px] font-bold">Brand</p>
      {brands.length === 0 ? (
        <Card className="mb-4 p-3 text-[12.5px] text-[var(--color-ink-muted)]">
          No brands found. Creative will use the ad&apos;s vertical only.
        </Card>
      ) : (
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
          {brands.map((b) => {
            const on = b.slug === brandSlug;
            return (
              <button
                key={b.slug}
                onClick={() => setBrandSlug(b.slug)}
                className="shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-colors"
                style={{
                  borderColor: on ? ACCENT : "var(--color-line)",
                  background: on ? "var(--color-rebuild-soft)" : "var(--color-surface)",
                }}
              >
                <span className="block text-[13px] font-bold" style={{ color: on ? ACCENT : "var(--color-ink)" }}>
                  {b.name}
                </span>
                <span className="block text-[11px] text-[var(--color-ink-muted)]">
                  {verticalLabel(b.vertical)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {selectedBrand?.brand_voice && (
        <p className="mb-4 px-1 text-[11.5px] text-[var(--color-ink-muted)]">
          Voice: {selectedBrand.brand_voice}
        </p>
      )}

      {/* Tabs */}
      <div className="mb-4">
        <Tabs
          accent={ACCENT}
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "copy", label: "Copy" },
            { id: "visual", label: "Visual" },
            { id: "video", label: "Video" },
            { id: "compliance", label: "Compliance" },
          ]}
        />
      </div>

      {/* Generated variants */}
      <p className="mb-2 text-[15px] font-bold">Generated Variants</p>
      {creatives.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No variants yet"
          hint="Set brand + format below, then generate."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {creatives.slice(0, 6).map((c) => (
            <Card key={c.id} className="overflow-hidden p-0">
              <div className="aspect-square w-full bg-[var(--color-surface-2)]">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt={c.hook_text}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[var(--color-ink-muted)]">
                    <Sparkles size={20} />
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-[12.5px] font-bold leading-tight">{c.hook_text}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone="neutral">{format}</Badge>
                  <span className="text-[10.5px] uppercase text-[var(--color-ink-muted)]">
                    {c.platform}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* T2V settings */}
      <Card className="mt-4 p-4">
        <p className="text-[14px] font-bold">T2V Settings</p>
        <div className="mt-3 flex flex-col gap-3">
          <Row label="Format">
            <Segmented options={["9:16", "1:1", "16:9"]} value={format} onChange={setFormat} accent={ACCENT} />
          </Row>
          <Row label="Style">
            <Segmented
              options={["Realistic UGC", "Studio", "Lifestyle"]}
              value={style}
              onChange={setStyle}
              accent={ACCENT}
            />
          </Row>
          <Row label="Tone">
            <Segmented
              options={["Relatable", "Authority", "Urgent"]}
              value={tone}
              onChange={setTone}
              accent={ACCENT}
            />
          </Row>
          <Row label="Variants">
            <Segmented
              options={["2", "3", "4"]}
              value={String(variants)}
              onChange={(v) => setVariants(Number(v))}
              accent={ACCENT}
            />
          </Row>
        </div>
      </Card>

      {/* Compliance gate */}
      <Card className="mt-4 flex items-start gap-3 border-[var(--color-rebuild)]/30 p-4" accent={ACCENT}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-rebuild-soft)] text-[var(--color-rebuild)]">
          <ShieldCheck size={18} />
        </span>
        <div>
          <p className="text-[14px] font-bold">Compliance Gate</p>
          <p className="text-[12.5px] text-[var(--color-ink-muted)]">Runs before save / export.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="win">No banned CTA</Badge>
            <Badge tone="warn">Risky claims flagged</Badge>
          </div>
        </div>
      </Card>

      {note && (
        <p className="mt-3 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
          {note}
        </p>
      )}

      <button
        onClick={generate}
        disabled={pending}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[16px] font-bold text-white disabled:opacity-60 active:scale-[0.99]"
        style={{ background: ACCENT }}
      >
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles size={18} /> Generate {variants} T2V Creatives
          </>
        )}
      </button>

      <button
        onClick={() => router.push("/publish")}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-line)] px-5 py-3.5 text-[15px] font-bold text-[var(--color-rebuild)]"
      >
        Send to Publish <ArrowRight size={17} />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-semibold text-[var(--color-ink-muted)]">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  accent,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className="rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors"
            style={{
              borderColor: on ? accent : "var(--color-line)",
              background: on ? accent : "var(--color-surface)",
              color: on ? "#fff" : "var(--color-ink-muted)",
            }}
          >
            {o === value && <Check size={11} className="mr-0.5 inline" />}
            {o}
          </button>
        );
      })}
    </div>
  );
}
