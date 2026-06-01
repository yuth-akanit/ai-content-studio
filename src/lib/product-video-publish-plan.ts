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
  content: {
    caption: string;
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
}

function buildPlanMedia(metadata: ProductVideoMediaMetadataRecord | null): ProductVideoPublishPlanMedia {
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
  const media = buildPlanMedia(metadata);
  const checksumPayload = {
    preview_id: item.preview_id,
    source_status: item.status,
    target_page: {
      page_id: getFacebookPageId(item),
      page_name: item.selected_page_name,
      page_key: item.target_page_key,
      platform: item.platform,
    },
    content: {
      caption: item.caption,
      brand_context: item.brand_context,
    },
    media: {
      media_kind: media.media_kind,
      media_status: media.media_status,
      media_type: media.media_type,
      media_url: media.media_url,
      public_media_url: media.public_media_url,
      media_checksum: media.media_checksum,
      source: media.source,
    },
    safety_flags: PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
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
  assertBrandTargetPageGuard(item);

  const metadata = await findLatestProductVideoMediaMetadata(item.preview_id);
  const media = buildPlanMedia(metadata);
  const publishPlanChecksum = buildProductVideoPublishPlanChecksum(item, metadata);

  return {
    plan_id: `publish-plan-preview-${item.preview_id}`,
    preview_id: item.preview_id,
    source_status: 'approved_for_future_publish',
    publish_plan_status: 'publish_plan_ready',
    local_only: true,
    read_only: true,
    target_page: {
      page_id: getFacebookPageId(item),
      page_name: item.selected_page_name,
      page_key: item.target_page_key,
      platform: item.platform,
    },
    content: {
      caption: item.caption,
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
    ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  };
}
