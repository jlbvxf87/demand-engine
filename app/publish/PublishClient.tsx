"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Download, Upload, FolderInput, RotateCcw, Lock, Clapperboard, Loader2 } from "lucide-react";
import { ScreenHeader, Card, Badge, EmptyState } from "@/components/ui";
import AdThumb from "@/components/AdThumb";
import { renderVideo } from "@/app/actions";
import type { Creative } from "@/lib/data";

const ACCENT = "var(--color-publish)";

const TARGETS = [
  { id: "meta", label: "Meta Ads Direct", icon: Upload },
  { id: "export", label: "Manual Ad Account Export", icon: FolderInput },
  { id: "download", label: "Download Files", icon: Download },
];

export default function PublishClient({ creatives }: { creatives: Creative[] }) {
  const router = useRouter();
  const [target, setTarget] = useState("meta");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function render(id: string) {
    setBusyId(id);
    setNote(null);
    startTransition(async () => {
      const r = await renderVideo(id);
      setBusyId(null);
      if (!r.ok) setNote(r.error || "Render failed");
      else router.refresh();
    });
  }

  return (
    <div>
      <ScreenHeader
        title="Publish"
        subtitle="Export, test, capture results, rank winners."
        badge={creatives.length ? "ready" : "empty"}
        badgeTone={creatives.length ? "publish" : "neutral"}
      />

      {/* Ready to test */}
      <p className="mb-2 text-[15px] font-bold">Ready to Test</p>
      {creatives.length === 0 ? (
        <EmptyState
          icon={Play}
          title="Nothing to publish yet"
          hint="Generate creatives in Rebuild, then they queue here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {creatives.map((c, i) => {
            const hasVideo = Boolean(c.video_url);
            const rendering = c.video_status === "queued" || c.video_status === "rendering";
            return (
              <Card key={c.id} className="flex items-center gap-3 p-3">
                <div className="relative shrink-0">
                  <AdThumb src={c.image_url} name={c.hook_text} size={52} />
                  {hasVideo && (
                    <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/35">
                      <Play size={18} className="text-white" fill="currentColor" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{c.hook_text}</p>
                  <p className="text-[12px] text-[var(--color-ink-muted)]">
                    {hasVideo
                      ? "Video · Vertical 9:16"
                      : rendering
                        ? "Rendering video…"
                        : `Still · 0:${String(22 + i * 3).padStart(2, "0")} · 9:16`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {hasVideo ? (
                    <Badge tone="publish">Video ready</Badge>
                  ) : rendering ? (
                    <Badge tone="decode">Rendering</Badge>
                  ) : (
                    <button
                      onClick={() => render(c.id)}
                      disabled={pending && busyId === c.id}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-publish-soft)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--color-publish)] disabled:opacity-60"
                    >
                      {pending && busyId === c.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Clapperboard size={12} />
                      )}
                      Render video
                    </button>
                  )}
                  <Badge tone="win">Compliant</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {note && (
        <p className="mt-3 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
          {note}
        </p>
      )}

      {/* Publish targets */}
      <p className="mb-2 mt-6 text-[15px] font-bold">Publish To</p>
      <div className="flex flex-col gap-2.5">
        {TARGETS.map((t) => {
          const on = t.id === target;
          return (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors"
              style={{
                borderColor: on ? ACCENT : "var(--color-line)",
                background: on ? "var(--color-publish-soft)" : "var(--color-surface)",
              }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full border-2"
                style={{ borderColor: on ? ACCENT : "var(--color-line)" }}
              >
                {on && <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />}
              </span>
              <t.icon size={17} style={{ color: on ? ACCENT : "var(--color-ink-muted)" }} />
              <span className="text-[14px] font-semibold" style={{ color: on ? ACCENT : "var(--color-ink)" }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Run performance (needs Meta Marketing API) */}
      <p className="mb-2 mt-6 text-[15px] font-bold">Run Performance</p>
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["CTR", "—"],
            ["CPC", "—"],
            ["Spend", "—"],
            ["Leads", "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-semibold uppercase text-[var(--color-ink-muted)]">{k}</p>
              <p className="text-[18px] font-extrabold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-[12px] text-[var(--color-ink-muted)]">
          <Lock size={13} />
          Connect the Meta Marketing API to stream live CTR, CPC, spend & leads.
        </div>
      </Card>

      {/* Winner loop */}
      <Card className="mt-4 p-4">
        <p className="text-[14px] font-bold text-[var(--color-publish)]">Winner Loop</p>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-muted)]">
          Top performers re-enter Source as new reference material.
        </p>
        <div className="mt-3 flex gap-2">
          <button className="flex items-center gap-1.5 rounded-xl bg-[var(--color-publish-soft)] px-3 py-2 text-[12.5px] font-bold text-[var(--color-publish)]">
            Rank winners
          </button>
          <button
            onClick={() => router.push("/source")}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3 py-2 text-[12.5px] font-bold"
          >
            <RotateCcw size={13} /> Back to library
          </button>
        </div>
      </Card>

      <button
        disabled={creatives.length === 0}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[16px] font-bold text-white disabled:opacity-40 active:scale-[0.99]"
        style={{ background: ACCENT }}
      >
        <Play size={18} /> Publish {creatives.length || ""} Creatives
      </button>
    </div>
  );
}
