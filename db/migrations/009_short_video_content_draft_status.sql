-- Short Video Distribution handoff uses the existing generated_contents table.
-- No posting, scheduler, LINE, n8n, or OAuth behavior is added here.

ALTER TABLE public.generated_contents
  DROP CONSTRAINT IF EXISTS generated_contents_status_check;

ALTER TABLE public.generated_contents
  ADD CONSTRAINT generated_contents_status_check
  CHECK (status IN ('draft', 'draft_ready_for_caption', 'saved', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_generated_contents_metadata_source_status
  ON public.generated_contents ((metadata ->> 'source_module'), status);
