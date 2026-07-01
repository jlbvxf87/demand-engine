# draft-render-worker

Renders Demand Engine **draft / motion** render-plans (Remotion + FFmpeg) off-Vercel and
calls back when done. Mirrors the `de-stitch-worker` pattern (Railway service + callback).

The Next app POSTs a job here when `DRAFT_WORKER_URL` is set; this service renders the
9:16 MP4 (template scenes + any `ai_motion` `<OffthreadVideo>` clips), uploads it to the same
Supabase bucket the app reads (`ad-creatives/generated/<id>.mp4`), then POSTs the result back
to the app's `/api/renders/draft-callback`.

## Endpoints
- `GET /health` → `ok`
- `POST /render` (header `x-worker-secret: $DRAFT_WORKER_SECRET`) → `202` immediately, then
  renders in the background. Body: `{ plan, creativeId, callbackUrl }`.
  On finish: `POST callbackUrl { creativeId, video_url }` (or `{ creativeId, error }`).

## Env
- `SUPABASE_URL` — the project URL (https://<ref>.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` — service role (Storage upload)
- `DRAFT_WORKER_SECRET` — shared secret the app sends in `x-worker-secret`
- `PORT` — defaults to 8080 (Railway sets this)

## Deploy (Railway, like de-stitch-worker)
1. New Railway service from this folder (Dockerfile build).
2. Set the env vars above.
3. Copy the public URL → set in **Vercel**: `DRAFT_WORKER_URL` = that URL,
   `DRAFT_WEBHOOK_SECRET` = `DRAFT_WORKER_SECRET`.

## Keep in sync
`remotion/` here is a copy of the app's `remotion/` composition. If the app's composition
changes, copy it over again:
```
cp ../remotion/*.ts ../remotion/*.tsx ./remotion/
```

## Run locally
```
npm install
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DRAFT_WORKER_SECRET=dev npm start
```

<!-- deploy: auto-deploys from main via Railway watch path draft-render-worker/** -->
