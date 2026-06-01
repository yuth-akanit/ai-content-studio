import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  ProductVideoPreviewLogRecord,
  ProductVideoPreviewSafetyFlags,
} from '@/lib/product-video-preview-log';

export type ProductVideoPublishPlanStatus = 'publish_plan_ready';

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
  media: {
    media_kind: 'product_video_preview';
    media_status: 'not_rendered';
    media_url: null;
    renderer_required_before_real_publish: true;
  };
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
  generated_at: string;
}

export function buildProductVideoPublishPlanPreview(
  item: ProductVideoPreviewLogRecord,
): ProductVideoPublishPlanPreview {
  if (item.status !== 'approved_for_future_publish') {
    throw Object.assign(new Error('preview_log_not_approved_for_publish_plan'), {
      code: 'preview_log_not_approved_for_publish_plan',
      status: 409,
    });
  }

  return {
    plan_id: `publish-plan-preview-${item.preview_id}`,
    preview_id: item.preview_id,
    source_status: 'approved_for_future_publish',
    publish_plan_status: 'publish_plan_ready',
    local_only: true,
    read_only: true,
    target_page: {
      page_id: item.selected_page_id,
      page_name: item.selected_page_name,
      page_key: item.target_page_key,
      platform: item.platform,
    },
    content: {
      caption: item.caption,
      brand_context: item.brand_context,
    },
    media: {
      media_kind: 'product_video_preview',
      media_status: 'not_rendered',
      media_url: null,
      renderer_required_before_real_publish: true,
    },
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
    generated_at: new Date().toISOString(),
    ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  };
}
