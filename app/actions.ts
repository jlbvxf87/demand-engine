"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";

/* ──────────────────────────────────────────────────────────────────────────
   Server actions = the factory's "live" buttons. They call the existing,
   ported /api/spy/* routes server-side (machine-auth, no secrets exposed,
   no logic duplicated). Requires MACHINE_API_KEY in env (present in Vercel).
   Each returns { ok, ... } and never throws to the client.
   ────────────────────────────────────────────────────────────────────────── */

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type ActionResult = { ok: boolean; data?: unknown; error?: string };

async function callRoute(path: string, body: unknown): Promise<ActionResult> {
  const key = process.env.MACHINE_API_KEY;
  if (!key) {
    return {
      ok: false,
      error: "MACHINE_API_KEY not set — add it to env to enable live actions.",
    };
  }
  try {
    const res = await fetch(`${await baseUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (json as { error?: string }).error || `HTTP ${res.status}` };
    }
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}

/** Source: pull fresh winners from the Meta Ad Library. */
export async function searchAds(keyword: string): Promise<ActionResult> {
  const r = await callRoute("/api/spy/search", { keyword });
  if (r.ok) revalidatePath("/source");
  return r;
}

/** Decode: crawl a winning ad's destination page (fills page_* + hook patterns). */
export async function decodeAd(adId: string): Promise<ActionResult> {
  const r = await callRoute("/api/spy/crawl", { ad_id: adId });
  if (r.ok) revalidatePath("/decode");
  return r;
}

/** Rebuild: generate original copy in the same angle (hooks / ugc_script). */
export async function generateCopy(
  adId: string,
  generationType: "hooks" | "ugc_script" = "hooks"
): Promise<ActionResult> {
  return callRoute("/api/spy/generate", { ad_id: adId, generation_type: generationType });
}

/** Rebuild: generate an on-brand still and persist it to ad_creatives. */
export async function generateImage(adId: string): Promise<ActionResult> {
  const r = await callRoute("/api/spy/generate-image", { ad_id: adId });
  if (r.ok) {
    revalidatePath("/rebuild");
    revalidatePath("/publish");
  }
  return r;
}

type Hook = { hook?: string; bridge?: string; cta?: string };

/**
 * Rebuild — the real loop. The /api/spy/generate + /generate-image routes only
 * RETURN data (they don't persist), so this action generates copy + a still,
 * then writes ad_creatives rows itself. That's what makes Rebuild output show up
 * in Rebuild's grid and the Publish queue.
 */
export async function generateCreatives(
  adId: string,
  brandSlug: string | null,
  variants = 3
): Promise<ActionResult> {
  // 1. original copy (10 hooks in the same psychological angle)
  const copy = await callRoute("/api/spy/generate", {
    ad_id: adId,
    generation_type: "hooks",
  });
  if (!copy.ok) return copy;
  const hooks = (((copy.data as { result?: { hooks?: Hook[] } })?.result?.hooks) ??
    []) as Hook[];
  if (hooks.length === 0) return { ok: false, error: "No hooks generated" };

  // 2. one on-brand still (attached to the hero variant)
  const img = await callRoute("/api/spy/generate-image", { ad_id: adId });
  const imageUrl = img.ok
    ? ((img.data as { image_url?: string })?.image_url ?? null)
    : null;
  const imagePrompt = img.ok
    ? ((img.data as { prompt?: string })?.prompt ?? null)
    : null;

  // 3. persist the variants
  try {
    const sb = getServiceClient();
    const { data: ad } = await sb
      .from("spy_ads")
      .select("vertical")
      .eq("id", adId)
      .single();
    const vertical = (ad as { vertical?: string } | null)?.vertical ?? null;

    const rows = hooks.slice(0, Math.max(1, variants)).map((h, i) => ({
      brand_slug: brandSlug,
      vertical,
      hook_type: "rebuild",
      hook_text: h.hook ?? "(untitled)",
      bridge_text: h.bridge ?? null,
      cta_text: h.cta ?? null,
      all_hooks: hooks,
      image_prompt: imagePrompt,
      image_url: i === 0 ? imageUrl : null,
      platform: "meta",
      creative_type: "composite",
      inspired_by: adId,
    }));

    const { error } = await sb.from("ad_creatives").insert(rows);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/rebuild");
    revalidatePath("/publish");
    return { ok: true, data: { created: rows.length, image: Boolean(imageUrl) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Persist failed" };
  }
}

/** Decode: synthesize the intelligence brief for a search. */
export async function synthesizeBrief(searchId: string): Promise<ActionResult> {
  const r = await callRoute("/api/spy/synthesize", { search_id: searchId });
  if (r.ok) revalidatePath("/decode");
  return r;
}

/**
 * Rebuild → T2V handoff. Submits a render job to the separate T2V engine
 * (POST {T2V_ENGINE_URL}/api/jobs/create), stores t2v_job_id, flips
 * video_status to 'queued'. The engine's webhook later fills video_url
 * via /api/creatives/video-callback.
 */
export async function renderVideo(creativeId: string): Promise<ActionResult> {
  const t2vBase = process.env.T2V_ENGINE_URL;
  if (!t2vBase) {
    return { ok: false, error: "T2V_ENGINE_URL not set — add it to enable video render." };
  }

  try {
    const sb = getServiceClient();
    const { data: c } = await sb
      .from("ad_creatives")
      .select("id, brand_slug, vertical, hook_text, bridge_text, cta_text, image_url")
      .eq("id", creativeId)
      .single();
    if (!c) return { ok: false, error: "Creative not found" };

    const cr = c as {
      brand_slug: string | null;
      vertical: string | null;
      hook_text: string;
      bridge_text: string | null;
      cta_text: string | null;
      image_url: string | null;
    };

    // brand voice → on-brand prompt
    let voice = "";
    if (cr.brand_slug) {
      const { data: b } = await sb
        .from("brands")
        .select("brand_voice")
        .eq("slug", cr.brand_slug)
        .single();
      voice = (b as { brand_voice?: string } | null)?.brand_voice || "";
    }

    const prompt = [
      cr.hook_text,
      cr.bridge_text,
      cr.cta_text ? `CTA: ${cr.cta_text}.` : "",
      voice ? `Brand voice: ${voice}.` : "",
      "UGC testimonial style, vertical 9:16. Compliant — no therapeutic or guaranteed-outcome claims.",
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 2000);

    const hasImage = Boolean(cr.image_url);
    const body = {
      prompt,
      user_id: cr.brand_slug || "demand-engine",
      provider: "seedance",
      duration_target: 9,
      mode: hasImage ? "image-to-video" : "text-to-video",
      reference_image_url: hasImage ? cr.image_url : null,
      intel_enabled: false, // our ad-library R&D drives the prompt, not T2V's scraper
      webhook_url: `${await baseUrl()}/api/creatives/video-callback`,
      metadata: { ad_creative_id: creativeId, brand_slug: cr.brand_slug },
    };

    const res = await fetch(`${t2vBase.replace(/\/$/, "")}/api/jobs/create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
    };
    if (!res.ok || !json.id) {
      return { ok: false, error: json.error || `T2V HTTP ${res.status}` };
    }

    await sb
      .from("ad_creatives")
      .update({ t2v_job_id: json.id, video_status: "queued" })
      .eq("id", creativeId);

    revalidatePath("/rebuild");
    revalidatePath("/publish");
    return { ok: true, data: { job_id: json.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Render submit failed" };
  }
}
