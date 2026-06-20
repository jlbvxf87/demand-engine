import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { persistVideoToStorage } from "@/lib/persist";
import { DEFAULT_VOICE } from "@/lib/video";

/* ──────────────────────────────────────────────────────────────────────────
   Spokesperson voice layer. Turns the copy we already generate into a real
   talking clip in two Kie jobs:
     1) TTS  — elevenlabs/text-to-dialogue-v3  → an mp3 of the exact script.
     2) LIP-SYNC — kling/ai-avatar-standard (image + that audio) → a video of
        the person speaking the script with synced lips.
   Both jobs use Kie's unified jobs API and the same poll/result shape as video.
   The two stages are driven asynchronously by advanceSpokesperson(), called
   from the client poll loop AND the sweep cron (so it advances tab-closed too).
   ────────────────────────────────────────────────────────────────────────── */

type SB = ReturnType<typeof getServiceClient>;

const KIE_BASE = (process.env.KIE_API_BASE_URL || "https://api.kie.ai").replace(/\/$/, "");
const TTS_MODEL = "elevenlabs/text-to-dialogue-v3";
const LIPSYNC_MODEL = "kling/ai-avatar-standard"; // ≤5min audio, 720p — robust to script length

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Submit a Kie job, retrying TRANSIENT failures (network/timeout, 429, 5xx —
 * incl. Kie's "internal error, please try again later") up to 3 attempts with
 * backoff. Surfaces 4xx validation errors immediately (they won't change).
 */
async function createTask(model: string, input: Record<string, unknown>): Promise<{ taskId: string }> {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY not set — add it to env to enable voice render.");
  const MAX = 3;
  let lastErr = "Kie submit failed";
  for (let attempt = 1; attempt <= MAX; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input }),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "network error";
      if (attempt < MAX) {
        await sleep(700 * attempt);
        continue;
      }
      throw new Error(`Kie submit failed after ${MAX} tries — ${lastErr}`);
    }
    const j = (await res.json().catch(() => ({}))) as {
      msg?: string; message?: string; data?: { taskId?: string };
    };
    const taskId = j?.data?.taskId;
    if (taskId) return { taskId };
    lastErr = j?.msg || j?.message || `Kie HTTP ${res.status}`;
    const transient = res.status === 429 || res.status >= 500;
    if (transient && attempt < MAX) {
      await sleep(700 * attempt);
      continue;
    }
    throw new Error(lastErr);
  }
  throw new Error(lastErr);
}

/** Submit a TTS job for `text`. Returns the Kie taskId to poll. */
export async function submitTTS(text: string, voice: string = DEFAULT_VOICE): Promise<{ taskId: string }> {
  const t = (text || "").replace(/\s+/g, " ").trim().slice(0, 4800);
  if (!t) throw new Error("No script to voice");
  return createTask(TTS_MODEL, { dialogue: [{ voice, text: t }] });
}

// kling/ai-avatar-standard REJECTS an empty prompt ("prompt is required", verified
// live), so a non-empty default is mandatory — it also guides expression/motion.
const DEFAULT_LIPSYNC_PROMPT =
  "A person speaking naturally and directly to the camera, subtle authentic expression, talking-head UGC style.";

/** Submit a lip-sync job: image + audio → talking video. Returns the taskId. */
export async function submitLipsync(
  imageUrl: string,
  audioUrl: string,
  prompt = "",
): Promise<{ taskId: string }> {
  const p = (prompt || "").trim().slice(0, 4800) || DEFAULT_LIPSYNC_PROMPT;
  return createTask(LIPSYNC_MODEL, {
    image_url: imageUrl,
    audio_url: audioUrl,
    prompt: p,
  });
}

type JobResult = { state: "processing" | "completed" | "failed"; url?: string; error?: string };

/** Poll a Kie unified job (TTS or lip-sync). Result URL is resultJson.resultUrls[0]. */
export async function pollKieJob(taskId: string): Promise<JobResult> {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY not set");
  const r = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as {
    data?: { state?: string; resultJson?: string; failMsg?: string };
  };
  const d = j?.data ?? {};
  if (d.state === "success") {
    let url: string | undefined;
    try {
      url = (JSON.parse(d.resultJson || "{}") as { resultUrls?: string[] })?.resultUrls?.[0];
    } catch {}
    return url ? { state: "completed", url } : { state: "failed", error: "no result url" };
  }
  if (d.state === "fail") return { state: "failed", error: d.failMsg || "failed" };
  return { state: "processing" };
}

// A spokesperson clip gets at most this many submit attempts across its life
// (initial + retries) before a failure is treated as terminal.
const MAX_SPOKES_ATTEMPTS = 3;

