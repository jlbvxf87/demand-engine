-- Demand Engine 2.0 — give generated creatives a place for T2V video output.
-- Additive + idempotent. Safe to run on the shared (v1) Supabase project.

alter table public.ad_creatives
  add column if not exists video_url    text,                       -- signed MP4 from the T2V engine
  add column if not exists video_status text default 'none',        -- none | queued | rendering | ready | failed
  add column if not exists t2v_job_id   text;                       -- T2V engine job id, for webhook mapping

comment on column public.ad_creatives.video_url is
  'Signed MP4 URL returned by the T2V engine. Null until a render completes.';
comment on column public.ad_creatives.video_status is
  'T2V render lifecycle: none | queued | rendering | ready | failed.';
comment on column public.ad_creatives.t2v_job_id is
  'T2V engine job id — set when a render is submitted, used to map the webhook back.';

create index if not exists ad_creatives_video_status_idx
  on public.ad_creatives (video_status);
