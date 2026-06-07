import { createHash } from 'node:crypto';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  ProductVideoPreviewLogRecord,
  ProductVideoPreviewSafetyFlags,
} from '@/lib/product-video-preview-log';
import {
  ProductVideoMediaMetadataRecord,
  findLatestProductVideoMediaMetadata,
} from '@/lib/product-video-media-metadata';
import {
  ProductVideoSelectedFacebookPage,
  resolveProductVideoSelectedFacebookPage,
} from '@/lib/product-video-facebook-page';
import { ProductVideoQualityScore, isPublishQualityAllowed, normalizeQualityScore } from '@/lib/product-video-quality-score';

export type ProductVideoPublishPlanStatus = 'publish_plan_ready';
export type ProductVideoPublishPlanMedia =
  | {
      media_kind: 'product_video_preview';
      media_status: 'not_rendered';
      media_type: null;
      media_url: null;
      public_media_url: null;
      media_checksum: null;
      source: null;
      renderer_required_before_real_publish: true;
    }
  | {
      media_kind: 'product_video_preview';
      media_status: 'ready';
      media_type: 'video' | 'image';
      media_url: string;
      public_media_url: string;
      media_checksum: string;
      source: 'mock_metadata_only';
      renderer_required_before_real_publish: false;
    };

export interface ProductVideoPublishPlanPreview extends ProductVideoPreviewSafetyFlags {
  plan_id: string;
  preview_id: string;
  source_status: 'approved_for_future_publish';
  publish_plan_status: ProductVideoPublishPlanStatus;
  local_only: true;
  read_only: true;
  target_page: {
    page_id: string;
    page_name: string;
    page_key: string;
    platform: string;
  };
  target_pages: Array<{
    page_id: string;
    page_name: string;
    page_key: string;
    platform: string;
    selected_channel_id: string;
    facebook_page_id: string;
    token_resolved: boolean;
    block_reason: string | null;
  }>;
  selected_page_count: number;
  quality_score: ProductVideoQualityScore;
  content: {
    caption: string;
    marketing_caption: string;
    publish_caption: string;
    brand_context: string;
  };
  media: ProductVideoPublishPlanMedia;
  safety_summary: {
    approval_decision_is_publish_permission: false;
    real_publish_blocked: true;
    facebook_graph_call_allowed: false;
    line_broadcast_allowed: false;
    schedule_allowed: false;
    renderer_allowed: false;
    phaya_allowed: false;
    s3_upload_allowed: false;
    mark_posted_allowed: false;
  };
  publish_plan_checksum: string;
  generated_at: string;
  selected_pages?: string;
  idempotency_key?: string;
}

function buildPlanMedia(
  item: ProductVideoPreviewLogRecord,
  metadata: ProductVideoMediaMetadataRecord | null
): ProductVideoPublishPlanMedia {
  if (item.public_media_url) {
    return {
      media_kind: 'product_video_preview',
      media_status: 'ready',
      media_type: (item.media_type as 'video' | 'image') || 'video',
      media_url: item.public_media_url,
      public_media_url: item.public_media_url,
      media_checksum: item.media_checksum || `md5-${item.preview_id}`,
      source: 'mock_metadata_only',
      renderer_required_before_real_publish: false,
    };
  }

  if (!metadata) {
    return {
      media_kind: 'product_video_preview',
      media_status: 'not_rendered',
      media_type: null,
      media_url: null,
      public_media_url: null,
      media_checksum: null,
      source: null,
      renderer_required_before_real_publish: true,
    };
  }

  return {
    media_kind: 'product_video_preview',
    media_status: 'ready',
    media_type: metadata.media_type,
    media_url: metadata.public_media_url,
    public_media_url: metadata.public_media_url,
    media_checksum: metadata.media_checksum,
    source: metadata.source,
    renderer_required_before_real_publish: false,
  };
}

function getFacebookPageId(item: ProductVideoPreviewLogRecord): string {
  return item.facebook_page_id || item.external_id || item.selected_page_id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseProductVideoSelectedPageSelectors(item: ProductVideoPreviewLogRecord): string[] {
  const selectors: string[] = [];
  if (item.selected_pages) {
    try {
      const parsed = JSON.parse(item.selected_pages) as unknown;
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const selector = typeof entry === 'string'
            ? entry
            : isRecord(entry)
              ? (cleanSelector(entry.page_id) || cleanSelector(entry.selected_page_id) || cleanSelector(entry.selected_channel_id) || cleanSelector(entry.facebook_page_id))
              : '';
          if (selector && !selectors.includes(selector)) selectors.push(selector);
        }
      }
    } catch {
      // Fall through to the legacy single selected page below.
    }
  }

  const legacySelector = item.selected_channel_id || item.selected_page_id || item.facebook_page_id || item.external_id;
  if (legacySelector && !selectors.includes(legacySelector)) selectors.push(legacySelector);
  return selectors;
}

