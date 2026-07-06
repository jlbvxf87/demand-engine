"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, RotateCw, Trash2, Loader2, Clapperboard } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { providerLabel } from "@/lib/video";
import { posterFor } from "@/lib/format";
import { withDownload } from "@/lib/download";
import { deleteStoryboard, stitchStoryboard } from "@/app/actions";
import type { Storyboard } from "@/lib/data";

const ACCENT = "var(--color-publish)";

/** Multi-scene stories with their stitched finals (Stories tab). Refresh reloads
 *  status; delete removes a story + its clips. */
export default function StoriesList({ storyboards }: { storyboards: Storyboard[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function refresh() {
    setNote(null);
    startTransition(() => router.refresh());
  }

  function del(id: string) {
    if (!confirm("Delete this story and its clips? This can't be undone.")) return;
    setBusyId(id);
    setNote(null);
    startTransition(async () => {
      const r = await deleteStoryboard(id);
      setBusyId(null);
      if (!r.ok) setNote(r.error || "Delete failed");
      else router.refresh();
    });
  }

  function stitch(id: string) {
    setBusyId(id);
    setNote(null);
    startTransition(async () => {
      const r = await stitchStoryboard(id);
      setBusyId(null);
      if (!r.ok) setNote(r.error || "Stitch failed");
      else router.refresh();
    });
  }

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[15px] font-bold">Stories{storyboards.length ? ` · ${storyboards.length}` : ""}</p>
        <button
          onClick={refresh}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-bold text-[var(--color-ink-muted)] disabled:opacity-50"
        >
          <RotateCw size={13} className={pending && !busyId ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {note && (
        <p className="mb-2 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
          {note}
        </p>
      )}

      {storyboards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-line)] px-3 py-6 text-center text-[12.5px] text-[var(--color-ink-muted)]">
          No stories yet — generate one above, or assemble clips into a story.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {storyboards.map((s) => (
            <Card key={s.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-[13.5px] font-bold">{s.prompt}</p>
                  <p className="text-[11.5px] text-[var(--color-ink-muted)]">
                    {s.clip_count} scenes · {providerLabel(s.provider)}
                  </p>
                  {!isStoryFinished(s) && (
                    <div className="mt-1.5 max-w-[210px]">
                      <p className="text-[10.5px] font-bold tabular-nums text-[var(--color-ink-muted)]">
                        {s.scenesReady} of {s.clip_count} scenes ready
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.round((s.scenesReady / Math.max(1, s.clip_count)) * 100)}%`,
                            background: ACCENT,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {isStoryFinished(s) && s.scenesReady < s.clip_count && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--color-warn-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--color-warn)]">
                      ⚠ {s.scenesReady} of {s.clip_count} scenes rendered ({s.clip_count - s.scenesReady} failed)
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StoryStatus s={s} />
                  <button
                    onClick={() => del(s.id)}
                    disabled={busyId === s.id}
                    title="Delete story"
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--color-danger-soft)] text-[var(--color-danger)] disabled:opacity-50"
                  >
                    {busyId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
              {s.final_video_url ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={s.final_video_url}
                    poster={posterFor(s.final_video_url)}
                    controls
                    playsInline
                    className="max-h-[280px] w-auto rounded-xl bg-black"
                  />
                  <a
                    href={withDownload(s.final_video_url, `story-${s.id}.mp4`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3 py-2 text-[12.5px] font-semibold"
                  >
                    <Download size={14} /> Download story
                  </a>
                </div>
              ) : !s.autoStitch && s.scenes.length > 0 ? (
                <div className="mt-2.5">
                  {/* Individual scenes — each downloadable to edit separately. */}
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {s.scenes
                      .filter((sc) => sc.video_url)
                      .map((sc, i) => (
                        <div key={sc.id} className="shrink-0">
                          <div className="relative aspect-[9/16] w-24 overflow-hidden rounded-xl bg-black">
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <video
                              src={`${sc.video_url}#t=0.1`}
                              poster={posterFor(sc.video_url)}
                              muted
                              playsInline
                              preload="metadata"
                              onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                              onMouseLeave={(e) => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                              }}
                              className="h-full w-full object-cover"
                            />
                            <span
                              className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full text-[9px] font-extrabold text-white"
                              style={{ background: ACCENT }}
                            >
                              {i + 1}
                            </span>
                          </div>
                          <a
                            href={withDownload(sc.video_url as string, `scene-${i + 1}-${sc.id.slice(0, 6)}.mp4`)}
                            className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-[var(--color-line)] py-1 text-[10.5px] font-semibold"
                          >
                            <Download size={11} /> Scene {i + 1}
                          </a>
                        </div>
                      ))}
                  </div>
                  {s.scenesReady >= 2 && (
                    <button
                      onClick={() => stitch(s.id)}
                      disabled={busyId === s.id}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
                      style={{ background: ACCENT }}
                    >
                      {busyId === s.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Clapperboard size={13} />
                      )}
                      Stitch these into one
                    </button>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* A story is "finished" once it's done rendering/stitching — i.e. it has a
   stitched final OR is no longer actively scripting/generating/stitching. */
function isStoryFinished(s: Storyboard) {
  if (s.final_video_url) return true;
  return !["scripting", "generating", "stitching"].includes(s.status);
}

/* Status pill for a storyboard row. */
function StoryStatus({ s }: { s: Storyboard }) {
  if (s.final_video_url) return <Badge tone="publish">Story ready</Badge>;
  if (s.status === "stitching") return <Badge tone="decode">Stitching…</Badge>;
  if (!s.autoStitch && s.status === "ready") return <Badge tone="publish">Scenes ready</Badge>;
  if (s.status === "failed" || s.final_status === "failed") return <Badge tone="danger">Failed</Badge>;
  if (s.status === "scripting") return <Badge tone="warn">Scripting…</Badge>;
  return <Badge tone="decode">Rendering scenes…</Badge>;
}
