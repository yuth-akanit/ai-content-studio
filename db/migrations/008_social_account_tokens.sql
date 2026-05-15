-- Server-only OAuth token storage for YouTube Shorts and guarded TikTok posting.
-- Tokens must never be exposed to browser clients. Next.js server routes should
-- access this table with the service role key only.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.social_account_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_page_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('youtube', 'tiktok')),
  access_token text NOT NULL,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_page_id, provider)
);

DO $$
BEGIN
  IF to_regclass('public.inbox_channels') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'social_account_tokens_social_page_id_fkey'
        AND conrelid = 'public.social_account_tokens'::regclass
    ) THEN
      ALTER TABLE public.social_account_tokens
        ADD CONSTRAINT social_account_tokens_social_page_id_fkey
        FOREIGN KEY (social_page_id)
        REFERENCES public.inbox_channels(id)
        ON DELETE CASCADE;
    END IF;
  ELSIF to_regclass('public.social_pages') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'social_account_tokens_social_page_id_fkey'
        AND conrelid = 'public.social_account_tokens'::regclass
    ) THEN
      ALTER TABLE public.social_account_tokens
        ADD CONSTRAINT social_account_tokens_social_page_id_fkey
        FOREIGN KEY (social_page_id)
        REFERENCES public.social_pages(id)
        ON DELETE CASCADE;
    END IF;
  ELSE
    RAISE EXCEPTION 'social_account_tokens requires public.social_pages or public.inbox_channels';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_social_account_tokens_social_page_id
  ON public.social_account_tokens (social_page_id);

CREATE INDEX IF NOT EXISTS idx_social_account_tokens_provider
  ON public.social_account_tokens (provider);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_account_tokens_updated ON public.social_account_tokens;
CREATE TRIGGER trg_social_account_tokens_updated
  BEFORE UPDATE ON public.social_account_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.social_account_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.social_account_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_account_tokens TO service_role;
