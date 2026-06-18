import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { isMachineAuthed } from "@/lib/machine-auth";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pull the REAL ad creative for an ad: re-token its render_ad URL and hand it to
 * the scraper (headless Chromium), which extracts the fbcdn media, stores it, and
 * returns the URL. Cached on spy_ads.creative_media_url after the first fetch.
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthed()) && !isMachineAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scraper = process.env.SCRAPER_URL;
  if (!scraper) return NextResponse.json({ error: "SCRAPER_URL not configured" }, { status: 503 });
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "META_ACCESS_TOKEN not configured" }, { status: 503 });

  const { ad_id } = (await req.json()) as { ad_id?: string };
  if (!ad_id) return NextResponse.json({ error: "ad_id required" }, { status: 400 });

  const sb = getServiceClient();
  const { data } = await sb
    .from("spy_ads")
    .select("id, ad_snapshot_url, creative_media_url, creative_media_type")
    .eq("id", ad_id)
    .single();
  const ad = data as {
    ad_snapshot_url: string | null;
    creative_media_url: string | null;
    creative_media_type: string | null;
  } | null;
  if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 });

  if (ad.creative_media_url) {
    return NextResponse.json({ media_url: ad.creative_media_url, media_type: ad.creative_media_type });
  }
  if (!ad.ad_snapshot_url) {
    return NextResponse.json({ error: "No snapshot URL for this ad" }, { status: 400 });
  }

  let renderUrl: string;
  try {
    const u = new URL(ad.ad_snapshot_url);
    u.searchParams.set("access_token", token);
    renderUrl = u.toString();
  } catch {
    return NextResponse.json({ error: "Invalid snapshot URL" }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.SCRAPE_SECRET) headers["x-scrape-key"] = process.env.SCRAPE_SECRET;
    const res = await fetch(`${scraper.replace(/\/$/, "")}/scrape`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: renderUrl, ad_id }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      media_url?: string;
      media_type?: string;
      error?: string;
    };
    if (!res.ok || json.error) {
      return NextResponse.json({ error: json.error || `Scraper HTTP ${res.status}` }, { status: 502 });
    }
    if (json.media_url) {
      await sb
        .from("spy_ads")
        .update({ creative_media_url: json.media_url, creative_media_type: json.media_type ?? null })
        .eq("id", ad_id);
    }
    return NextResponse.json({ media_url: json.media_url ?? null, media_type: json.media_type ?? null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scrape failed" },
      { status: 500 }
    );
  }
}
