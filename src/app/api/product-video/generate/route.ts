import { NextRequest, NextResponse } from 'next/server';
import { appendProductVideoPreviewLog, PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS } from '@/lib/product-video-preview-log';
import {
  redactProductVideoFacebookPage,
  resolveProductVideoSelectedFacebookPage,
} from '@/lib/product-video-facebook-page';
import { validateMarketingCaption } from '@/lib/product-video-caption-validator';
import { generateDeterministicAIContent } from '@/lib/product-video-ai-generator';

export const dynamic = 'force-dynamic';

type ProductVideoPlatform = 'facebook_page' | 'facebook' | 'line' | string;
type BrandContext = 'syncflow' | 'paa_air' | 'paa' | string;

interface ProductVideoGenerateRequest {
  brand_context?: BrandContext;
  target_page_key?: string;
  selected_channel_id?: string;
  selected_page_id?: string;
  selected_page_name?: string;
  platform?: ProductVideoPlatform;
  caption?: string;
  marketing_caption?: string;
  preview_note?: string;
  preview_only?: boolean;
  real_posting_enabled?: boolean;
  line_broadcast_enabled?: boolean;
  schedule_enabled?: boolean;
  access_token?: unknown;
  page_access_token?: unknown;

  // New fields
  asset_id?: string;
  uploaded_asset_id?: string;
  public_image_url?: string;
  image_urls?: string[];
  brief?: string;
  selected_pages?: string[];
}

interface ProductVideoPayload {
  brand_context: string;
  target_page_key: string;
  selected_channel_id: string;
  selected_page_id: string;
  selected_page_name: string;
  external_id: string;
  facebook_page_id: string;
  platform: ProductVideoPlatform;
  caption: string;
  marketing_caption: string;
  preview_note: string;
  preview_only: true;
  real_posting_enabled: false;
  line_broadcast_enabled: false;
  schedule_enabled: false;

  // New fields
  asset_id?: string;
  uploaded_asset_id?: string;
  public_image_url?: string;
  image_urls?: string[];
  brief?: string;
  selected_pages?: string; // stringified JSON
  video_title?: string;
  hook?: string;
  scene_script?: string;
  overlay_texts?: string;
  hashtags?: string;
  creative_angle?: string;
  voiceover_style?: string;
  opening_pattern?: string;
  scene_variation_seed?: string;
  voiceover_full?: string;
}

const N8N_FORWARD_TIMEOUT_MS = 15_000;

function isFallbackAppIconUrl(value: string): boolean {
  try {
    return new URL(value).pathname === '/app-icon.png';
  } catch {
    return value.endsWith('/app-icon.png');
  }
}

