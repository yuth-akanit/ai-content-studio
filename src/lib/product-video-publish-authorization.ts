import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  ProductVideoPreviewLogRecord,
  ProductVideoPreviewSafetyFlags,
} from '@/lib/product-video-preview-log';
import {
  ProductVideoPublishPlanPreview,
  buildProductVideoPublishPlanPreview,
} from '@/lib/product-video-publish-plan';

export type ProductVideoPublishAuthorizationStatus = 'publish_authorized_for_manual_execution';

export interface ProductVideoPublishAuthorizationRecord extends ProductVideoPreviewSafetyFlags {
  authorization_id: string;
  preview_id: string;
  status: ProductVideoPublishAuthorizationStatus;
  local_only: true;
  audit_only: true;
  real_posting_enabled: false;
  idempotency_key: string;
  target_page_key: string;
  target_page_id: string;
  target_page_name: string;
  publish_plan_checksum: string;
  publish_plan_status: 'publish_plan_ready';
  media_status: 'not_rendered' | 'ready';
  reason: string | null;
  authorized_at: string;
}

const DEFAULT_PUBLISH_AUTHORIZATION_LOG_PATH = '/app/runtime/product-video-publish-authorizations.jsonl';

function getPublishAuthorizationLogPath(): string {
  return process.env.PRODUCT_VIDEO_PUBLISH_AUTHORIZATION_LOG_PATH || DEFAULT_PUBLISH_AUTHORIZATION_LOG_PATH;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseAuthorizationLine(line: string): ProductVideoPublishAuthorizationRecord | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed.preview_id !== 'string') return null;
    if (typeof parsed.idempotency_key !== 'string') return null;
    if (parsed.status !== 'publish_authorized_for_manual_execution') return null;
    if (parsed.real_posting_enabled !== false) return null;
    if (parsed.publish_allowed !== false) return null;
    if (parsed.facebook_post_performed !== false) return null;
    return parsed as unknown as ProductVideoPublishAuthorizationRecord;
  } catch {
    return null;
  }
}

export function getProductVideoPublishAuthorizationLogPathForDiagnostics(): string {
  return getPublishAuthorizationLogPath();
}

export async function listProductVideoPublishAuthorizations(): Promise<ProductVideoPublishAuthorizationRecord[]> {
  const logPath = getPublishAuthorizationLogPath();
  try {
    const content = await readFile(logPath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map(parseAuthorizationLine)
      .filter((item): item is ProductVideoPublishAuthorizationRecord => Boolean(item));
  } catch {
    return [];
  }
}

export async function authorizeProductVideoPublishPlan(input: {
  item: ProductVideoPreviewLogRecord;
  targetPageKey: string;
  publishPlanChecksum: string;
  idempotencyKey: string;
  reason?: string;
}): Promise<{
  authorization: ProductVideoPublishAuthorizationRecord;
  publish_plan: ProductVideoPublishPlanPreview;
  idempotent_replay: boolean;
}> {
  const targetPageKey = cleanText(input.targetPageKey);
  const publishPlanChecksum = cleanText(input.publishPlanChecksum);
  const idempotencyKey = cleanText(input.idempotencyKey);

  if (!targetPageKey) {
    throw Object.assign(new Error('target_page_key_required'), { code: 'target_page_key_required', status: 400 });
  }
  if (!publishPlanChecksum) {
    throw Object.assign(new Error('publish_plan_checksum_required'), { code: 'publish_plan_checksum_required', status: 400 });
  }
  if (!idempotencyKey) {
    throw Object.assign(new Error('idempotency_key_required'), { code: 'idempotency_key_required', status: 400 });
  }

  const publishPlan = await buildProductVideoPublishPlanPreview(input.item);

  if (!cleanText(input.item.public_media_url)) {
    throw Object.assign(new Error('public_media_url_required_for_authorization'), {
      code: 'public_media_url_required_for_authorization',
      status: 409,
    });
  }

  if (targetPageKey !== publishPlan.target_page.page_key) {
    throw Object.assign(new Error('target_page_key_mismatch'), { code: 'target_page_key_mismatch', status: 409 });
  }
  if (publishPlanChecksum !== publishPlan.publish_plan_checksum) {
    throw Object.assign(new Error('publish_plan_checksum_mismatch'), { code: 'publish_plan_checksum_mismatch', status: 409 });
  }
  const existing = (await listProductVideoPublishAuthorizations()).find(
    (record) => record.preview_id === input.item.preview_id && record.idempotency_key === idempotencyKey,
  );
  if (existing) {
    return {
      authorization: existing,
      publish_plan: publishPlan,
      idempotent_replay: true,
    };
  }

  const authorization: ProductVideoPublishAuthorizationRecord = {
    authorization_id: randomUUID(),
    preview_id: input.item.preview_id,
    status: 'publish_authorized_for_manual_execution',
    local_only: true,
    audit_only: true,
    real_posting_enabled: false,
    idempotency_key: idempotencyKey,
    target_page_key: publishPlan.target_page.page_key,
    target_page_id: publishPlan.target_page.page_id,
    target_page_name: publishPlan.target_page.page_name,
    publish_plan_checksum: publishPlan.publish_plan_checksum,
    publish_plan_status: publishPlan.publish_plan_status,
    media_status: publishPlan.media.media_status,
    reason: cleanText(input.reason) || null,
    authorized_at: new Date().toISOString(),
    ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  };

  const logPath = getPublishAuthorizationLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, `${JSON.stringify(authorization)}\n`, { flag: 'a' });

  return {
    authorization,
    publish_plan: publishPlan,
    idempotent_replay: false,
  };
}
