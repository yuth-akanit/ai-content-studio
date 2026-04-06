-- Post Logs table for tracking auto-posted content
CREATE TABLE IF NOT EXISTS public.post_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid REFERENCES public.generated_contents(id) ON DELETE CASCADE,
  social_page_id uuid REFERENCES public.inbox_channels(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'facebook',
  post_external_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  error_message text,
  comments_posted integer DEFAULT 0,
  posted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (no auth yet)
CREATE POLICY "Allow all for post_logs" ON public.post_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_post_logs_content_id ON public.post_logs(content_id);
CREATE INDEX IF NOT EXISTS idx_post_logs_social_page_id ON public.post_logs(social_page_id);
