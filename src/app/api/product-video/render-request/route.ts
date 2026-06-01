import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
  updateProductVideoPreviewLog,
} from '@/lib/product-video-preview-log';
import { findLatestProductVideoMediaMetadata, appendProductVideoMockMediaMetadata } from '@/lib/product-video-media-metadata';
import { forwardRenderRequestToExternal, validatePublicMediaUrl } from '@/lib/product-video-render-adapter';

export const dynamic = 'force-dynamic';

interface RenderRequestBody {
  preview_id?: unknown;
  brand_context?: unknown;
  asset_id?: unknown;
  brief?: unknown;
  marketing_caption?: unknown;
  scene_script?: unknown;
  overlay_texts?: unknown;
  selected_pages?: unknown;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

    // Determine payload details
    const assetId = cleanText(body.asset_id) || item.asset_id || '';
    const brief = cleanText(body.brief) || item.brief || '';
    const marketingCaption = cleanText(body.marketing_caption) || item.marketing_caption || item.caption;
    const sceneScript = cleanText(body.scene_script) || item.scene_script || '';
    const overlayTexts = cleanText(body.overlay_texts) || item.overlay_texts || '';
    const selectedPagesList = Array.isArray(body.selected_pages) ? body.selected_pages : [];

    // Forward request if external renderer is enabled
    const forwardResult = await forwardRenderRequestToExternal({
      preview_id: previewId,
      brand_context: item.brand_context,
      asset_id: assetId,
      brief: brief,
      marketing_caption: marketingCaption,
      scene_script: sceneScript,
      overlay_texts: overlayTexts,
      selected_pages: selectedPagesList,
    });

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

      const jobId = forwardResult.job_id || `job-${previewId}`;

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
          render_job_id: jobId,
          render_status: 'mock_render_ready',
          public_media_url: forwardResult.public_media_url,
          media_checksum: forwardResult.media_checksum || `md5-${previewId}`,
          media_status: 'ready',
          media_type: forwardResult.media_type || 'video',
          asset_id: assetId,
          brief: brief,
          marketing_caption: marketingCaption,
          scene_script: sceneScript,
          overlay_texts: overlayTexts,
          selected_pages: JSON.stringify(selectedPagesList),
        });

        return NextResponse.json({
          ok: true,
          job_id: jobId,
          status: 'mock_render_ready',
          public_media_url: forwardResult.public_media_url,
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
          asset_id: assetId,
          brief: brief,
          marketing_caption: marketingCaption,
          scene_script: sceneScript,
          overlay_texts: overlayTexts,
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
