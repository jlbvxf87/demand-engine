import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false } },
);

/** Upload the rendered MP4 to the same Supabase bucket/path the app reads from. */
export async function uploadMp4(localPath, id) {
  const buffer = await readFile(localPath);
  if (buffer.byteLength < 1024) throw new Error("empty render");
  const objectPath = `generated/${id}.mp4`;
  const { error } = await sb.storage
    .from("ad-creatives")
    .upload(objectPath, buffer, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = sb.storage.from("ad-creatives").getPublicUrl(objectPath);
  return data.publicUrl;
}

/** Upload a first-frame poster (JPG) by convention: generated/<id>-poster.jpg. */
export async function uploadPoster(localPath, id) {
  const buffer = await readFile(localPath);
  if (buffer.byteLength < 256) throw new Error("empty poster");
  const objectPath = `generated/${id}-poster.jpg`;
  const { error } = await sb.storage
    .from("ad-creatives")
    .upload(objectPath, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = sb.storage.from("ad-creatives").getPublicUrl(objectPath);
  return data.publicUrl;
}

/** Upload a captionless seed still (PNG) for a scene; returns its public URL. */
export async function uploadSeedFrame(localPath, id, sceneIndex) {
  const buffer = await readFile(localPath);
  if (buffer.byteLength < 256) throw new Error("empty seed frame");
  const objectPath = `generated/${id}-seed-s${sceneIndex}.png`;
  const { error } = await sb.storage
    .from("ad-creatives")
    .upload(objectPath, buffer, { contentType: "image/png", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = sb.storage.from("ad-creatives").getPublicUrl(objectPath);
  return data.publicUrl;
}
