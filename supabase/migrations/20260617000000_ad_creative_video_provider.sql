-- Demand Engine 2.0 — direct Kie video generation.
-- Track which model rendered each clip so we poll the right Kie endpoint.
-- Additive + idempotent.

alter table public.ad_creatives
  add column if not exists video_provider text;   -- seedance | kling | sora | veo | runway

comment on column public.ad_creatives.video_provider is
  'Kie video model used for this clip (seedance|kling|sora|veo|runway) — determines the poll endpoint.';
