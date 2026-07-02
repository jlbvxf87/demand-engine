"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Download,
  Clapperboard,
  Loader2,
  CheckCircle2,
  Film,
  Trash2,
  Zap,
  Sparkles,
} from "lucide-react";
import { ScreenHeader, Badge, EmptyState, Modal, Tabs } from "@/components/ui";
import AdThumb from "@/components/AdThumb";
import { verticalLabel, posterFor } from "@/lib/format";
import { withDownload } from "@/lib/download";
import { VIDEO_PROVIDERS, providerLabel, type VideoProvider } from "@/lib/video";
import {
  renderVideo,
  pollVideoJobs,
  deleteCreative,
  generateDraftVideo,
  buildCinematicRecipe,
  upgradeToCinematic,
  stitchClips,
} from "@/app/actions";
import CopyPanel from "./CopyPanel";
import VideoPanel from "./VideoPanel";
import StoryboardPanel from "./StoryboardPanel";
import StoriesList from "./StoriesList";
import PublishPanel from "./PublishPanel";
import SceneRecipe from "./SceneRecipe";
import type { DraftRenderPlan } from "@/remotion/types";
import type { Creative, Storyboard } from "@/lib/data";

const ACCENT = "var(--color-publish)";

const TABS = [
  { id: "copy", label: "Copy" },
  { id: "video", label: "Video" },
  { id: "stories", label: "Stories" },
  { id: "publish", label: "Publish" },
];

function isRendering(c: Creative) {
  return (
    c.video_status === "queued" ||
    c.video_status === "rendering" ||
    c.video_status === "compositing"
  );
}

/** Cinematic = a real AI-model (KIE) video OR a recipe-based cinematic upgrade
 *  (all scenes AI). Tests = cheap Remotion drafts/motion, stills, and anything
 *  not yet promoted. */
function isCinematic(c: Creative) {
  return c.render_mode === "cinematic" || (!!c.video_provider && c.video_provider !== "remotion");
}

/** Short tier label for a tile badge. */
function tierLabel(c: Creative): string {
  if (c.render_mode === "cinematic") return "Cinematic";
  if (c.render_mode === "motion") return "Motion";
  if (c.render_mode === "draft" || c.video_provider === "remotion") return "Draft";
  if (c.video_provider) return providerLabel(c.video_provider);
  return c.video_url ? "Video" : "Still";
}

