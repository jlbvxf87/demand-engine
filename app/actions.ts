"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/server";
import { submitKieVideo, pollKieVideo, isVideoProvider } from "@/lib/kie";

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
 * Rebuild/Publish → video render, direct to kie.ai (no separate engine).
 * Submits the chosen model's job, stores the kie taskId + provider, flips
 * video_status to 'rendering'. kie is poll-based, so pollVideoJobs() (driven
 * by the Studio UI) later fills video_url.
 */
export async function renderVideo(
  creativeId: string,
  provider = "seedance"
): Promise<ActionResult> {
  if (!isVideoProvider(provider)) {
    return { ok: false, error: `Unknown model: ${provider}` };
  }
  try {
    const sb = getServiceClient();
    const { data: c } = await sb
      .from("ad_creatives")
      .select("id, brand_slug, hook_text, bridge_text, cta_text, image_url")
      .eq("id", creativeId)
      .single();
    if (!c) return { ok: false, error: "Creative not found" };

    const cr = c as {
      brand_slug: string | null;
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
      .join(" ");

    const hasImage = Boolean(cr.image_url);
    const { taskId } = await submitKieVideo({
      provider,
      prompt,
      mode: hasImage ? "image-to-video" : "text-to-video",
      referenceImageUrls: cr.image_url ? [cr.image_url] : null,
      duration: 9,
    });

    await sb
      .from("ad_creatives")
      .update({
        t2v_job_id: taskId,
        video_provider: provider,
        video_status: "rendering",
        video_url: null,
      })
      .eq("id", creativeId);

    revalidatePath("/rebuild");
    revalidatePath("/publish");
    return { ok: true, data: { task_id: taskId, provider } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Render submit failed" };
  }
}

/**
 * Poll every in-progress kie job and persist results. Called on an interval by
 * the Studio while any creative is rendering. Returns how many flipped state.
 */
export async function pollVideoJobs(): Promise<ActionResult> {
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from("ad_creatives")
      .select("id, t2v_job_id, video_provider, video_status")
      .in("video_status", ["queued", "rendering"])
      .not("t2v_job_id", "is", null);

    const rows = (data || []) as {
      id: string;
      t2v_job_id: string;
      video_provider: string | null;
      video_status: string;
    }[];

    let updated = 0;
    for (const row of rows) {
      if (!row.video_provider || !isVideoProvider(row.video_provider)) continue;
      try {
        const r = await pollKieVideo(row.video_provider, row.t2v_job_id);
        if (r.state === "completed" && r.videoUrl) {
          await sb
            .from("ad_creatives")
            .update({ video_url: r.videoUrl, video_status: "ready" })
            .eq("id", row.id);
          updated++;
        } else if (r.state === "failed") {
          await sb.from("ad_creatives").update({ video_status: "failed" }).eq("id", row.id);
          updated++;
        }
      } catch {
        // transient — leave it queued, retry next tick
      }
    }

    if (updated) {
      revalidatePath("/publish");
      revalidatePath("/rebuild");
    }
    return { ok: true, data: { pending: rows.length, updated } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Poll failed" };
  }
}

/** Upload a reference image to storage; returns its public URL for kie to fetch. */
export async function uploadReference(
  formData: FormData
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "No file provided" };
    if (file.size > 50 * 1024 * 1024) return { ok: false, error: "File too large (max 50MB)" };
    const type = file.type || "image/png";
    const ext = (type.split("/")[1] || "png").replace("jpeg", "jpg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const sb = getServiceClient();
    const { error } = await sb.storage
      .from("ad-references")
      .upload(path, buf, { contentType: type, upsert: false });
    if (error) return { ok: false, error: error.message };
    const { data } = sb.storage.from("ad-references").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}

/**
 * Replicate-from-reference: a reference image (+ optional guide images) and an
 * instruction prompt → N image-to-video variations via kie. Each variant is an
 * ad_creatives row that renders live in the Studio (reference shown as the still
 * until its video lands).
 */
export async function replicate(input: {
  referenceUrls: string[];
  prompt: string;
  provider?: string;
  count?: number;
}): Promise<ActionResult> {
  const provider = input.provider ?? "seedance";
  if (!isVideoProvider(provider)) return { ok: false, error: `Unknown model: ${provider}` };
  const refs = (input.referenceUrls || []).filter(Boolean);
  if (refs.length === 0) return { ok: false, error: "A reference image is required" };
  const prompt = (input.prompt || "").trim();
  if (!prompt) return { ok: false, error: "An instruction prompt is required" };
  const count = Math.max(1, Math.min(6, input.count ?? 3));

  try {
    const sb = getServiceClient();
    let created = 0;
    for (let i = 0; i < count; i++) {
      const { data: row } = await sb
        .from("ad_creatives")
        .insert({
          hook_text: prompt.slice(0, 200),
          image_prompt: prompt,
          image_url: refs[0],
          hook_type: "replicate",
          platform: "meta",
          creative_type: "replicate",
          video_status: "rendering",
          video_provider: provider,
        })
        .select("id")
        .single();
      const id = (row as { id: string } | null)?.id;
      if (!id) continue;
      try {
        const { taskId } = await submitKieVideo({
          provider,
          prompt,
          mode: "image-to-video",
          referenceImageUrls: refs,
          duration: 9,
        });
        await sb.from("ad_creatives").update({ t2v_job_id: taskId }).eq("id", id);
        created++;
      } catch {
        await sb.from("ad_creatives").update({ video_status: "failed" }).eq("id", id);
      }
    }
    revalidatePath("/publish");
    if (created === 0) return { ok: false, error: "All variants failed to submit" };
    return { ok: true, data: { created } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Replicate failed" };
  }
}
