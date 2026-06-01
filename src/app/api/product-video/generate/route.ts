import { NextRequest, NextResponse } from 'next/server';
import { appendProductVideoPreviewLog } from '@/lib/product-video-preview-log';
import {
  redactProductVideoFacebookPage,
  resolveProductVideoSelectedFacebookPage,
} from '@/lib/product-video-facebook-page';
import { validateMarketingCaption } from '@/lib/product-video-caption-validator';

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
}

const N8N_FORWARD_TIMEOUT_MS = 15_000;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function buildPayload(body: ProductVideoGenerateRequest): Promise<ProductVideoPayload> {
  const selectedPageSelector = clean(body.selected_channel_id) || clean(body.selected_page_id);
  const selectedPage = await resolveProductVideoSelectedFacebookPage(selectedPageSelector);

  const marketingCaption = clean(body.marketing_caption || body.caption);
  const previewNote = clean(body.preview_note || 'สร้างวิดีโอสินค้าแบบ preview เท่านั้น ยังไม่โพสต์จริง และยังไม่เปิด schedule');

  return {
    brand_context: clean(body.brand_context),
    target_page_key: clean(body.target_page_key),
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

    await response.arrayBuffer().catch(() => null);

    return {
      forwarded: true,
      ok: response.ok,
      status: response.status,
      response_body_exposed: false,
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
  try {
    const body = await request.json() as ProductVideoGenerateRequest;
    if (body.access_token || body.page_access_token) {
      return NextResponse.json(
        { ok: false, error: 'request_body_token_rejected' },
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
        { ok: false, error: 'Invalid product video request', guard, payload },
        { status: 400 },
      );
    }

    const n8n = await forwardToN8n(payload);
    const n8nStatus = 'status' in n8n ? n8n.status : null;
    const responseBodyExposed = 'response_body_exposed' in n8n ? n8n.response_body_exposed : false;
    const previewSafetyLocked =
      payload.preview_only === true &&
      payload.real_posting_enabled === false &&
      payload.line_broadcast_enabled === false &&
      payload.schedule_enabled === false &&
      responseBodyExposed === false;

    const previewLog = n8n.forwarded && n8nStatus === 200 && previewSafetyLocked
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
      : 'Failed to prepare product video request';

    if (status >= 500) {
      console.error('[product-video] generate wrapper failed', error);
    }
    return NextResponse.json(
      { ok: false, error: code },
      { status },
    );
  }
}
