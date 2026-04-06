-- ============================================================
-- AI Content Studio - Initial Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. business_profiles
-- ============================================================
CREATE TABLE business_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'general_service',
  description TEXT,
  tone_of_voice TEXT DEFAULT 'professional',
  brand_style TEXT DEFAULT 'clean',
  service_categories JSONB DEFAULT '[]'::jsonb,
  service_areas JSONB DEFAULT '[]'::jsonb,
  target_audience JSONB DEFAULT '[]'::jsonb,
  pain_points JSONB DEFAULT '[]'::jsonb,
  faq_knowledge JSONB DEFAULT '[]'::jsonb,
  review_examples JSONB DEFAULT '[]'::jsonb,
  trust_signals JSONB DEFAULT '[]'::jsonb,
  promotion_goals JSONB DEFAULT '[]'::jsonb,
  brand_keywords JSONB DEFAULT '[]'::jsonb,
  banned_words JSONB DEFAULT '[]'::jsonb,
  contact_phone TEXT,
  contact_line TEXT,
  website_url TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  default_ctas JSONB DEFAULT '[]'::jsonb,
  default_language TEXT DEFAULT 'th',
  bilingual_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_profiles_type ON business_profiles(business_type);
CREATE INDEX idx_business_profiles_updated ON business_profiles(updated_at DESC);

-- ============================================================
-- 2. content_projects (campaigns)
-- ============================================================
CREATE TABLE content_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_projects_profile ON content_projects(business_profile_id);
CREATE INDEX idx_content_projects_status ON content_projects(status);
CREATE INDEX idx_content_projects_type ON content_projects(campaign_type);

-- ============================================================
-- 3. generated_contents
-- ============================================================
CREATE TABLE generated_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES content_projects(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  platform_variant TEXT,
  content_type TEXT NOT NULL,
  topic TEXT,
  service_type TEXT,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  language TEXT DEFAULT 'th',
  tone TEXT DEFAULT 'professional',
  content_goal TEXT,
  post_length TEXT DEFAULT 'medium',
  asset_type TEXT,
  visual_direction TEXT,
  platform_constraints JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'published', 'archived')),
  model_name TEXT,
  prompt_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_contents_profile ON generated_contents(business_profile_id);
CREATE INDEX idx_generated_contents_project ON generated_contents(project_id);
CREATE INDEX idx_generated_contents_platform ON generated_contents(platform);
CREATE INDEX idx_generated_contents_type ON generated_contents(content_type);
CREATE INDEX idx_generated_contents_status ON generated_contents(status);
CREATE INDEX idx_generated_contents_created ON generated_contents(created_at DESC);

-- ============================================================
-- 4. prompt_presets
-- ============================================================
CREATE TABLE prompt_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  platform TEXT,
  content_type TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_presets_platform ON prompt_presets(platform);
CREATE INDEX idx_prompt_presets_type ON prompt_presets(content_type);
CREATE INDEX idx_prompt_presets_default ON prompt_presets(is_default) WHERE is_default = true;

-- ============================================================
-- 5. tone_presets
-- ============================================================
CREATE TABLE tone_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. cta_presets
-- ============================================================
CREATE TABLE cta_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cta_style TEXT NOT NULL,
  examples JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. platform_presets
-- ============================================================
CREATE TABLE platform_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  variant TEXT,
  format_rules JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_presets_platform ON platform_presets(platform);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER trg_business_profiles_updated BEFORE UPDATE ON business_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_content_projects_updated BEFORE UPDATE ON content_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_generated_contents_updated BEFORE UPDATE ON generated_contents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_prompt_presets_updated BEFORE UPDATE ON prompt_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tone_presets_updated BEFORE UPDATE ON tone_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_cta_presets_updated BEFORE UPDATE ON cta_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_platform_presets_updated BEFORE UPDATE ON platform_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
