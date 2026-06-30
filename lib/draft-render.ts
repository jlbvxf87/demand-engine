import "server-only";

import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { DRAFT_COMPOSITION_ID, type DraftRenderPlan } from "../remotion/types";

export type DraftRenderResult = { ok: boolean; localPath?: string; error?: string };

/** True when an external render worker is configured (prod). When set, renders
 *  are offloaded to it instead of running inline (Vercel can't run Remotion). */
export function draftWorkerConfigured(): boolean {
  return !!process.env.DRAFT_WORKER_URL;
}

/**
 * Hand a render-plan to the external draft-render-worker. It renders + uploads to
 * Supabase and POSTs back to `${origin}/api/renders/draft-callback`. Mirrors the
 * stitch-worker dispatch. Throws if the worker rejects the job.
 */
export async function dispatchToWorker(
  plan: DraftRenderPlan,
  creativeId: string,
  origin: string,
): Promise<void> {
  const base = process.env.DRAFT_WORKER_URL;
  if (!base) throw new Error("DRAFT_WORKER_URL not set");
  const secret = process.env.DRAFT_WEBHOOK_SECRET || "";
  const callbackUrl = `${origin}/api/renders/draft-callback${secret ? `?key=${encodeURIComponent(secret)}` : ""}`;
  const res = await fetch(`${base.replace(/\/$/, "")}/render`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-secret": secret },
    body: JSON.stringify({ plan, creativeId, callbackUrl }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`render worker HTTP ${res.status}`);
}

// Bundle the Remotion entry once per server process — bundling is the slow part,
// so every render after the first reuses the cached serve URL.
let bundlePromise: Promise<string> | null = null;
function getServeUrl(): Promise<string> {
  if (!bundlePromise) {
    const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
    bundlePromise = bundle({ entryPoint }).catch((e) => {
      bundlePromise = null; // let a later call retry a failed bundle
      throw e;
    });
  }
  return bundlePromise;
}

/**
 * Re-encode for web (faststart, yuv420p) with ffmpeg if it's on PATH. Returns
 * the normalized path, or the original on any failure — the raw Remotion MP4 is
 * already a valid H.264 file, so this pass is purely an optimization.
 */
function normalize(input: string, output: string): Promise<string> {
  return new Promise((resolve) => {
    const args = [
      "-y",
      "-i", input,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      output,
    ];
    let proc;
    try {
      proc = spawn("ffmpeg", args, { stdio: "ignore" });
    } catch {
      return resolve(input);
    }
    proc.on("error", () => resolve(input)); // ffmpeg not installed
    proc.on("close", (code) => resolve(code === 0 ? output : input));
  });
}

/**
 * Render a DraftRenderPlan to a local MP4 via Remotion, then normalize with
 * ffmpeg. Pure compute + filesystem — no DB, no network beyond image fetches —
 * so it can later lift verbatim into a separate worker / Lambda.
 */
export async function renderDraftVideo(plan: DraftRenderPlan, id: string): Promise<DraftRenderResult> {
  try {
    await ensureBrowser();
    const serveUrl = await getServeUrl();
    const composition = await selectComposition({
      serveUrl,
      id: DRAFT_COMPOSITION_ID,
      inputProps: plan,
    });
    const tmp = os.tmpdir();
    const raw = path.join(tmp, `draft-${id}-raw.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: raw,
      inputProps: plan,
    });
    const out = await normalize(raw, path.join(tmp, `draft-${id}.mp4`));
    return { ok: true, localPath: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Draft render failed" };
  }
}
