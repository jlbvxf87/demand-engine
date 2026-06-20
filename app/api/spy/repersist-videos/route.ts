import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { isMachineAuthed } from "@/lib/machine-auth";
import { getServiceClient } from "@/lib/supabase/server";
import { persistVideoToStorage } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_BATCH = 20;
const MAX_BATCH = 40;
const CONCURRENCY = 4;

// Generated videos are produced on Kie's temporary CDN. We normally persist them
// to Supabase storage inline at generation time, but that inline copy can fail
// transiently — leaving a row pointing at a temp URL that will 404 once it
// expires. This is the substring that identifies those temp URLs.
const TEMP_CDN_MATCH = "%tempfile.aiquickdraw.com%";

/** Vercel cron hits this with `Authorization: Bearer <CRON_SECRET>`. */
function isCronAuthed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Re-mirror generated videos still hosted on Kie's temporary CDN
 * (tempfile.aiquickdraw.com) into permanent Supabase storage, closing the
 * durability gap when the inline persist transiently failed. Cron-driven so
 * temp URLs get rescued before they expire (and 404); also runnable on demand
 * (admin cookie or machine key).
 */
async function run(req: Request) {
  if (!isCronAuthed(req) && !isMachineAuthed(req) && !(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_BATCH));

  const sb = getServiceClient();

  const { data, error } = await sb
    .from("ad_creatives")
    .select("id, video_url")
    .ilike("video_url", TEMP_CDN_MATCH)
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { id: string; video_url: string }[];

  let repersisted = 0;
  await mapLimit(rows, CONCURRENCY, async (r) => {
    const permanent = await persistVideoToStorage(r.video_url, r.id);
    if (permanent) {
      await sb.from("ad_creatives").update({ video_url: permanent }).eq("id", r.id);
      repersisted++;
    }
  });

  // How many are still on the temp CDN after this run (for visibility / scheduling).
  const { count: remaining } = await sb
    .from("ad_creatives")
    .select("id", { count: "exact", head: true })
    .ilike("video_url", TEMP_CDN_MATCH);

  return NextResponse.json({
    processed: rows.length,
    repersisted,
    remaining: remaining ?? null,
  });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
