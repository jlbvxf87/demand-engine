-- Store the exact voiceover text per spokesperson clip so a transient TTS
-- failure can be re-submitted (retry) without re-deriving the script. Idempotent.

alter table public.ad_creatives
  add column if not exists vo_script text;

comment on column public.ad_creatives.vo_script is
  'Exact voiceover text for a spokesperson clip — enables TTS retry on transient failure.';
