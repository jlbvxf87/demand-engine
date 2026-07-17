import JSZip from "jszip";
import { getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Slugify a hook into a safe file stem. */
function slug(s: string | null | undefined): string {
  return (
    (s || "creative")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "creative"
  );
}

/**
 * Zip every finished creative's video into one download. The browser hits this
 * directly (a link/navigation), so it downloads a real .zip — sidestepping the
 * cross-origin `<a download>` limitation.
 */
export async function GET() {
  const sb = getServiceClient();
  const { data } = await sb
    .from("ad_creatives")
    .select("id, hook_text, video_url, creative_type")
    .eq("video_status", "ready")
    .not("video_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as { id: string; hook_text: string | null; video_url: string }[];

  const zip = new JSZip();
  const seen = new Set<string>();
  for (const r of rows) {
    try {
      const resp = await fetch(r.video_url, { cache: "no-store" });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      let name = `${slug(r.hook_text)}-${r.id.slice(0, 8)}.mp4`;
      while (seen.has(name)) name = `${slug(r.hook_text)}-${r.id.slice(0, 8)}-${seen.size}.mp4`;
      seen.add(name);
      // Videos are already compressed — STORE (no re-compression) keeps it fast.
      zip.file(name, buf, { compression: "STORE" });
    } catch {
      // skip a fetch failure — the rest of the zip still ships
    }
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(out as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="demand-engine-creatives-${stamp}.zip"`,
      "cache-control": "no-store",
    },
  });
}
