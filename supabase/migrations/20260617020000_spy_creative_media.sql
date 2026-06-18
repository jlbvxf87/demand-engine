-- Demand Engine 2.0 — store the real ad creative scraped from Meta's render_ad page.
-- (The Ad Library API returns no media URL; the scraper extracts the fbcdn asset.)
-- Additive + idempotent.

alter table public.spy_ads
  add column if not exists creative_media_url  text,
  add column if not exists creative_media_type text;   -- video | image
