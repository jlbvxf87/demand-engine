import http from "node:http";
import { renderPlan, renderSeedFrames } from "./render.mjs";
import { uploadMp4, uploadSeedFrame } from "./upload.mjs";

const PORT = process.env.PORT || 8080;
const SECRET = process.env.DRAFT_WORKER_SECRET || "";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) req.destroy(); // guard absurd payloads
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function postCallback(url, payload) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("callback failed:", e?.message);
  }
}

// Render → upload → call back. Runs in the background after we 202 the request.
// When captureSeeds is set (plain Draft renders), also capture a clean per-scene
// still and return it as seedFrames so a later Cinematic upgrade can seed image-to-video.
async function processJob({ plan, creativeId, callbackUrl, captureSeeds }) {
  const t0 = Date.now();
  try {
    const local = await renderPlan(plan, creativeId);
    const video_url = await uploadMp4(local, creativeId);

    let seedFrames;
    if (captureSeeds) {
      try {
        const files = await renderSeedFrames(plan, creativeId);
        seedFrames = {};
        for (const [idx, file] of Object.entries(files)) {
          try {
            seedFrames[idx] = await uploadSeedFrame(file, creativeId, idx);
          } catch (e) {
            console.error(`seed upload failed ${creativeId} s${idx}:`, e?.message);
          }
        }
      } catch (e) {
        console.error(`seed capture failed ${creativeId}:`, e?.message); // non-fatal
      }
    }

    console.log(`rendered ${creativeId} in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${video_url}`);
    if (callbackUrl) await postCallback(callbackUrl, { creativeId, video_url, seedFrames });
  } catch (e) {
    console.error(`render failed ${creativeId}:`, e?.message);
    if (callbackUrl) await postCallback(callbackUrl, { creativeId, error: e?.message || "render failed" });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  if (req.method === "POST" && req.url === "/render") {
    if (SECRET && req.headers["x-worker-secret"] !== SECRET) {
      res.writeHead(401).end("unauthorized");
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400).end("invalid json");
      return;
    }
    if (!body?.plan || !Array.isArray(body.plan.scenes) || !body?.creativeId) {
      res.writeHead(400).end("plan (with scenes) + creativeId required");
      return;
    }
    // Accept immediately; render in the background and call back when done.
    res.writeHead(202, { "content-type": "application/json" }).end(
      JSON.stringify({ ok: true, queued: body.creativeId }),
    );
    processJob(body);
    return;
  }
  res.writeHead(404).end("not found");
});

server.listen(PORT, () => console.log(`draft-render-worker listening on :${PORT}`));
