-- Scheduled post queue for n8n-driven future publishing.
-- This table is for trusted server-side queue processing only.
-- n8n or Next.js server routes should use service_role-backed endpoints.
-- metadata.publish_payload stores the schedule-time Hybrid snapshot that
-- should be preferred over edited generated_contents rows when publishing.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.generated_contents(id) ON DELETE CASCADE,
  social_page_id uuid NOT NULL REFERENCES public.inbox_channels(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'posted', 'failed', 'cancelled')),
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  error_message text,
  locked_at timestamptz,
  locked_by text,
  posted_at timestamptz,
  post_log_id uuid REFERENCES public.post_logs(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due_pending
  ON public.scheduled_posts (scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_content_id
  ON public.scheduled_posts (content_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_social_page_id
  ON public.scheduled_posts (social_page_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status
  ON public.scheduled_posts (status);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_locked_at_processing
  ON public.scheduled_posts (locked_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_posts_updated ON public.scheduled_posts;
CREATE TRIGGER trg_scheduled_posts_updated
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.scheduled_posts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scheduled_posts TO service_role;

-- Queue RPCs are intended for service_role / trusted worker use only.
CREATE OR REPLACE FUNCTION public.claim_due_scheduled_posts(
  p_limit int DEFAULT 5,
  p_worker_id text DEFAULT 'n8n'
)
RETURNS TABLE (
  scheduled_post_id uuid,
  content_id uuid,
  social_page_id uuid,
  scheduled_at timestamptz,
  retry_count int,
  max_retries int,
  metadata jsonb,
  publish_payload jsonb
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate_posts AS (
    SELECT sp.id
    FROM public.scheduled_posts sp
    WHERE sp.status = 'pending'
      AND sp.scheduled_at <= now()
      AND sp.retry_count < sp.max_retries
    ORDER BY sp.scheduled_at ASC, sp.created_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 50)
    FOR UPDATE SKIP LOCKED
  ),
  claimed_posts AS (
    UPDATE public.scheduled_posts sp
    SET
      status = 'processing',
      locked_at = now(),
      locked_by = COALESCE(NULLIF(p_worker_id, ''), 'n8n'),
      updated_at = now()
    FROM candidate_posts cp
    WHERE sp.id = cp.id
    RETURNING sp.*
  )
  SELECT
    cp.id AS scheduled_post_id,
    cp.content_id,
    cp.social_page_id,
    cp.scheduled_at,
    cp.retry_count,
    cp.max_retries,
    cp.metadata,
    COALESCE(cp.metadata -> 'publish_payload', '{}'::jsonb) AS publish_payload
  FROM claimed_posts cp;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_scheduled_post_posted(
  p_scheduled_post_id uuid,
  p_post_log_id uuid DEFAULT NULL
)
RETURNS SETOF public.scheduled_posts
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scheduled_posts
  SET
    status = 'posted',
    posted_at = now(),
    post_log_id = p_post_log_id,
    error_message = NULL,
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
  WHERE id = p_scheduled_post_id
    AND status = 'processing'
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_scheduled_post_failed(
  p_scheduled_post_id uuid,
  p_error_message text
)
RETURNS SETOF public.scheduled_posts
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scheduled_posts
  SET
    retry_count = retry_count + 1,
    status = CASE
      WHEN retry_count + 1 >= max_retries THEN 'failed'
      ELSE 'pending'
    END,
    scheduled_at = CASE
      WHEN retry_count + 1 >= max_retries THEN scheduled_at
      ELSE now() + interval '5 minutes'
    END,
    error_message = LEFT(COALESCE(NULLIF(p_error_message, ''), 'Unknown error'), 2000),
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
  WHERE id = p_scheduled_post_id
    AND status = 'processing'
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_stale_scheduled_posts(
  p_stale_after_minutes int DEFAULT 10
)
RETURNS int
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  affected_count int;
BEGIN
  UPDATE public.scheduled_posts
  SET
    status = 'pending',
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
  WHERE status = 'processing'
    AND retry_count < max_retries
    AND locked_at IS NOT NULL
    AND locked_at < now() - make_interval(mins => GREATEST(COALESCE(p_stale_after_minutes, 10), 1));

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_scheduled_posts(int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_due_scheduled_posts(int, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_scheduled_post_posted(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_scheduled_post_posted(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_scheduled_post_failed(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_scheduled_post_failed(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_stale_scheduled_posts(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_stale_scheduled_posts(int) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_posts(int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_scheduled_post_posted(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_scheduled_post_failed(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_stale_scheduled_posts(int) TO service_role;
