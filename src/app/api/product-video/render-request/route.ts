import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
  updateProductVideoPreviewLog,
} from '@/lib/product-video-preview-log';
import { findLatestProductVideoMediaMetadata, appendProductVideoMockMediaMetadata } from '@/lib/product-video-media-metadata';
import { forwardRenderRequestToExternal, validatePublicImageUrl, validatePublicMediaUrl } from '@/lib/product-video-render-adapter';

export const dynamic = 'force-dynamic';

interface RenderRequestBody {
  preview_id?: unknown;
  brand_context?: unknown;
  asset_id?: unknown;
  uploaded_asset_id?: unknown;
  public_image_url?: unknown;
  image_urls?: unknown;
  brief?: unknown;
  marketing_caption?: unknown;
  scene_script?: unknown;
  overlay_texts?: unknown;
  selected_pages?: unknown;
  target_page_key?: unknown;
  selected_page_id?: unknown;
  selected_page_name?: unknown;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

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

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}

function parseSelectedPages(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: RenderRequestBody;
    try {
      body = await request.json() as RenderRequestBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'invalid_json', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 400 }
      );
    }

    const previewId = cleanText(body.preview_id);
    if (!previewId) {
      return NextResponse.json(
        { ok: false, error: 'preview_id_required', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 400 }
      );
    }

    const item = await findProductVideoPreviewLogById(previewId);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'preview_log_not_found', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 404 }
      );
    }

    const assetId = cleanText(body.asset_id) || cleanText(body.uploaded_asset_id) || item.uploaded_asset_id || item.asset_id || '';
    const uploadedAssetId = cleanText(body.uploaded_asset_id) || assetId;
    const bodyImageUrls = cleanStringArray(body.image_urls);
    const itemImageUrls = Array.isArray(item.image_urls) ? item.image_urls.map(cleanText).filter(Boolean) : [];
    const publicImageUrl = cleanText(body.public_image_url) || item.public_image_url || bodyImageUrls[0] || itemImageUrls[0] || '';
    const imageUrls = publicImageUrl
      ? Array.from(new Set([publicImageUrl, ...bodyImageUrls, ...itemImageUrls]))
      : Array.from(new Set([...bodyImageUrls, ...itemImageUrls]));
    const brief = cleanText(body.brief) || item.brief || '';
    const marketingCaption = cleanText(body.marketing_caption) || item.marketing_caption || item.caption;
    const sceneScript = cleanText(body.scene_script) || item.scene_script || '';
    const overlayTexts = cleanText(body.overlay_texts) || item.overlay_texts || '';
    const selectedPagesList = parseSelectedPages(body.selected_pages).length > 0
      ? parseSelectedPages(body.selected_pages)
      : parseSelectedPages(item.selected_pages);
    const targetPageKey = cleanText(body.target_page_key) || item.target_page_key || '';
    const selectedPageId = cleanText(body.selected_page_id) || item.selected_page_id || '';
    const selectedPageName = cleanText(body.selected_page_name) || item.selected_page_name || '';

    if (!assetId || !publicImageUrl || imageUrls.length === 0 || isFallbackAppIconUrl(publicImageUrl) || !isUploadedProductVideoAssetUrl(publicImageUrl)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'real_uploaded_product_video_asset_required',
          message: 'Use a real uploaded Product Video asset URL, not the app-icon fallback',
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 400 },
      );
    }

    if (!publicImageUrl || imageUrls.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'image_public_url_required',
          message: 'Upload an image before rendering',
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 400 },
      );
    }

    const imageValidation = await validatePublicImageUrl(publicImageUrl);
    if (!imageValidation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'image_public_url_not_reachable',
          message: 'Uploaded image public URL is not reachable by the app container',
          validation_status: imageValidation.status || null,
          validation_content_type: imageValidation.contentType || null,
          validation_error: imageValidation.error || null,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 400 },
      );
    }

    const renderPayload = {
      preview_id: previewId,
      brand_context: item.brand_context,
      asset_id: assetId,
      uploaded_asset_id: uploadedAssetId,
      public_image_url: publicImageUrl,
      image_urls: imageUrls,
      brief,
      marketing_caption: marketingCaption,
      scene_script: sceneScript,
      overlay_texts: overlayTexts,
      selected_pages: selectedPagesList,
      target_page_key: targetPageKey,
      selected_page_id: selectedPageId,
      selected_page_name: selectedPageName,
    };

    // Forward request if external renderer is enabled
    const forwardResult = await forwardRenderRequestToExternal(renderPayload);

    if (forwardResult.forwarded) {
      if (!forwardResult.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: forwardResult.reason || 'render_failed',
            message: `Renderer returned an error: ${forwardResult.reason}`,
            ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
          },
          { status: 500 }
        );
      }

      const jobId = forwardResult.render_job_id || forwardResult.job_id || `job-${previewId}`;

      if (forwardResult.public_media_url) {
        // Validate URL HTTP 200/206
        const validation = await validatePublicMediaUrl(forwardResult.public_media_url);
        if (!validation.ok) {
          return NextResponse.json(
            {
              ok: false,
              error: 'media_url_validation_failed',
              message: `Public media URL validation failed: ${validation.error}`,
              status: 'render_failed',
              ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
            },
            { status: 400 }
          );
        }

        // Try writing to metadata log (ignores prefix constraint failure in MVP mode)
        try {
          if (forwardResult.public_media_url.startsWith('https://admin.paaair.online/media/')) {
            await appendProductVideoMockMediaMetadata({
              previewId,
              mediaType: forwardResult.media_type || 'video',
              publicMediaUrl: forwardResult.public_media_url,
              mediaChecksum: forwardResult.media_checksum || `md5-${previewId}`,
            });
          }
        } catch (e) {
          console.warn('[product-video] append mock media metadata bypassed', e);
        }

        await updateProductVideoPreviewLog(previewId, {
          status: 'rendered',
          render_job_id: jobId,
          render_status: 'rendered',
          public_media_url: forwardResult.public_media_url,
          thumbnail_url: forwardResult.thumbnail_url || undefined,
          media_checksum: forwardResult.media_checksum || `md5-${previewId}`,
          media_status: 'ready',
          media_type: forwardResult.media_type || 'video',
          renderer_called: true,
          error: null,
          facebook_post_performed: false,
          line_broadcast_performed: false,
          schedule_enabled: false,
          mark_posted_performed: false,
          asset_id: assetId,
          uploaded_asset_id: uploadedAssetId,
          public_image_url: publicImageUrl,
          image_urls: imageUrls,
          brief: brief,
          marketing_caption: marketingCaption,
          scene_script: sceneScript,
          overlay_texts: overlayTexts,
          creative_angle: forwardResult.creative_angle || item.creative_angle,
          voiceover_style: forwardResult.voiceover_style || item.voiceover_style,
          opening_pattern: forwardResult.opening_pattern || item.opening_pattern,
          scene_variation_seed: forwardResult.scene_variation_seed || item.scene_variation_seed,
          voiceover_full: forwardResult.voiceover_full || item.voiceover_full,
          selected_pages: JSON.stringify(selectedPagesList),
        });

        return NextResponse.json({
          ok: true,
          job_id: jobId,
          render_job_id: jobId,
          status: 'rendered',
          render_status: 'rendered',
          media_status: 'ready',
          public_media_url: forwardResult.public_media_url,
          thumbnail_url: forwardResult.thumbnail_url || null,
          media_type: forwardResult.media_type || 'video',
          media_checksum: forwardResult.media_checksum || `md5-${previewId}`,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
          mock_render: false,
          renderer_called: true,
        });
      } else {
        // Async rendering flow: status is render_pending
        await updateProductVideoPreviewLog(previewId, {
          render_job_id: jobId,
          render_status: 'render_pending',
          renderer_called: true,
          error: null,
          asset_id: assetId,
          uploaded_asset_id: uploadedAssetId,
          public_image_url: publicImageUrl,
          image_urls: imageUrls,
          brief: brief,
          marketing_caption: marketingCaption,
          scene_script: sceneScript,
          overlay_texts: overlayTexts,
          creative_angle: forwardResult.creative_angle || item.creative_angle,
          voiceover_style: forwardResult.voiceover_style || item.voiceover_style,
          opening_pattern: forwardResult.opening_pattern || item.opening_pattern,
          scene_variation_seed: forwardResult.scene_variation_seed || item.scene_variation_seed,
          voiceover_full: forwardResult.voiceover_full || item.voiceover_full,
          selected_pages: JSON.stringify(selectedPagesList),
        });

        return NextResponse.json({
          ok: true,
          job_id: jobId,
          status: 'render_pending',
          public_media_url: null,
          media_type: 'video',
          media_checksum: null,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
          mock_render: false,
          renderer_called: true,
        });
      }
    }

    // Default mock behavior if renderer forwarding is disabled
    const jobId = `job-${previewId}`;
    const metadata = await findLatestProductVideoMediaMetadata(previewId);
    const hasFixture = Boolean(metadata);
    const status = hasFixture ? 'mock_render_ready' : 'render_pending';

    await updateProductVideoPreviewLog(previewId, {
      render_job_id: jobId,
      render_status: status,
      asset_id: assetId,
      uploaded_asset_id: uploadedAssetId,
      public_image_url: publicImageUrl,
      image_urls: imageUrls,
      brief: brief,
      marketing_caption: marketingCaption,
      scene_script: sceneScript,
      overlay_texts: overlayTexts,
      selected_pages: JSON.stringify(selectedPagesList),
      public_media_url: metadata?.public_media_url || item.public_media_url,
      media_checksum: metadata?.media_checksum || item.media_checksum,
      media_status: metadata ? 'ready' : item.media_status,
      media_type: metadata?.media_type || item.media_type,
    });

    return NextResponse.json({
      ok: true,
      mock_render: true,
      job_id: jobId,
      status,
      public_media_url: metadata?.public_media_url || null,
      media_type: metadata?.media_type || 'video',
      media_checksum: metadata?.media_checksum || null,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
    });
  } catch (error) {
    console.error('[product-video-render] request failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'render_request_failed',
        message: error instanceof Error ? error.message : String(error),
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 500 }
    );
  }
}
