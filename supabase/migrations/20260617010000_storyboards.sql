-- Demand Engine 2.0 — multi-scene storyboards (N images → N scene clips → 1 stitched video).
-- A storyboard owns N ad_creatives "scene" rows (clips); the stitched final lives on the storyboard.
-- Additive + idempotent.

create table if not exists public.storyboards (
  id                 uuid primary key default gen_random_uuid(),
  prompt             text not null,
  provider           text not null default 'seedance',     -- kie video model for all scenes
  clip_count         smallint not null,
  duration_per_clip  smallint not null default 5,
  status             text not null default 'scripting',     -- scripting | generating | stitching | ready | failed
  master_script_json jsonb,                                 -- Sonnet's N-scene master script
  final_video_url    text,                                  -- stitched output (from the worker)
  final_status       text default 'none',                   -- none | stitching | ready | failed
  created_at         timestamptz not null default now()
);

alter table public.ad_creatives
  add column if not exists storyboard_id uuid references public.storyboards(id) on delete set null,
  add column if not exists scene_index   smallint;          -- 0-based scene order within a storyboard

create index if not exists ad_creatives_storyboard_idx on public.ad_creatives (storyboard_id);
create index if not exists storyboards_status_idx on public.storyboards (status);

comment on table public.storyboards is
  'Multi-scene video: one row per storyboard; its scene clips are ad_creatives rows with matching storyboard_id + scene_index.';