function isUploadedProductVideoAssetUrl(value: string): boolean {
  try {
    return new URL(value).pathname.startsWith('/api/product-video/assets/');
  } catch {
    return value.includes('/api/product-video/assets/');
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function buildPayload(body: ProductVideoGenerateRequest): Promise<ProductVideoPayload> {
  const selectedPagesList = Array.isArray(body.selected_pages) ? body.selected_pages : [];
  const selectedPageSelector =
    clean(body.selected_channel_id) ||
    clean(body.selected_page_id) ||
    (selectedPagesList.length > 0 ? clean(selectedPagesList[0]) : '');

  if (!selectedPageSelector) {
    throw Object.assign(new Error('selected_social_page_required'), {
      code: 'selected_social_page_required',
      status: 400,
    });
  }

  const selectedPage = await resolveProductVideoSelectedFacebookPage(selectedPageSelector);

  const brand = clean(body.brand_context) || 'paa_air';
  const brief = clean(body.brief);
  const aiContent = generateDeterministicAIContent(brand, brief);

  const marketingCaption = clean(body.marketing_caption || body.caption) || aiContent.marketing_caption;
  const previewNote = clean(body.preview_note) || aiContent.preview_note;
  const publicImageUrl = clean(body.public_image_url);
  const assetId = clean(body.asset_id || body.uploaded_asset_id);
  if (!assetId || !publicImageUrl || isFallbackAppIconUrl(publicImageUrl) || !isUploadedProductVideoAssetUrl(publicImageUrl)) {
    throw Object.assign(new Error('real_uploaded_product_video_asset_required'), {
      code: 'real_uploaded_product_video_asset_required',
      status: 400,
    });
  }
  const imageUrls = Array.isArray(body.image_urls)
    ? body.image_urls.map(clean).filter(Boolean)
    : [];
  const normalizedImageUrls = publicImageUrl
    ? Array.from(new Set([publicImageUrl, ...imageUrls]))
    : imageUrls;

  // Resolve all selected pages details
  const resolvedPagesInfo = [];
  for (const pageSel of selectedPagesList) {
    try {
      const pageInfo = await resolveProductVideoSelectedFacebookPage(clean(pageSel));
      resolvedPagesInfo.push({
        page_id: pageInfo.selected_page_id,
        page_name: pageInfo.selected_page_name,
        target_page_key: clean(body.target_page_key) || 'paa_air',
        facebook_page_id: pageInfo.facebook_page_id,
        status: 'pending_authorization',
        publish_plan_checksum: null,
        idempotency_key: null,
        facebook_post_id: null,
        error: null,
      });
    } catch (e) {
      console.warn(`[product-video] could not resolve page detail for ${pageSel}`, e);
    }
  }

  return {
    brand_context: brand,
    target_page_key: clean(body.target_page_key) || 'paa_air',
    selected_channel_id: selectedPage.selected_channel_id,
    selected_page_id: selectedPage.selected_page_id,
    selected_page_name: selectedPage.selected_page_name,
    external_id: selectedPage.external_id,
    facebook_page_id: selectedPage.facebook_page_id,
    platform: 'facebook_page',
    caption: marketingCaption,
    marketing_caption: marketingCaption,
    preview_note: previewNote,
    preview_only: true,
    real_posting_enabled: false,
    line_broadcast_enabled: false,
    schedule_enabled: false,

    // New fields
    asset_id: assetId,
    uploaded_asset_id: assetId,
    public_image_url: publicImageUrl || normalizedImageUrls[0] || '',
    image_urls: normalizedImageUrls,
    brief: brief,
    selected_pages: resolvedPagesInfo.length > 0 ? JSON.stringify(resolvedPagesInfo) : undefined,
    video_title: aiContent.video_title,
    hook: aiContent.hook,
    scene_script: aiContent.scene_script,
    overlay_texts: aiContent.overlay_texts,
    hashtags: aiContent.hashtags,
  };
}

function validatePayload(payload: ProductVideoPayload): string[] {
  const errors: string[] = [];

  if (!payload.brand_context) errors.push('brand_context_required');
  if (!payload.target_page_key) errors.push('target_page_key_required');
  if (!payload.selected_channel_id) errors.push('selected_channel_id_required');
  if (!payload.selected_page_id) errors.push('selected_page_id_required');
  if (!payload.selected_page_name) errors.push('selected_page_name_required');
  if (!payload.external_id) errors.push('external_id_required');
  if (!payload.facebook_page_id) errors.push('facebook_page_id_required');
  if (!payload.platform) errors.push('platform_required');

  if (payload.brand_context === 'syncflow' && payload.target_page_key !== 'syncflow') {
    errors.push('syncflow_requires_target_page_key_syncflow');
  }

  if ((payload.brand_context === 'paa' || payload.brand_context === 'paa_air') && payload.target_page_key !== 'paa_air') {
    errors.push('paa_requires_target_page_key_paa_air');
  }

  const captionErrors = validateMarketingCaption(payload.marketing_caption, payload.brand_context);
  errors.push(...captionErrors);

  return errors;
}

async function forwardToN8n(payload: ProductVideoPayload) {
  const webhookUrl = process.env.PRODUCT_VIDEO_N8N_WEBHOOK_URL;
  const forwardEnabled = process.env.PRODUCT_VIDEO_N8N_FORWARD_ENABLED === 'true';

  if (!webhookUrl || !forwardEnabled) {
    return {
      forwarded: false,
      reason: 'n8n_forward_disabled',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_FORWARD_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const renderJobId = typeof data.render_job_id === 'string'
      ? data.render_job_id.trim()
      : (typeof data.job_id === 'string' ? data.job_id.trim() : '');
    const publicMediaUrl = typeof data.public_media_url === 'string' ? data.public_media_url.trim() : '';
    const thumbnailUrl = typeof data.thumbnail_url === 'string' ? data.thumbnail_url.trim() : '';
    const renderStatus = typeof data.render_status === 'string'
      ? data.render_status.trim()
      : (typeof data.status === 'string' ? data.status.trim() : '');
    const rendererCalled = data.renderer_called === true;
    const creativeFields = {
      creative_angle: typeof data.creative_angle === 'string' ? data.creative_angle.trim() : '',
      voiceover_style: typeof data.voiceover_style === 'string' ? data.voiceover_style.trim() : '',
      opening_pattern: typeof data.opening_pattern === 'string' ? data.opening_pattern.trim() : '',
      scene_variation_seed: typeof data.scene_variation_seed === 'string' ? data.scene_variation_seed.trim() : '',
      voiceover_full: typeof data.voiceover_full === 'string' ? data.voiceover_full.trim() : '',
    };

    return {
      forwarded: true,
      ok: response.ok,
      status: response.status,
      response_body_exposed: false,
      render_job_id: renderJobId,
      render_status: renderStatus,
      public_media_url: publicMediaUrl,
      thumbnail_url: thumbnailUrl,
      media_type: typeof data.media_type === 'string' ? data.media_type.trim() : '',
      media_status: typeof data.media_status === 'string' ? data.media_status.trim() : '',
      renderer_called: rendererCalled,
      ...creativeFields,
    };
  } catch {
    return {
      forwarded: false,
      ok: false,
      reason: 'n8n_forward_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const supabase_diagnostics = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_SERVICE_KEY: Boolean(process.env.SUPABASE_SERVICE_KEY),
    SUPABASE_SERVICE_ROLE: Boolean(process.env.SUPABASE_SERVICE_ROLE),
  };

  try {
    const body = await request.json() as ProductVideoGenerateRequest;
    if (body.access_token || body.page_access_token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'request_body_token_rejected',
          supabase_diagnostics,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS
        },
        { status: 400 },
      );
    }

    const payload = await buildPayload(body);
    const validationErrors = validatePayload(payload);

    const guard = {
      preview_only: payload.preview_only,
      real_posting_enabled: payload.real_posting_enabled,
      line_broadcast_enabled: payload.line_broadcast_enabled,
      schedule_enabled: payload.schedule_enabled,
      n8n_called_from_client: false,
      validation_errors: validationErrors,
    };

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_product_video_request',
          message: 'Invalid product video request',
          validation_errors: validationErrors,
          supabase_diagnostics,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
          guard,
          payload,
        },
        { status: 400 },
      );
    }

    const n8n = await forwardToN8n(payload);
    const n8nStatus = ('status' in n8n && typeof n8n.status === 'number') ? n8n.status : null;
    const responseBodyExposed = 'response_body_exposed' in n8n ? n8n.response_body_exposed : false;
    const previewSafetyLocked =
      payload.preview_only === true &&
      payload.real_posting_enabled === false &&
      payload.line_broadcast_enabled === false &&
      payload.schedule_enabled === false &&
      responseBodyExposed === false;
    const n8nPublicMediaUrl = ('public_media_url' in n8n && typeof n8n.public_media_url === 'string') ? n8n.public_media_url : '';
    const n8nThumbnailUrl = ('thumbnail_url' in n8n && typeof n8n.thumbnail_url === 'string') ? n8n.thumbnail_url : '';
    const n8nRenderJobId = ('render_job_id' in n8n && typeof n8n.render_job_id === 'string') ? n8n.render_job_id : '';
    const n8nRenderStatus = ('render_status' in n8n && typeof n8n.render_status === 'string') ? n8n.render_status : '';
    const n8nMediaType = ('media_type' in n8n && typeof n8n.media_type === 'string') ? n8n.media_type : '';
    const n8nMediaStatus = ('media_status' in n8n && typeof n8n.media_status === 'string') ? n8n.media_status : '';
    const n8nCreativeAngle = ('creative_angle' in n8n && typeof n8n.creative_angle === 'string') ? n8n.creative_angle : '';
    const n8nVoiceoverStyle = ('voiceover_style' in n8n && typeof n8n.voiceover_style === 'string') ? n8n.voiceover_style : '';
    const n8nOpeningPattern = ('opening_pattern' in n8n && typeof n8n.opening_pattern === 'string') ? n8n.opening_pattern : '';
    const n8nSceneVariationSeed = ('scene_variation_seed' in n8n && typeof n8n.scene_variation_seed === 'string') ? n8n.scene_variation_seed : '';
    const n8nVoiceoverFull = ('voiceover_full' in n8n && typeof n8n.voiceover_full === 'string') ? n8n.voiceover_full : '';
    const n8nRendererCalled = 'renderer_called' in n8n && n8n.renderer_called === true;
    const n8nRendered = n8n.forwarded && n8nStatus === 200 && n8nPublicMediaUrl.length > 0;

    if (!n8n.forwarded || n8nStatus !== 200 || !previewSafetyLocked) {
      return NextResponse.json(
        {
          ok: false,
          error: 'product_video_preview_not_queued',
          message: 'Product Video preview was not queued because n8n did not return HTTP 200.',
          n8n_forwarded: n8n.forwarded,
          n8n_status: n8nStatus,
          response_body_exposed: responseBodyExposed,
          preview_log_created: false,
          preview_log: null,
          preview_only: guard.preview_only,
          real_posting_enabled: guard.real_posting_enabled,
          line_broadcast_enabled: guard.line_broadcast_enabled,
          supabase_diagnostics,
          guard,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 502 },
      );
    }

    const shouldCreateLog = n8n.forwarded && n8nStatus === 200 && previewSafetyLocked;

    const previewLog = shouldCreateLog
      ? await appendProductVideoPreviewLog({
        brand_context: payload.brand_context,
        target_page_key: payload.target_page_key,
        selected_channel_id: payload.selected_channel_id,
        selected_page_id: payload.selected_page_id,
        selected_page_name: payload.selected_page_name,
        external_id: payload.external_id,
        facebook_page_id: payload.facebook_page_id,
        platform: payload.platform,
        caption: payload.caption,
        marketing_caption: payload.marketing_caption,
        preview_note: payload.preview_note,
        n8n_forwarded: n8n.forwarded,
        n8n_status: n8nStatus,
        response_body_exposed: false,

        // New fields
        asset_id: payload.asset_id,
        uploaded_asset_id: payload.uploaded_asset_id,
        public_image_url: payload.public_image_url,
        image_urls: payload.image_urls,
        brief: payload.brief,
        selected_pages: payload.selected_pages,
        video_title: payload.video_title,
        hook: payload.hook,
        scene_script: payload.scene_script,
        overlay_texts: payload.overlay_texts,
        hashtags: payload.hashtags,
        creative_angle: n8nCreativeAngle || payload.creative_angle,
        voiceover_style: n8nVoiceoverStyle || payload.voiceover_style,
        opening_pattern: n8nOpeningPattern || payload.opening_pattern,
        scene_variation_seed: n8nSceneVariationSeed || payload.scene_variation_seed,
        voiceover_full: n8nVoiceoverFull || payload.voiceover_full,
        status: n8nRendered ? 'rendered' : 'pending_owner_review',
        render_status: n8nRendered ? 'rendered' : (n8nRenderStatus || undefined),
        media_status: n8nRendered ? 'ready' : (n8nMediaStatus || undefined),
        public_media_url: n8nPublicMediaUrl || undefined,
        thumbnail_url: n8nThumbnailUrl || undefined,
        render_job_id: n8nRenderJobId || undefined,
        media_type: n8nRendered ? (n8nMediaType || 'video') : (n8nMediaType || undefined),
        renderer_called: n8nRendererCalled || n8nRendered,
        error: null,
      })
      : null;

    return NextResponse.json({
      ok: true,
      status: n8n.forwarded ? 'forwarded_to_server_side_wrapper_target' : 'preview_payload_ready',
      n8n_forwarded: n8n.forwarded,
      n8n_status: n8nStatus,
      response_body_exposed: responseBodyExposed,
      preview_only: guard.preview_only,
      real_posting_enabled: guard.real_posting_enabled,
      line_broadcast_enabled: guard.line_broadcast_enabled,
      schedule_enabled: guard.schedule_enabled,
      preview_log_created: Boolean(previewLog),
      preview_log: previewLog,
      selected_facebook_page: redactProductVideoFacebookPage({
        selected_channel_id: payload.selected_channel_id,
        selected_page_id: payload.selected_page_id,
        selected_page_name: payload.selected_page_name,
        external_id: payload.external_id,
        facebook_page_id: payload.facebook_page_id,
        provider: 'facebook',
        status: 'active',
        page_access_token: 'redacted-present',
      }),
      supabase_diagnostics,
      guard,
      payload,
      n8n,
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'failed_to_prepare_product_video_request';

    if (status >= 500) {
      console.error('[product-video] generate wrapper failed', error);
    }
    return NextResponse.json(
      {
        ok: false,
        error: code,
        message: error instanceof Error ? error.message : String(error),
        supabase_diagnostics,
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status },
    );
  }
}