function fmtElapsed(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/** Seconds a clip has been rendering. Anchored to the row's created_at (server
 *  truth) so it shows REAL elapsed time and survives reloads — a stuck render
 *  then reads its true age (e.g. 46:00) instead of resetting to 0:07. */
function useRenderElapsed(active: boolean, sinceIso?: string): number {
  const [secs, setSecs] = useState(0);
  const startRef = useRef<number>(0);
  if (active && startRef.current === 0) {
    const t = sinceIso ? new Date(sinceIso).getTime() : NaN;
    startRef.current = Number.isFinite(t) ? t : Date.now();
  }
  if (!active && startRef.current !== 0) startRef.current = 0;
  useEffect(() => {
    if (!active) {
      setSecs(0);
      return;
    }
    const tick = () => setSecs(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [active]);
  return secs;
}

export default function PublishClient({
  creatives,
  storyboards,
}: {
  creatives: Creative[];
  storyboards: Storyboard[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("video");
  const [model, setModel] = useState<VideoProvider>("kling");
  const [review, setReview] = useState<Creative | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [outFilter, setOutFilter] = useState<"all" | "tests" | "cinematic">("all");

  // Cinematic upgrade review (opens on a finished draft; spends nothing until confirm).
  const [cineFor, setCineFor] = useState<Creative | null>(null);
  const [cinePlan, setCinePlan] = useState<DraftRenderPlan | null>(null);
  const [cineProvider, setCineProvider] = useState<VideoProvider>("kling");
  const [cineBuilding, setCineBuilding] = useState(false);
  const [cineRendering, startCine] = useTransition();

  // Stories tab: generate fresh vs assemble existing clips.
  const [storyMode, setStoryMode] = useState<"generate" | "assemble">("generate");
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [stitching, startStitch] = useTransition();

  const anyRendering = creatives.some(isRendering);
  const stills = creatives.filter((c) => !c.video_url && !isRendering(c));
  // Scene clips belong to a Story (shown in the Stories tab), so keep them out of
  // the standalone reel grid — otherwise the same footage shows twice.
  const standalone = creatives.filter((c) => c.creative_type !== "scene");
  const cinematic = standalone.filter(isCinematic);
  const tests = standalone.filter((c) => !isCinematic(c));
  // Finished clips (draft or cinematic) eligible to be stitched into a Story.
  const finishedClips = standalone.filter((c) => c.video_url && !isRendering(c));
  const shown = outFilter === "tests" ? tests : outFilter === "cinematic" ? cinematic : standalone;
  const anyStoryboardActive = storyboards.some((s) =>
    ["scripting", "generating", "stitching"].includes(s.status)
  );
  const polling = anyRendering || anyStoryboardActive;

  // A brief handed over from Decode goes straight to Video ▸ Draft.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("brief:scratch")) setTab("video");
    } catch {}
  }, []);

  // Drive kie polling from the client while clips render or stories stitch.
  useEffect(() => {
    if (!polling) return;
    let alive = true;
    const tick = async () => {
      await pollVideoJobs();
      if (alive) router.refresh();
    };
    const iv = setInterval(tick, 6000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [polling, router]);

  function render(id: string, m: VideoProvider) {
    setBusyId(id);
    setNote(null);
    startTransition(async () => {
      const r = await renderVideo(id, m);
      setBusyId(null);
      if (!r.ok) setNote(r.error || "Render failed");
      else router.refresh();
    });
  }

  // Cheap Draft render (Remotion + FFmpeg, no KIE credits).
  function draft(id: string) {
    setBusyId(id);
    setNote(null);
    startTransition(async () => {
      const r = await generateDraftVideo(id);
      setBusyId(null);
      if (!r.ok) setNote(r.error || "Draft render failed");
      else router.refresh();
    });
  }

  function renderAll() {
    if (!stills.length) return;
    setNote(null);
    startTransition(async () => {
      for (const c of stills) {
        await renderVideo(c.id, model);
      }
      router.refresh();
    });
  }

  function del(id: string) {
    if (!confirm("Delete this creative permanently? This can't be undone.")) return;
    setBusyId(id);
    setNote(null);
    startTransition(async () => {
      const r = await deleteCreative(id);
      setBusyId(null);
      if (!r.ok) setNote(r.error || "Delete failed");
      else {
        setReview(null);
        router.refresh();
      }
    });
  }

  // Open the Cinematic upgrade review for a finished draft. Builds the proposed
  // recipe (all scenes AI, seeded from the tested look) — spends nothing yet.
  function openUpgrade(c: Creative) {
    setReview(null);
    setCineFor(c);
    setCinePlan(null);
    setNote(null);
    setCineBuilding(true);
    startCine(async () => {
      const r = await buildCinematicRecipe(c.id);
      setCineBuilding(false);
      if (!r.ok) {
        setCineFor(null);
        setNote(r.error || "Couldn't build cinematic recipe");
        return;
      }
      const d = r.data as { plan: DraftRenderPlan; provider: string };
      setCinePlan(d.plan);
      if (d.provider && (VIDEO_PROVIDERS as { id: string }[]).some((p) => p.id === d.provider)) {
        setCineProvider(d.provider as VideoProvider);
      }
    });
  }

  // Confirm + spend: render the reviewed cinematic recipe as a NEW creative.
  function confirmCinematic() {
    if (!cineFor || !cinePlan) return;
    setNote(null);
    startCine(async () => {
      const r = await upgradeToCinematic(cineFor.id, cinePlan, cineProvider);
      if (!r.ok) {
        setNote(r.error || "Cinematic upgrade failed");
        return;
      }
      setCineFor(null);
      setCinePlan(null);
      router.refresh();
    });
  }

  function toggleClip(id: string) {
    setSelectedClips((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function doStitch() {
    const urls = selectedClips
      .map((id) => creatives.find((c) => c.id === id)?.video_url)
      .filter((u): u is string => Boolean(u));
    if (urls.length < 2) {
      setNote("Pick at least 2 clips to stitch");
      return;
    }
    setNote(null);
    startStitch(async () => {
      const r = await stitchClips({ clipUrls: urls, title: "Assembled story" });
      if (!r.ok) {
        setNote(r.error || "Stitch failed");
        return;
      }
      setSelectedClips([]);
      setStoryMode("generate");
      router.refresh();
    });
  }

  return (
    <div>
      <ScreenHeader
        title="Create"
        subtitle="Build ad-ready drafts for cents, then upgrade only the winners."
        badge={creatives.length ? "ready" : "empty"}
        badgeTone={creatives.length ? "publish" : "neutral"}
      />

      {/* Production console: Copy → Video → Stories → Publish */}
      <div className="mb-4">
        <Tabs accent={ACCENT} active={tab} onChange={setTab} tabs={TABS} />
      </div>

      {tab === "copy" && <CopyPanel />}
      {tab === "video" && <VideoPanel />}
      {tab === "stories" && (
        <>
          <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-0.5">
            {(["generate", "assemble"] as const).map((m) => {
              const on = storyMode === m;
              return (
                <button
                  key={m}
                  onClick={() => setStoryMode(m)}
                  className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
                  style={{ background: on ? ACCENT : "transparent", color: on ? "#fff" : "var(--color-ink-muted)" }}
                >
                  {m === "generate" ? "Generate new" : "Assemble clips"}
                </button>
              );
            })}
          </div>

          {storyMode === "generate" ? (
            <StoryboardPanel />
          ) : (
            <div className="mb-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
              <p className="text-[15px] font-bold">Assemble clips into a story</p>
              <p className="mb-3 text-[12.5px] text-[var(--color-ink-muted)]">
                Pick finished clips (Draft or Cinematic) in the order you want them — they&apos;re
                crossfade-stitched into one video. Your source clips stay untouched.
              </p>
              {finishedClips.length === 0 ? (
                <p className="text-[12.5px] text-[var(--color-ink-muted)]">
                  No finished clips yet — make a test or cinematic video first.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {finishedClips.map((c) => {
                      const idx = selectedClips.indexOf(c.id);
                      const sel = idx >= 0;
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleClip(c.id)}
                          className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[#10151B] text-left"
                          style={{ outline: sel ? `3px solid ${ACCENT}` : "none", outlineOffset: "-1px" }}
                        >
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video
                            src={`${c.video_url}#t=0.1`}
                            poster={posterFor(c.video_url)}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                          <span
                            className="absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] font-bold"
                            style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                          >
                            {tierLabel(c)}
                          </span>
                          {sel && (
                            <span
                              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold text-white"
                              style={{ background: ACCENT }}
                            >
                              {idx + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--color-ink-muted)]">
                      {selectedClips.length} selected
                    </span>
                    <button
                      onClick={doStitch}
                      disabled={stitching || selectedClips.length < 2}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
                      style={{ background: ACCENT }}
                    >
                      {stitching ? <Loader2 size={15} className="animate-spin" /> : <Clapperboard size={15} />}
                      Stitch {selectedClips.length >= 2 ? selectedClips.length : ""} clips into a story
                    </button>
                  </div>
                </>
              )}
              {note && (
                <p className="mt-2 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
                  {note}
                </p>
              )}
            </div>
          )}

          <StoriesList storyboards={storyboards} />
        </>
      )}
      {tab === "publish" && <PublishPanel publishableCount={finishedClips.length} />}

      {/* ── Outputs (persistent across tabs) ───────────────────────────────── */}
      <div className="mt-6 border-t border-[var(--color-line)] pt-5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] font-bold">Outputs</p>
          {standalone.length > 0 && (
            <div className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-0.5">
              {([
                ["all", "All", standalone.length],
                ["tests", "Tests", tests.length],
                ["cinematic", "Cinematic", cinematic.length],
              ] as const).map(([id, label, count]) => {
                const on = outFilter === id;
                return (
                  <button
                    key={id}
                    onClick={() => setOutFilter(id)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors"
                    style={{
                      background: on ? ACCENT : "transparent",
                      color: on ? "#fff" : "var(--color-ink-muted)",
                    }}
                  >
                    {label}
                    <span
                      className="rounded-full px-1.5 text-[10.5px] font-extrabold tabular-nums"
                      style={{
                        background: on ? "rgba(255,255,255,0.25)" : "var(--color-surface-2)",
                        color: on ? "#fff" : "var(--color-ink-muted)",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Model picker + render-all stills (KIE batch) */}
        {stills.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[13px]">
              <Film size={15} className="text-[var(--color-ink-muted)]" />
              <span className="font-semibold text-[var(--color-ink-muted)]">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as VideoProvider)}
                className="bg-transparent text-[13px] font-bold outline-none"
              >
                {VIDEO_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={renderAll}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Clapperboard size={14} />}
              Render {stills.length} still{stills.length > 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* Reel grid (filtered by tier) */}
        {standalone.length === 0 ? (
          <EmptyState
            icon={Play}
            title="Nothing here yet"
            hint="Generate copy or a draft above — your outputs queue here."
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Play}
            title={outFilter === "cinematic" ? "No cinematic finals yet" : "No tests yet"}
            hint={
              outFilter === "cinematic"
                ? "Upgrade a winning draft to Cinematic and it lands here."
                : "Generate a Draft or Motion above — your cheap tests queue here."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shown.map((c) => (
              <ReelTile key={c.id} c={c} onClick={() => setReview(c)} />
            ))}
          </div>
        )}

        {note && (
          <p className="mt-3 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
            {note}
          </p>
        )}
      </div>

      {/* ── Creative review ─────────────────────────────────────────────── */}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        accent={ACCENT}
        title={<span className="truncate">Creative review</span>}
      >
        {review && (
          <div className="flex flex-col gap-4">
            {/* Visual */}
            <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[#10151B]">
              {review.video_url ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={review.video_url}
                  poster={posterFor(review.video_url)}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="aspect-[9/16] w-full bg-black object-contain"
                />
              ) : review.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={review.image_url}
                  alt={review.hook_text}
                  className="aspect-[9/16] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[9/16] place-items-center text-[13px] text-white/60">
                  {isRendering(review) ? "Rendering…" : "No still generated yet"}
                </div>
              )}
            </div>

            {/* Status + meta chips */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="win">
                <CheckCircle2 size={12} /> Compliant
              </Badge>
              {review.video_url ? (
                <Badge tone="publish">Video · {providerLabel(review.video_provider)}</Badge>
              ) : isRendering(review) ? (
                <Badge tone="decode">Rendering · {providerLabel(review.video_provider)}</Badge>
              ) : review.video_status === "failed" ? (
                <Badge tone="danger">Render failed</Badge>
              ) : (
                <Badge tone="neutral">Still</Badge>
              )}
              {review.brand_slug && <Badge tone="rebuild">{review.brand_slug}</Badge>}
              {review.vertical && <Badge tone="neutral">{verticalLabel(review.vertical)}</Badge>}
            </div>

            {/* Copy blocks */}
            <div className="flex flex-col gap-2.5">
              <CopyBlock label="Hook" text={review.hook_text} />
              {review.bridge_text && <CopyBlock label="Bridge" text={review.bridge_text} />}
              {review.cta_text && <CopyBlock label="CTA" text={review.cta_text} />}
            </div>

            {review.image_prompt && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Image prompt
                </p>
                <p className="rounded-xl bg-[var(--color-surface-2)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
                  {review.image_prompt}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {!review.video_url && (
                <>
                  {/* Cheap-first: render a 9:16 draft with Remotion for cents — no KIE credits. */}
                  <button
                    onClick={() => draft(review.id)}
                    disabled={(pending && busyId === review.id) || isRendering(review)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
                    style={{ background: ACCENT }}
                    title="Render a 9:16 draft with Remotion — no AI-video credits"
                  >
                    {pending && busyId === review.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} />
                    )}
                    Make test video
                  </button>
                  {/* Expensive AI-video path (KIE), demoted to secondary. */}
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as VideoProvider)}
                    className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-2.5 text-[13px] font-bold outline-none"
                  >
                    {VIDEO_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => render(review.id, model)}
                    disabled={(pending && busyId === review.id) || isRendering(review)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3.5 py-2.5 text-[13px] font-bold disabled:opacity-60"
                    style={{ color: ACCENT }}
                  >
                    {(pending && busyId === review.id) || isRendering(review) ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Clapperboard size={14} />
                    )}
                    {isRendering(review) ? "Rendering…" : "Render AI video"}
                  </button>
                </>
              )}
              {/* Upgrade a finished cheap draft → accurate Cinematic (recipe review + confirm). */}
              {review.video_url && review.render_mode === "draft" && (
                <button
                  onClick={() => openUpgrade(review)}
                  disabled={cineBuilding || cineRendering}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
                  style={{ background: ACCENT }}
                  title="Reuse this tested draft's recipe + frames to render a full-AI Cinematic version"
                >
                  {cineBuilding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Upgrade to Cinematic…
                </button>
              )}
              {(review.image_url || review.video_url) && (
                <a
                  href={withDownload(
                    review.video_url || review.image_url || "#",
                    `creative-${review.id}.${review.video_url ? "mp4" : "png"}`,
                  )}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3.5 py-2.5 text-[13px] font-semibold"
                >
                  <Download size={14} /> Download
                </a>
              )}
              <button
                onClick={() => del(review.id)}
                disabled={pending && busyId === review.id}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-danger-soft)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-danger)] disabled:opacity-50"
              >
                <Trash2 size={14} /> {pending && busyId === review.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Cinematic upgrade review (recipe + cost + explicit confirm) ─────── */}
      <Modal
        open={!!cineFor}
        onClose={() => {
          if (cineRendering) return;
          setCineFor(null);
          setCinePlan(null);
        }}
        accent={ACCENT}
        title={<span>Upgrade to Cinematic</span>}
      >
        {cineBuilding || !cinePlan ? (
          <div className="grid place-items-center gap-2 py-12 text-[13px] text-[var(--color-ink-muted)]">
            <Loader2 size={22} className="animate-spin" /> Building cinematic recipe…
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[12.5px] leading-relaxed text-[var(--color-ink-muted)]">
              Same script &amp; structure as your tested draft — every scene rendered as full AI and
              seeded from its own frames so it matches the look. Edit anything below; <b>nothing renders
              until you confirm.</b>
            </p>

            <SceneRecipe plan={cinePlan} onChange={setCinePlan} aiEnabled hideTotal />

            <label className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-[13px]">
              <Film size={15} className="text-[var(--color-ink-muted)]" />
              <span className="font-semibold text-[var(--color-ink-muted)]">AI model</span>
              <select
                value={cineProvider}
                onChange={(e) => setCineProvider(e.target.value as VideoProvider)}
                className="ml-auto bg-transparent text-[13px] font-bold outline-none"
              >
                {VIDEO_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            {note && (
              <p className="rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
                {note}
              </p>
            )}

            {(() => {
              const aiCount = cinePlan.scenes.filter((s) => s.renderMethod === "ai_motion").length;
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCineFor(null);
                      setCinePlan(null);
                    }}
                    disabled={cineRendering}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-3.5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmCinematic}
                    disabled={cineRendering || aiCount === 0}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
                    style={{ background: ACCENT }}
                  >
                    {cineRendering ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    Render cinematic · ~${aiCount}.00
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* One vertical reel tile in the outputs grid. */
function ReelTile({ c, onClick }: { c: Creative; onClick: () => void }) {
  const rendering = isRendering(c);
  const elapsed = useRenderElapsed(rendering, c.created_at);
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-[#10151B] text-left"
    >
      {c.video_url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={`${c.video_url}#t=0.1`}
          poster={posterFor(c.video_url)}
          muted
          loop
          playsInline
          preload="metadata"
          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
          className="h-full w-full object-cover"
        />
      ) : c.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image_url} alt={c.hook_text} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center p-3">
          <AdThumb src={null} name={c.hook_text} size={44} />
        </div>
      )}

      {/* Rendering "alive" overlay: diagonal sweep + pulsing brand glow */}
      {rendering && (
        <span className="de-render-sweep pointer-events-none absolute inset-0">
          <span className="absolute inset-x-0 bottom-0 h-1/3 animate-pulse bg-gradient-to-t from-[rgba(23,46,215,0.45)] to-transparent" />
        </span>
      )}

      {/* Top badges */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1">
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-bold"
          style={{
            background: isCinematic(c) ? "rgba(23,46,215,0.85)" : "rgba(0,0,0,0.55)",
            color: "#fff",
          }}
        >
          {tierLabel(c)}
        </span>
        {rendering && (
          <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums" style={{ background: "rgba(23,46,215,0.85)", color: "#fff" }}>
            <Loader2 size={9} className="animate-spin" /> Rendering {fmtElapsed(elapsed)}
          </span>
        )}
        {c.video_status === "failed" && (
          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "rgba(220,38,38,0.85)", color: "#fff" }}>
            Failed
          </span>
        )}
        {c.video_url && (
          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "rgba(240,255,65,0.9)", color: "#10151B" }}>
            Video
          </span>
        )}
      </div>

      {/* Rendering shimmer */}
      {rendering && !c.image_url && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 size={22} className="animate-spin text-white/70" />
        </div>
      )}

      {/* Resting scrim — hook + gradient stay visible so a tile always reads as a
          branded card (never a bare black box), even before the poster/video paints.
          The play affordance fades in on hover. */}
      {!rendering && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/15 to-transparent p-2.5">
          {c.video_url && (
            <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--color-publish)] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
              <Play size={18} className="text-white" fill="currentColor" />
            </span>
          )}
          <p className="line-clamp-2 text-[11.5px] font-bold leading-snug text-white">{c.hook_text}</p>
          <p className="mt-0.5 text-[10px] text-white/70">
            {c.video_provider ? providerLabel(c.video_provider) : c.brand_slug || "draft"}
          </p>
        </div>
      )}
    </button>
  );
}

/* Labelled copy block for the review modal. */
function CopyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className="whitespace-pre-wrap rounded-xl bg-[var(--color-surface-2)] px-3.5 py-3 text-[13.5px] font-semibold leading-relaxed">
        {text}
      </p>
    </div>
  );
}
