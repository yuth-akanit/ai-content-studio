export interface RenderRequestPayload {
  preview_id: string;
  brand_context: string;
  asset_id: string;
  brief: string;
  marketing_caption: string;
  scene_script: string;
  overlay_texts: string;
  selected_pages: string[];
}

export interface RenderAdapterResult {
  forwarded: boolean;
  ok: boolean;
  reason?: string;
  job_id?: string;
  status?: string;
  public_media_url?: string | null;
  media_type?: string;
  media_checksum?: string | null;
}

const RENDER_TIMEOUT_MS = 15_000;

export async function forwardRenderRequestToExternal(payload: RenderRequestPayload): Promise<RenderAdapterResult> {
  const forwardEnabled = process.env.PRODUCT_VIDEO_RENDER_FORWARD_ENABLED === 'true';
  const webhookUrl = process.env.PRODUCT_VIDEO_RENDER_WEBHOOK_URL || (process.env.PRODUCT_VIDEO_N8N_WEBHOOK_URL ? `${process.env.PRODUCT_VIDEO_N8N_WEBHOOK_URL}/render` : '');

  if (!forwardEnabled || !webhookUrl) {
    return {
      forwarded: false,
      ok: false,
      reason: 'render_forwarding_disabled',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        forwarded: true,
        ok: false,
        reason: `external_renderer_returned_http_${response.status}`,
      };
    }

    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const publicMediaUrl = typeof data.public_media_url === 'string' ? data.public_media_url.trim() : null;

    if (!publicMediaUrl) {
      // Support async response if status is pending or job_id is returned
      if (data.status === 'render_pending' || data.job_id) {
        return {
          forwarded: true,
          ok: true,
          job_id: typeof data.job_id === 'string' ? data.job_id : `job-${payload.preview_id}`,
          status: 'render_pending',
          public_media_url: null,
          media_type: 'video',
          media_checksum: null,
        };
      }
      return {
        forwarded: true,
        ok: false,
        reason: 'external_renderer_response_missing_public_media_url',
      };
    }

    return {
      forwarded: true,
      ok: true,
      job_id: typeof data.job_id === 'string' ? data.job_id : `job-${payload.preview_id}`,
      status: typeof data.status === 'string' ? data.status : 'mock_render_ready',
      public_media_url: publicMediaUrl,
      media_type: typeof data.media_type === 'string' ? data.media_type : 'video',
      media_checksum: typeof data.media_checksum === 'string' ? data.media_checksum : `md5-${payload.preview_id}`,
    };
  } catch (error) {
    return {
      forwarded: true,
      ok: false,
      reason: error instanceof Error && error.name === 'AbortError' ? 'external_renderer_timeout' : 'external_renderer_network_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function validatePublicMediaUrl(url: string): Promise<{ ok: boolean; contentType?: string; status?: number; error?: string }> {
  try {
    const cleanUrl = (url || '').trim();
    if (!cleanUrl) {
      return { ok: false, error: 'media_url_empty' };
    }

    const parsedUrl = new URL(cleanUrl);
    const response = await fetch(parsedUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
    });

    const contentType = (response.headers.get('content-type') || '').trim().toLowerCase();
    if (response.status !== 200 && response.status !== 206) {
      return { ok: false, status: response.status, contentType, error: 'media_url_not_http_200_or_206' };
    }

    const contentTypeAllowed = contentType.startsWith('video/') || contentType.startsWith('image/');
    if (!contentTypeAllowed) {
      return { ok: false, status: response.status, contentType, error: 'media_url_content_type_invalid' };
    }

    return { ok: true, contentType, status: response.status };
  } catch (err) {
    return { ok: false, error: 'network_error_or_invalid_url' };
  }
}
