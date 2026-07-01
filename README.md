# Demand Engine 2.0 — the KISS Creative Factory

A single Next.js app, stripped to one job: **winning ads in → tested creative out.**
No lead engine. Five screens: **Source → Decode → Rebuild → Publish** (+ Home).

Same Supabase, same keys as v1. The whole lead/intake/score/route/nurture stack
from v1 was intentionally dropped.

## The line

| Screen | What it does | Live data source |
|---|---|---|
| **Home** | Factory line + station status chips | — |
| **Source** | Find winning ads — Advertisers / Creatives / Identity tabs, filters, persona rollup | `spy_ads` (read) + `/api/spy/search` (action) |
| **Decode** | Why it works (hook, trigger, mechanic, copy, CTA) · Page Intel · editable Brief | `spy_ads` + `ad_hook_patterns` (read) + `/api/spy/crawl` (action) |
| **Rebuild** | Brief + **brand selector** + T2V settings → generate on-brand creative + compliance gate | `/api/spy/generate` + `/api/spy/generate-image` (actions), `ad_creatives` (read) |
| **Publish** | Ready-to-test creatives · publish targets · run performance · winner loop | `ad_creatives` (read) |

Landing-page work is **not** in the core line — it forks off Decode's *Page Intel*
tab as an optional lane (becomes its own product).

## Run it

```bash
npm install
cp .env.example .env.local   # fill in (same values as v1 / Vercel)
npm run dev
```

Open http://localhost:3000.

## Architecture

- **Reads** are server components calling `lib/data.ts` (service-role Supabase).
  Every read is defensive — on error it returns empty so screens show empty
  states, never crash.
- **Actions** (search, decode, generate) are server actions in `app/actions.ts`
  that call the ported `/api/spy/*` routes server-side with machine auth
  (`MACHINE_API_KEY`) — no secrets exposed to the client, no logic duplicated.
- **Design system**: `app/globals.css` tokens + `components/ui.tsx`. Per-stage
  accents: Source green, Decode blue, Rebuild orange, Publish indigo.
- **Shell**: `components/shell/AppShell.tsx` — side rail on desktop, bottom tabs
  on mobile. Responsive throughout.

## Video generation (direct kie.ai)

**Publish** turns reference images into video via kie.ai directly — no separate
engine. Two modes:

- **Replicate** — one reference image + an instruction prompt → one
  image-to-video clip (`renderVideo` / `replicate` server actions).
- **Multi-scene** — N reference frames (2/4/6/8) + a brief → Claude Sonnet
  writes an N-scene JSON master script (`lib/storyboard.ts`) → one Kie
  image-to-video clip per scene (`createStoryboard`).

kie.ai is poll-based (no webhook), so the Studio UI ticks `pollVideoJobs` every
few seconds; finished clips flip `video_status='ready'` with their `video_url`.
`lib/kie.ts` handles all five models (seedance/kling/sora/veo/runway) across
kie's three endpoint families.

**Stitching (multi-scene only):** when a storyboard's scene clips all finish,
`pollVideoJobs` POSTs the ordered clip URLs to the **stitch worker**
(`STITCH_WORKER_URL`, the separate `de-stitch-worker` Railway service — ffmpeg
crossfade-concat + loudnorm). It uploads the final and POSTs back to
`/api/storyboards/stitch-callback`, which sets the storyboard's `final_video_url`.

## Env keys

Required for full live operation:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` — all Claude calls (decode, generate, master script)
- `META_ACCESS_TOKEN` — Source live ad pulls (`/api/spy/search`)
- `OPENAI_API_KEY` — `/api/spy/generate-image` (optional; only for AI stills)
- `KIE_API_KEY` (+ `KIE_API_BASE_URL`) — all video generation
- `MACHINE_API_KEY` — enables the factory's server actions
- `ADMIN_PASSWORD` / `INTERNAL_API_SECRET` — gates `/api/spy/*`
- `STITCH_WORKER_URL` (+ optional `STITCH_WEBHOOK_SECRET`) — multi-scene stitching

Reads (real ad images, advertisers, creatives) work with just the Supabase keys.
Live *actions* need `MACHINE_API_KEY` + the relevant provider key.

## Ported from v1 (kept)

`lib/supabase/*`, `lib/admin-auth`, `lib/machine-auth`, `lib/brand-tokens`,
`lib/intake-schema`, the `app/api/spy/*` routes, and the creative-track agents
(`lib/agents/creative-generator`, `funnel-deconstruct`, `compliance`,
`compliance-gate`).

## Build note

Production builds run on Vercel (same stack as v1). Local typecheck:
`npx tsc --noEmit` (clean).

<!-- render worker: auto-deploys from main on changes under draft-render-worker/ or remotion/ (Railway watch paths) -->
