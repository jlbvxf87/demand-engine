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

## T2V video handoff

Rebuild produces stills; **Publish** turns a still into video via the separate
T2V engine:

1. "Render video" on a Publish card calls the `renderVideo` server action.
2. It composes an on-brand prompt (creative copy + brand voice) and POSTs to
   `{T2V_ENGINE_URL}/api/jobs/create` (`image-to-video` using the still as
   `reference_image_url`, `intel_enabled:false`, `webhook_url` = our callback,
   `metadata.ad_creative_id` for mapping). It stores `t2v_job_id` and sets
   `video_status='queued'`.
3. When the render finishes, T2V's `notify` stage POSTs
   `{ event, job_id, video_url, … }` to `/api/creatives/video-callback`, which
   writes `video_url` and flips `video_status='ready'`. The card then shows
   "Video ready".

Note: T2V's webhook only fires on **success**, so a failed render leaves the row
`queued` (no false "ready"). The T2V app must have its worker + Redis running and
`KIE_API_KEY` set for real renders; mocks otherwise.

## Env keys

Required for full live operation (all already exist in the v1 Vercel project):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` — all Claude calls (decode, generate, synthesize)
- `META_ACCESS_TOKEN` — Source live ad pulls (`/api/spy/search`)
- `OPENAI_API_KEY` — `/api/spy/generate-image`
- `MACHINE_API_KEY` — enables the factory's server actions
- `ADMIN_PASSWORD` / `INTERNAL_API_SECRET` — gates `/api/spy/*`
- `T2V_ENGINE_URL` — Rebuild → video render handoff (separate T2V app)

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