type SpokesRow = {
  id: string;
  render_stage: string | null;
  tts_job_id: string | null;
  t2v_job_id: string | null;
  image_url: string | null;
  image_prompt: string | null;
  vo_script: string | null;
  vo_audio_url: string | null;
  video_attempts: number | null;
  video_status: string;
};

/**
 * Advance every in-flight spokesperson render through its two stages, RESILIENT
 * to transient Kie failures. Stage 1 (tts): when the voice is ready, kick off the
 * lip-sync with the still + audio; if the TTS job failed transiently, re-submit
 * it (up to the attempt cap). Stage 2 (lipsync): when the talking video is ready,
 * persist + mark ready; if the lip-sync job failed transiently, re-submit it.
 * Only after attempts are exhausted is a clip marked failed. Each transition is a
 * compare-and-swap so the client loop and cron can both call this safely.
 */
export async function advanceSpokesperson(sb: SB): Promise<number> {
  let advanced = 0;
  const { data } = await sb
    .from("ad_creatives")
    .select(
      "id, render_stage, tts_job_id, t2v_job_id, image_url, image_prompt, vo_script, vo_audio_url, video_attempts, video_status",
    )
    .eq("video_provider", "spokesperson")
    .eq("video_status", "rendering")
    .in("render_stage", ["tts", "lipsync"]);
  const rows = (data || []) as SpokesRow[];

  const fail = async (id: string) => {
    await sb.from("ad_creatives").update({ video_status: "failed" }).eq("id", id);
    advanced++;
  };

  for (const r of rows) {
    const attempts = r.video_attempts ?? 1;
    const canRetry = attempts < MAX_SPOKES_ATTEMPTS;
    try {
      // ── Stage 1: TTS → kick off lip-sync ──────────────────────────────────
      if (r.render_stage === "tts" && r.tts_job_id) {
        const j = await pollKieJob(r.tts_job_id);

        if (j.state === "completed" && j.url) {
          if (!r.image_url) {
            await fail(r.id); // no face to lip-sync onto
            continue;
          }
          let lipsyncId: string;
          try {
            ({ taskId: lipsyncId } = await submitLipsync(r.image_url, j.url, r.image_prompt || ""));
          } catch {
            // submit blew up even after createTask's own retries — count an
            // attempt and let the next tick retry, or fail once exhausted.
            if (canRetry) await sb.from("ad_creatives").update({ video_attempts: attempts + 1 }).eq("id", r.id);
            else await fail(r.id);
            continue;
          }
          const { data: cas } = await sb
            .from("ad_creatives")
            .update({ render_stage: "lipsync", t2v_job_id: lipsyncId, vo_audio_url: j.url })
            .eq("id", r.id)
            .eq("render_stage", "tts")
            .select("id");
          if (cas && cas.length > 0) advanced++;
        } else if (j.state === "failed") {
          // TTS job failed (often a transient Kie "internal error"). Re-submit
          // the voiceover if we still have the script and attempts left.
          if (canRetry && r.vo_script) {
            const { taskId } = await submitTTS(r.vo_script);
            await sb
              .from("ad_creatives")
              .update({ tts_job_id: taskId, video_attempts: attempts + 1 })
              .eq("id", r.id)
              .eq("tts_job_id", r.tts_job_id)
              .eq("render_stage", "tts");
            advanced++;
          } else {
            await fail(r.id);
          }
        }
        continue;
      }

      // ── Stage 2: lip-sync → persist + ready ───────────────────────────────
      if (r.render_stage === "lipsync" && r.t2v_job_id) {
        const j = await pollKieJob(r.t2v_job_id);
        if (j.state === "completed" && j.url) {
          const permanent = (await persistVideoToStorage(j.url, r.id)) ?? j.url;
          const { data: cas } = await sb
            .from("ad_creatives")
            .update({ video_url: permanent, video_status: "ready", render_stage: null })
            .eq("id", r.id)
            .eq("video_status", "rendering")
            .select("id");
          if (cas && cas.length > 0) advanced++;
        } else if (j.state === "failed") {
          // Lip-sync job failed — re-submit it from the same audio + face if we
          // still have attempts left.
          if (canRetry && r.image_url && r.vo_audio_url) {
            const { taskId } = await submitLipsync(r.image_url, r.vo_audio_url, r.image_prompt || "");
            await sb
              .from("ad_creatives")
              .update({ t2v_job_id: taskId, video_attempts: attempts + 1 })
              .eq("id", r.id)
              .eq("t2v_job_id", r.t2v_job_id)
              .eq("render_stage", "lipsync");
            advanced++;
          } else {
            await fail(r.id);
          }
        }
      }
    } catch {
      // transient kie/network error — leave it, retry next tick.
    }
  }
  return advanced;
}
