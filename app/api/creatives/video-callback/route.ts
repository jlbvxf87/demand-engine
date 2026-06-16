import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * T2V engine webhook. The engine's `notify` stage POSTs on completion:
 *   { event: 'job.completed', job_id, video_url, prompt, provider }
 * We map job_id → ad_creatives.t2v_job_id and write the signed MP4.
 *
 * Auth: the t2v_job_id (a UUID we stored at submit time) is the shared secret —
 * an unknown job_id matches no row. Optionally also require ?key=<T2V_WEBHOOK_SECRET>.
 */
export async function POST(req: Request) {
  const secret = process.env.T2V_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    if (url.searchParams.get("key") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { event?: string; job_id?: string; video_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, video_url } = body;
  if (!job_id) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  try {
    const sb = getServiceClient();
    const ready = Boolean(video_url);
    const { data, error } = await sb
      .from("ad_creatives")
      .update({
        video_url: video_url ?? null,
        video_status: ready ? "ready" : "failed",
      })
      .eq("t2v_job_id", job_id)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      // No matching creative — ack anyway so the engine doesn't retry forever.
      return NextResponse.json({ ok: true, matched: 0 });
    }
    return NextResponse.json({ ok: true, matched: data.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Callback failed" },
      { status: 500 }
    );
  }
}
