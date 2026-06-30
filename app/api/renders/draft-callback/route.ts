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

  let body: { creativeId?: string; video_url?: string; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { creativeId, video_url } = body;
  if (!creativeId) return NextResponse.json({ error: "creativeId required" }, { status: 400 });

  try {
    const sb = getServiceClient();
    const ready = Boolean(video_url);
    const { data, error } = await sb
      .from("ad_creatives")
      .update(
        ready
          ? { video_url, video_status: "ready" }
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
