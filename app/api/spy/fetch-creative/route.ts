import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { isMachineAuthed } from "@/lib/machine-auth";
import { scrapeAndStoreCreative } from "@/lib/scrape";

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

  const { ad_id } = (await req.json()) as { ad_id?: string };
  if (!ad_id) return NextResponse.json({ error: "ad_id required" }, { status: 400 });

  const r = await scrapeAndStoreCreative(ad_id);
  if (!r.ok) {
    const status = r.error.includes("not configured") ? 503 : r.error === "Ad not found" ? 404 : 502;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json({ media_url: r.media_url, media_type: r.media_type });
}
