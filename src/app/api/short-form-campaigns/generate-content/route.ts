import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { createContent } from '@/lib/repositories/content';
import { generateShortFormItems } from '@/lib/short-form/generator';
import {
  generateShortFormContentSchema,
  parseShortFormError,
} from '@/lib/validators/short-form-campaigns';
import { ContentOutput, Platform } from '@/types/database';

export const dynamic = 'force-dynamic';

function mapPrimaryPlatformToContentPlatform(primaryPlatform: string): Platform {
  if (primaryPlatform === 'instagram_reels') return 'instagram';
  if (primaryPlatform === 'facebook_reels') return 'facebook';
  if (primaryPlatform === 'tiktok') return 'tiktok';
  return 'other';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = generateShortFormContentSchema.parse(body);
    const supabase = getSupabaseServerClient();

    let businessProfileId = input.business_profile_id || null;
    let campaignMetadata: Record<string, unknown> = {};

    if (input.campaign_id) {
      const { data: campaign, error } = await supabase
        .from('content_projects')
        .select('id,business_profile_id,metadata')
        .eq('id', input.campaign_id)
        .single();

      if (error || !campaign) {
        return NextResponse.json(
          { ok: false, error: 'Campaign not found' },
          { status: 404 },
        );
      }

      businessProfileId = campaign.business_profile_id;
      campaignMetadata = campaign.metadata || {};
    }

    if (!businessProfileId) {
      return NextResponse.json(
        { ok: false, error: 'business_profile_id is required' },
        { status: 400 },
      );
    }

    const generatedItems = generateShortFormItems(input);
    const savedItems = [];

    for (const item of generatedItems) {
      const output = {
        platform: mapPrimaryPlatformToContentPlatform(input.primary_platform),
        content_type: 'short_video_script',
        title: item.hook,
        body: item.script,
        caption_main: item.caption_tiktok,
        caption_short: item.hook,
        hashtags: item.hashtags_tiktok,
        cta: item.cta,
        short_form: item,
      } as unknown as ContentOutput;

      const metadata = {
        source_module: 'short_form_content_campaign',
        platform_targets: input.platform_targets,
        primary_platform: input.primary_platform,
        service_type: input.service_type,
        target_area: input.target_area,
        content_angle: input.content_angle,
        cta_type: input.cta_type,
        cta_url: input.cta_url,
        utm_source: 'short_form',
        utm_campaign: input.utm_campaign || campaignMetadata.utm_campaign || 'short_form_campaign',
      };

      const saved = await createContent({
        business_profile_id: businessProfileId,
        project_id: input.campaign_id || null,
        platform: mapPrimaryPlatformToContentPlatform(input.primary_platform),
        platform_variant: 'reel',
        content_type: 'short_video_script',
        topic: item.hook,
        service_type: input.service_type,
        input_payload: {
          platform: mapPrimaryPlatformToContentPlatform(input.primary_platform),
          platform_variant: 'reel',
          content_type: 'short_video_script',
          service_type: input.service_type,
          topic: input.content_angle,
          location: input.target_area,
          tone: 'friendly',
          language: 'th',
          post_length: 'short',
          content_goal: 'lead_generation',
          custom_notes: `Short-form ${input.format} for ${input.platform_targets.join(', ')}`,
        },
        output_payload: output,
        language: 'th',
        tone: 'friendly',
        content_goal: 'lead_generation',
        post_length: 'short',
        asset_type: 'short_video',
        visual_direction: item.video_prompt,
        platform_constraints: {
          prepared_only: input.platform_targets.filter((target) => target === 'tiktok' || target === 'youtube_shorts'),
          posting_api_connected: false,
        },
        status: 'draft',
        metadata,
        model_name: 'template-short-form-v1',
        prompt_version: 'short-form-v1',
      });

      savedItems.push({ content: saved, output: item });
    }

    return NextResponse.json({ ok: true, items: savedItems });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseShortFormError(error) },
        { status: 400 },
      );
    }

    console.error('[short-form-campaigns] generate failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to generate short-form content' },
      { status: 500 },
    );
  }
}