function cleanSelector(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolvePlanTargetPages(item: ProductVideoPreviewLogRecord): Promise<ProductVideoPublishPlanPreview['target_pages']> {
  const selectors = parseProductVideoSelectedPageSelectors(item);
  const pages: ProductVideoPublishPlanPreview['target_pages'] = [];

  for (const selector of selectors) {
    try {
      const page: ProductVideoSelectedFacebookPage = await resolveProductVideoSelectedFacebookPage(selector);
      pages.push({
        page_id: page.facebook_page_id,
        page_name: page.selected_page_name,
        page_key: item.target_page_key,
        platform: item.platform,
        selected_channel_id: page.selected_channel_id,
        facebook_page_id: page.facebook_page_id,
        token_resolved: Boolean(page.page_access_token),
        block_reason: null,
      });
    } catch (error) {
      const code = typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : 'selected_facebook_page_resolution_failed';
      pages.push({
        page_id: selector,
        page_name: selector,
        page_key: item.target_page_key,
        platform: item.platform,
        selected_channel_id: selector,
        facebook_page_id: selector,
        token_resolved: false,
        block_reason: code,
      });
    }
  }

  return pages;
}

function assertBrandTargetPageGuard(item: ProductVideoPreviewLogRecord): void {
  if (item.brand_context === 'syncflow' && item.target_page_key !== 'syncflow') {
    throw Object.assign(new Error('syncflow_requires_target_page_key_syncflow'), {
      code: 'syncflow_requires_target_page_key_syncflow',
      status: 409,
    });
  }
  if ((item.brand_context === 'paa' || item.brand_context === 'paa_air') && item.target_page_key !== 'paa_air') {
    throw Object.assign(new Error('paa_requires_target_page_key_paa_air'), {
      code: 'paa_requires_target_page_key_paa_air',
      status: 409,
    });
  }
}

export function buildProductVideoPublishPlanChecksum(
  item: ProductVideoPreviewLogRecord,
  metadata: ProductVideoMediaMetadataRecord | null = null,
): string {
  const media = buildPlanMedia(item, metadata);
  const checksumPayload = {
    caption: item.marketing_caption || item.publish_caption || item.caption || '',
    media_checksum_or_url: media.media_checksum || media.public_media_url || '',
    target_page_id: getFacebookPageId(item),
    selected_pages: item.selected_pages || '',
    brand_context: item.brand_context,
  };

  return createHash('sha256')
    .update(JSON.stringify(checksumPayload))
    .digest('hex');
}

export async function buildProductVideoPublishPlanPreview(
  item: ProductVideoPreviewLogRecord,
): Promise<ProductVideoPublishPlanPreview> {
  if (item.status !== 'approved_for_future_publish') {
    throw Object.assign(new Error('preview_log_not_approved_for_publish_plan'), {
      code: 'preview_log_not_approved_for_publish_plan',
      status: 409,
    });
  }
  const qualityScore = normalizeQualityScore(item);
  const publishQuality = isPublishQualityAllowed(qualityScore);
  if (!publishQuality.allowed) {
    const code = !qualityScore
      ? 'product_video_quality_score_missing'
      : qualityScore.quality_score < 80
        ? 'product_video_quality_score_too_low_for_publish'
        : 'product_video_quality_decision_not_ready';
    throw Object.assign(new Error(publishQuality.reason || code), {
      code,
      status: 409,
      quality_score: qualityScore,
      block_reason: publishQuality.reason,
    });
  }
  const normalizedQualityScore = qualityScore as ProductVideoQualityScore;
  assertBrandTargetPageGuard(item);

  const metadata = await findLatestProductVideoMediaMetadata(item.preview_id);
  const media = buildPlanMedia(item, metadata);
  const publishPlanChecksum = buildProductVideoPublishPlanChecksum(item, metadata);
  const targetPages = await resolvePlanTargetPages(item);
  const primaryTargetPage = targetPages[0] || {
    page_id: getFacebookPageId(item),
    page_name: item.selected_page_name,
    page_key: item.target_page_key,
    platform: item.platform,
    selected_channel_id: item.selected_channel_id || item.selected_page_id,
    facebook_page_id: getFacebookPageId(item),
    token_resolved: false,
    block_reason: 'selected_facebook_page_resolution_failed',
  };

  return {
    plan_id: `publish-plan-preview-${item.preview_id}`,
    preview_id: item.preview_id,
    source_status: 'approved_for_future_publish',
    publish_plan_status: 'publish_plan_ready',
    local_only: true,
    read_only: true,
    target_page: {
      page_id: primaryTargetPage.facebook_page_id,
      page_name: primaryTargetPage.page_name,
      page_key: primaryTargetPage.page_key,
      platform: primaryTargetPage.platform,
    },
    target_pages: targetPages.length > 0 ? targetPages : [primaryTargetPage],
    selected_page_count: targetPages.length > 0 ? targetPages.length : 1,
    quality_score: normalizedQualityScore,
    content: {
      caption: item.marketing_caption || item.caption,
      marketing_caption: item.marketing_caption || item.caption || '',
      publish_caption: item.marketing_caption || item.caption || '',
      brand_context: item.brand_context,
    },
    media,
    safety_summary: {
      approval_decision_is_publish_permission: false,
      real_publish_blocked: true,
      facebook_graph_call_allowed: false,
      line_broadcast_allowed: false,
      schedule_allowed: false,
      renderer_allowed: false,
      phaya_allowed: false,
      s3_upload_allowed: false,
      mark_posted_allowed: false,
    },
    publish_plan_checksum: publishPlanChecksum,
    generated_at: new Date().toISOString(),
    selected_pages: item.selected_pages,
    idempotency_key: `manual-publish-auth-${item.preview_id}-multi-${targetPages.map((page) => page.facebook_page_id).join('_') || getFacebookPageId(item)}-${publishPlanChecksum}`,
    ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  };
}
