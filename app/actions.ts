"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

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

/** Decode: synthesize the intelligence brief for a search. */
export async function synthesizeBrief(searchId: string): Promise<ActionResult> {
  const r = await callRoute("/api/spy/synthesize", { search_id: searchId });
  if (r.ok) revalidatePath("/decode");
  return r;
}
