import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Draft-render worker callback. The worker POSTs when an MP4 is rendered + uploaded:
 *   { creativeId, video_url }   (send `error` instead on failure)
 * Gated by ?key=<DRAFT_WEBHOOK_SECRET>. Flips the creative to ready / failed.
 */
export async function POST(req: Request) {
  const secret = process.env.DRAFT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Draft callback not configured" }, { status: 503 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    creativeId?: string;
    video_url?: string;
    error?: string;
    seedFrames?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { creativeId, video_url, seedFrames } = body;
  if (!creativeId) return NextResponse.json({ error: "creativeId required" }, { status: 400 });

  try {
    const sb = getServiceClient();
    const ready = Boolean(video_url);

    // Merge captioned-less seed stills onto the plan's scenes so a Cinematic
    // upgrade can seed image-to-video from each scene's tested look.
    let renderPlanUpdate: Record<string, unknown> = {};
    if (ready && seedFrames && Object.keys(seedFrames).length > 0) {
      const { data: row } = await sb
        .from("ad_creatives")
        .select("render_plan_json")
        .eq("id", creativeId)
        .single();
      const plan = (row as { render_plan_json?: { scenes?: { seedFrameUrl?: string }[] } } | null)
        ?.render_plan_json;
      if (plan && Array.isArray(plan.scenes)) {
        plan.scenes = plan.scenes.map((s, i) =>
          seedFrames[String(i)] ? { ...s, seedFrameUrl: seedFrames[String(i)] } : s,
        );
        renderPlanUpdate = { render_plan_json: plan };
      }
    }

    const { data, error } = await sb
      .from("ad_creatives")
      .update(
        ready
          ? { video_url, video_status: "ready", ...renderPlanUpdate }
          : { video_status: "failed" },
      )
      .eq("id", creativeId)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, matched: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Callback failed" },
      { status: 500 },
    );
  }
}
