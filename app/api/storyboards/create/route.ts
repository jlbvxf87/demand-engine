import { NextResponse } from "next/server";
import { isMachineAuthed } from "@/lib/machine-auth";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createStoryboard } from "@/app/actions";

// Programmatic storyboard creation (e.g. verbatim per-scene scripts) — used to
// kick off a run with exact lines/shots without going through the UI. Auth-gated.
export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  imageUrls?: string[];
  prompt?: string;
  provider?: string;
  durationPerClip?: number;
  sceneCount?: number;
  autoStitch?: boolean;
  scenes?: { voiceover: string; shot_type?: "talking_head" | "broll"; scene_prompt?: string; onScreen?: string }[];
};

export async function POST(req: Request) {
  if (!isMachineAuthed(req) && !(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const r = await createStoryboard({
    imageUrls: body.imageUrls,
    prompt: body.prompt ?? "",
    provider: body.provider,
    durationPerClip: body.durationPerClip,
    sceneCount: body.sceneCount,
    autoStitch: body.autoStitch,
    scenes: body.scenes,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
