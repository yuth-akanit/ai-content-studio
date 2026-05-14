-- Short-form content campaign metadata.
-- Uses existing generic campaign/content tables. This does not add TikTok or
-- YouTube posting, OAuth, token refresh, or voucher logic.

ALTER TABLE public.content_projects
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.generated_contents
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_content_projects_metadata_campaign_family
  ON public.content_projects ((metadata ->> 'campaign_family'));

CREATE INDEX IF NOT EXISTS idx_generated_contents_metadata_source_module
  ON public.generated_contents ((metadata ->> 'source_module'));
