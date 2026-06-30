import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const COMPOSITION_ID = "DraftAd";

// Bundle the Remotion composition once per process — bundling is the slow part.
let bundlePromise = null;
function getServeUrl() {
  if (!bundlePromise) {
    const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
    bundlePromise = bundle({ entryPoint }).catch((e) => {
      bundlePromise = null; // let a later call retry a failed bundle
      throw e;
    });
  }
  return bundlePromise;
}

// Re-encode for web (faststart, yuv420p) with ffmpeg; fall back to the raw file
// (already valid H.264) if ffmpeg isn't available or fails.
function normalize(input, output) {
  return new Promise((resolve) => {
    const args = [
      "-y", "-i", input,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      output,
    ];
    let proc;
    try {
      proc = spawn("ffmpeg", args, { stdio: "ignore" });
    } catch {
      return resolve(input);
    }
    proc.on("error", () => resolve(input));
    proc.on("close", (code) => resolve(code === 0 ? output : input));
  });
}

/** Render a DraftRenderPlan to a local MP4 (template scenes + any ai_motion clips). */
export async function renderPlan(plan, id) {
  await ensureBrowser();
  const serveUrl = await getServeUrl();
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: plan });
  const tmp = os.tmpdir();
  const raw = path.join(tmp, `draft-${id}-raw.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: raw, inputProps: plan });
  return normalize(raw, path.join(tmp, `draft-${id}.mp4`));
}
