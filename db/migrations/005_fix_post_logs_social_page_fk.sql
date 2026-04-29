-- Fix schema drift where post_logs.social_page_id may still reference
-- the legacy social_pages table instead of inbox_channels.

ALTER TABLE IF EXISTS public.post_logs
  DROP CONSTRAINT IF EXISTS post_logs_social_page_id_fkey;

ALTER TABLE IF EXISTS public.post_logs
  ADD CONSTRAINT post_logs_social_page_id_fkey
  FOREIGN KEY (social_page_id)
  REFERENCES public.inbox_channels(id)
  ON DELETE SET NULL;
