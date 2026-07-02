"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FolderInput, RotateCcw, Lock } from "lucide-react";
import { Card } from "@/components/ui";

const ACCENT = "var(--color-publish)";

const TARGETS = [
  { id: "download", label: "Download Files", icon: Download, soon: false },
  { id: "meta", label: "Meta Ads Direct", icon: Upload, soon: true },
  { id: "export", label: "Manual Ad Account Export", icon: FolderInput, soon: true },
];

/** Small "Coming soon" pill for controls that aren't wired yet. */
function Soon() {
  return (
    <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
      Coming soon
    </span>
  );
}

/** Publish tab: download finished creatives now; the rest is honestly marked coming soon. */
export default function PublishPanel({ publishableCount }: { publishableCount: number }) {
  const router = useRouter();
  const [target, setTarget] = useState("download");
  const canDownload = target === "download" && publishableCount > 0;

  return (
    <div>
      {/* Publish targets */}
      <p className="mb-2 text-[15px] font-bold">Publish To</p>
      <div className="flex flex-col gap-2.5">
        {TARGETS.map((t) => {
          const on = t.id === target;
          return (
            <button
              key={t.id}
              onClick={() => !t.soon && setTarget(t.id)}
              disabled={t.soon}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                borderColor: on ? ACCENT : "var(--color-line)",
                background: on ? "var(--color-publish-soft)" : "var(--color-surface)",
              }}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2"
                style={{ borderColor: on ? ACCENT : "var(--color-line)" }}
              >
                {on && <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />}
              </span>
              <t.icon size={17} style={{ color: on ? ACCENT : "var(--color-ink-muted)" }} />
              <span className="text-[14px] font-semibold" style={{ color: on ? ACCENT : "var(--color-ink)" }}>
                {t.label}
              </span>
              {t.soon && <span className="ml-auto"><Soon /></span>}
            </button>
          );
        })}
      </div>

      {/* Run performance — not wired yet */}
      <div className="mb-2 mt-6 flex items-center gap-2">
        <p className="text-[15px] font-bold">Run Performance</p>
        <Soon />
      </div>
      <Card className="p-4 opacity-70">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          Live CTR, CPC, spend &amp; leads arrive when Meta Marketing API is connected.
        </div>
      </Card>

      {/* Winner loop */}
      <Card className="mt-4 p-4">
        <p className="text-[14px] font-bold text-[var(--color-publish)]">Winner Loop</p>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-muted)]">
          Test cheap drafts → rank winners → rebuild winners → upgrade the best to cinematic.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            disabled
            className="flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-[var(--color-surface-2)] px-3 py-2 text-[12.5px] font-bold text-[var(--color-ink-muted)]"
          >
            Rank winners
          </button>
          <Soon />
          <button
            onClick={() => router.push("/source")}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3 py-2 text-[12.5px] font-bold"
          >
            <RotateCcw size={13} /> Back to library
          </button>
        </div>
      </Card>

      {/* Primary action — only Download is live today */}
      {target === "download" ? (
        <a
          href="/api/creatives/download-all"
          aria-disabled={!canDownload}
          onClick={(e) => {
            if (!canDownload) e.preventDefault();
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[16px] font-bold text-white active:scale-[0.99]"
          style={{ background: ACCENT, opacity: canDownload ? 1 : 0.4, pointerEvents: canDownload ? "auto" : "none" }}
        >
          <Download size={18} /> Download {publishableCount || ""} {publishableCount === 1 ? "Creative" : "Creatives"} (.zip)
        </a>
      ) : (
        <button
          disabled
          className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-[var(--color-surface-2)] px-5 py-4 text-[16px] font-bold text-[var(--color-ink-muted)]"
        >
          <Lock size={16} /> {TARGETS.find((t) => t.id === target)?.label} — coming soon
        </button>
      )}
    </div>
  );
}
