import { NextRequest, NextResponse } from 'next/server';
import { createContent } from '@/lib/repositories/content';
import { getDefaultProfile } from '@/lib/repositories/profiles';
import { rewriteInternalCaptionWording, sanitizeContentOutputForCustomers, findInternalCaptionTerms } from '@/lib/caption-safety';
import type { ContentType, Platform } from '@/types/database';

type ShortVideoDraftRequest = {
  action?: 'caption_handoff' | 'save_library';
  platform?: string;
  video_url?: string;
  video_asset_id?: string;
  final_master_asset_id?: string;
  transcript?: string;
  current_caption?: string;
  hashtags?: string[];
  cta?: string;
  service_type?: string;
  target_area?: string;
  quality_gate_snapshot?: Record<string, unknown>;
  preview_id?: string;
  content_id?: string;
};

const PLATFORM_MAP: Record<string, Platform> = {
  youtube_shorts: 'youtube',
  facebook_reels: 'facebook',
  instagram_reels: 'instagram',
  tiktok: 'tiktok',
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ShortVideoDraftRequest;
    const profile = await getDefaultProfile();
    if (!profile?.id) {
      return NextResponse.json({ error: 'No default business profile found' }, { status: 500 });
    }

    const videoUrl = cleanText(body.video_url);
    if (!videoUrl) {
      return NextResponse.json({ error: 'video_url is required' }, { status: 400 });
    }

    const platform = PLATFORM_MAP[cleanText(body.platform)] || 'facebook';
    const safeCaption = rewriteInternalCaptionWording(cleanText(body.current_caption));
    const safeCta = rewriteInternalCaptionWording(cleanText(body.cta));
    const hashtags = Array.isArray(body.hashtags) ? body.hashtags.map((tag) => cleanText(tag)).filter(Boolean) : [];
    const transcript = rewriteInternalCaptionWording(cleanText(body.transcript));
    const serviceType = cleanText(body.service_type) || 'ล้างแอร์บ้าน';
    const targetArea = cleanText(body.target_area) || 'สมุทรปราการ';

    const output = sanitizeContentOutputForCustomers({
      platform,
      content_type: 'short_video_script',
      headline: 'Short Video draft ready for customer-safe caption rewrite',
      caption_main: safeCaption,
      caption_short: safeCaption.slice(0, 220),
      hashtags,
      cta: safeCta,
      seo_keywords: [serviceType, targetArea, 'คลิปสั้น', 'บริการแอร์'].filter(Boolean),
      platform_versions: {
        [platform]: [safeCaption, hashtags.join(' ')].filter(Boolean).join('\n\n'),
      },
    });

    const input = {
      platform,
      platform_variant: platform === 'youtube' ? 'short' : platform === 'instagram' ? 'reel' : platform === 'tiktok' ? 'short_video' : 'post',
      content_type: 'short_video_script' as ContentType,
      service_type: serviceType,
      topic: `สร้างแคปชันใหม่จากคลิปสั้นที่เสร็จแล้วสำหรับ ${serviceType}`,
      location: targetArea,
      tone: 'professional',
      language: 'th',
      post_length: 'medium',
      content_goal: 'lead_generation',
      asset_type: 'short_video',
      visual_direction: 'Use the finished short video as the source of truth for customer-facing copy.',
      video_url: videoUrl,
      video_transcript: transcript || undefined,
      custom_notes: [
        'Regenerate caption, hashtags, CTA, keywords, platform-specific copy, title, and description from the finished clip.',
        'Never expose internal production wording to customers.',
        safeCaption ? `Previous draft caption context: ${safeCaption}` : '',
        safeCta ? `Previous CTA context: ${safeCta}` : '',
      ].filter(Boolean).join('\n'),
      source_module: 'short_video_distribution',
    };

    const saved = await createContent({
      business_profile_id: profile.id,
      project_id: null,
      platform,
      platform_variant: input.platform_variant,
      content_type: 'short_video_script',
      topic: input.topic,
      service_type: serviceType,
      input_payload: input,
      output_payload: output,
      language: 'th',
      tone: 'professional',
      content_goal: 'lead_generation',
      post_length: 'medium',
      asset_type: 'short_video',
      visual_direction: input.visual_direction,
      platform_constraints: {
        caption_safety_rewritten_terms: findInternalCaptionTerms(cleanText(body.current_caption)).concat(findInternalCaptionTerms(cleanText(body.cta))),
        no_publish_api_called: true,
      },
      status: 'draft_ready_for_caption',
      metadata: {
        source: 'short_video_distribution',
        source_module: 'short_video_distribution',
        action: body.action || 'caption_handoff',
        video_url: videoUrl,
        video_asset_id: cleanText(body.video_asset_id),
        final_master_asset_id: cleanText(body.final_master_asset_id),
        final_master_asset_id_alias: cleanText(body.final_master_asset_id),
        video_asset_id_alias: cleanText(body.video_asset_id),
        transcript,
        current_caption: safeCaption,
        hashtags,
        cta: safeCta,
        platform: body.platform,
        service_type: serviceType,
        target_area: targetArea,
        quality_gate_snapshot: body.quality_gate_snapshot || {},
        preview_id: cleanText(body.preview_id),
        source_content_id: cleanText(body.content_id),
        status: 'draft_ready_for_caption',
        no_publish_api_called: true,
      },
      model_name: null,
      prompt_version: 'short-video-content-draft-v1',
    });

    return NextResponse.json({ ok: true, draft: saved, redirect_url: `/generate?draft_id=${saved.id}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create Short Video content draft';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
