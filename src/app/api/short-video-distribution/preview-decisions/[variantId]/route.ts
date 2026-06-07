import { NextRequest, NextResponse } from 'next/server';
import {
  appendShortVideoOwnerDecision,
  allShortVideoOwnerReviewSafetyFlagsFalse,
  isShortVideoOwnerDecision,
  normalizeShortVideoDecisionReason,
  SHORT_VIDEO_OWNER_REVIEW_SAFETY_FLAGS,
} from '@/lib/short-video-distribution/owner-review-decisions';
import { SHORT_VIDEO_PLATFORMS, type ShortVideoPlatform } from '@/lib/short-video-distribution/planner';

const VALID_PLATFORMS = Object.keys(SHORT_VIDEO_PLATFORMS) as ShortVideoPlatform[];

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isShortVideoPlatform(value: unknown): value is ShortVideoPlatform {
  return typeof value === 'string' && VALID_PLATFORMS.includes(value as ShortVideoPlatform);
}

function decisionResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    {
      ok: status >= 200 && status < 300,
      ...body,
      local_only: true,
      preview_only: true,
      publish_allowed: false,
      facebook_post_performed: false,
      instagram_post_performed: false,
      tiktok_post_performed: false,
      youtube_post_performed: false,
      line_broadcast_performed: false,
      schedule_enabled: false,
      scheduler_enabled: false,
      renderer_called: false,
      tts_called: false,
      s3_upload_performed: false,
      mark_posted_performed: false,
      production_actions_performed: false,
      safety_flags: { ...SHORT_VIDEO_OWNER_REVIEW_SAFETY_FLAGS },
      all_safety_flags_false: allShortVideoOwnerReviewSafetyFlagsFalse(SHORT_VIDEO_OWNER_REVIEW_SAFETY_FLAGS),
    },
    { status },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ variantId?: string }> },
) {
  const { variantId: rawVariantId } = await params;
  const variantId = cleanText(rawVariantId);
  if (!variantId) {
    return decisionResponse({ error: 'variant_id_required' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return decisionResponse({ error: 'invalid_json_body' }, 400);
  }

  const bodyVariantId = cleanText(body.variant_id);
  if (bodyVariantId && bodyVariantId !== variantId) {
    return decisionResponse({ error: 'variant_id_mismatch' }, 400);
  }

  const decision = body.decision;
  if (!isShortVideoOwnerDecision(decision)) {
    return decisionResponse({ error: 'invalid_decision', allowed_decisions: ['approve', 'reject', 'request_changes'] }, 400);
  }

  const platform = cleanText(body.platform);
  if (!isShortVideoPlatform(platform)) {
    return decisionResponse({ error: 'invalid_platform', allowed_platforms: VALID_PLATFORMS }, 400);
  }

  const masterVideoId = cleanText(body.master_video_id);
  if (!masterVideoId) {
    return decisionResponse({ error: 'master_video_id_required' }, 400);
  }

  const expectedVariantId = `${masterVideoId}-${platform}`;
  if (variantId !== expectedVariantId) {
    return decisionResponse({ error: 'variant_id_platform_mismatch', expected_variant_id: expectedVariantId }, 400);
  }

  const record = await appendShortVideoOwnerDecision({
    variant_id: variantId,
    master_video_id: masterVideoId,
    platform,
    decision,
    reason: normalizeShortVideoDecisionReason(body.reason),
  });

  return decisionResponse({
    status: record.status,
    decision_record: record,
    audit_appended: true,
    message: 'Short Video preview decision saved locally only. No publish/provider action was performed.',
  });
}
