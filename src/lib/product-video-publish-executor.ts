import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  ProductVideoPreviewLogRecord,
  ProductVideoPreviewSafetyFlags,
} from '@/lib/product-video-preview-log';
import {
  ProductVideoPublishAuthorizationRecord,
  listProductVideoPublishAuthorizations,
} from '@/lib/product-video-publish-authorization';
import {
  ProductVideoPublishPlanPreview,
  buildProductVideoPublishPlanPreview,
} from '@/lib/product-video-publish-plan';

export type ProductVideoPublishExecutionDryRunStatus = 'publish_execution_blocked';
export type ProductVideoPublishExecutionBlockReason = 'media_not_rendered';

export interface ProductVideoPublishExecutionDryRunAudit extends ProductVideoPreviewSafetyFlags {
  execution_audit_id: string;
  preview_id: string;
  authorization_id: string;
  status: ProductVideoPublishExecutionDryRunStatus;
  block_reason: ProductVideoPublishExecutionBlockReason;
  local_only: true;
  dry_run: true;
  audit_only: true;
  safe_to_audit: true;
  real_posting_enabled: false;
  idempotency_key: string;
  target_page_key: string;
  publish_plan_checksum: string;
  publish_plan_status: 'publish_plan_ready';
  authorization_status: 'publish_authorized_for_manual_execution';
  media_status: 'not_rendered';
  execution_plan: ProductVideoPublishExecutionPlan;
  audited_at: string;
}

export interface ProductVideoPublishExecutionPlan extends ProductVideoPreviewSafetyFlags {
  preview_id: string;
  execution_mode: 'dry_run';
  local_only: true;
  dry_run: true;
  would_publish_to: {
    platform: string;
    target_page_key: string;
    target_page_id: string;
    target_page_name: string;
  };
  content: {
    caption: string;
    brand_context: string;
  };
  media: {
    media_status: 'not_rendered';
    media_url: null;
    block_real_publish_until_rendered: true;
  };
  verified_gates: {
    preview_id_valid: true;
    preview_status_approved: true;
    publish_plan_ready: true;
    publish_authorized_for_manual_execution: true;
    target_page_key_verified: true;
    publish_plan_checksum_verified: true;
    idempotency_key_verified: true;
  };
}

const DEFAULT_PUBLISH_EXECUTION_DRY_RUN_AUDIT_PATH = '/app/runtime/product-video-publish-execution-dry-runs.jsonl';

function getPublishExecutionDryRunAuditPath(): string {
  return process.env.PRODUCT_VIDEO_PUBLISH_EXECUTION_DRY_RUN_AUDIT_PATH || DEFAULT_PUBLISH_EXECUTION_DRY_RUN_AUDIT_PATH;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseExecutionDryRunAuditLine(line: string): ProductVideoPublishExecutionDryRunAudit | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) return null;
    if (parsed.status !== 'publish_execution_blocked') return null;
    if (parsed.block_reason !== 'media_not_rendered') return null;
    if (typeof parsed.preview_id !== 'string') return null;
    if (typeof parsed.idempotency_key !== 'string') return null;
    if (parsed.safe_to_audit !== true) return null;
    if (parsed.real_posting_enabled !== false) return null;
    if (parsed.publish_allowed !== false) return null;
    if (parsed.facebook_post_performed !== false) return null;
    return parsed as unknown as ProductVideoPublishExecutionDryRunAudit;
  } catch {
    return null;
  }
}

export function getProductVideoPublishExecutionDryRunAuditPathForDiagnostics(): string {
  return getPublishExecutionDryRunAuditPath();
}

export async function listProductVideoPublishExecutionDryRunAudits(): Promise<ProductVideoPublishExecutionDryRunAudit[]> {
  const auditPath = getPublishExecutionDryRunAuditPath();
  try {
    const content = await readFile(auditPath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map(parseExecutionDryRunAuditLine)
      .filter((item): item is ProductVideoPublishExecutionDryRunAudit => Boolean(item));
  } catch {
    return [];
  }
}

function findMatchingAuthorization(
  authorizations: ProductVideoPublishAuthorizationRecord[],
  input: {
    previewId: string;
    targetPageKey: string;
    publishPlanChecksum: string;
    idempotencyKey: string;
  },
): ProductVideoPublishAuthorizationRecord | null {
  return authorizations.find((record) => (
    record.preview_id === input.previewId
    && record.status === 'publish_authorized_for_manual_execution'
    && record.target_page_key === input.targetPageKey
    && record.publish_plan_checksum === input.publishPlanChecksum
    && record.idempotency_key === input.idempotencyKey
    && record.real_posting_enabled === false
    && record.publish_allowed === false
    && record.facebook_post_performed === false
  )) || null;
}

function buildExecutionPlan(
  item: ProductVideoPreviewLogRecord,
  publishPlan: ProductVideoPublishPlanPreview,
): ProductVideoPublishExecutionPlan {
  return {
    preview_id: item.preview_id,
    execution_mode: 'dry_run',
    local_only: true,
    dry_run: true,
    would_publish_to: {
      platform: publishPlan.target_page.platform,
      target_page_key: publishPlan.target_page.page_key,
      target_page_id: publishPlan.target_page.page_id,
      target_page_name: publishPlan.target_page.page_name,
    },
    content: {
      caption: publishPlan.content.caption,
      brand_context: publishPlan.content.brand_context,
    },
    media: {
      media_status: publishPlan.media.media_status,
      media_url: publishPlan.media.media_url,
      block_real_publish_until_rendered: true,
    },
    verified_gates: {
      preview_id_valid: true,
      preview_status_approved: true,
      publish_plan_ready: true,
      publish_authorized_for_manual_execution: true,
      target_page_key_verified: true,
      publish_plan_checksum_verified: true,
      idempotency_key_verified: true,
    },
    ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  };
}

export async function dryRunProductVideoPublishExecution(input: {
  item: ProductVideoPreviewLogRecord;
  targetPageKey: string;
  publishPlanChecksum: string;
  idempotencyKey: string;
}): Promise<{
  execution_plan: ProductVideoPublishExecutionPlan;
  audit: ProductVideoPublishExecutionDryRunAudit;
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

  const publishPlan = buildProductVideoPublishPlanPreview(input.item);
  if (publishPlan.publish_plan_status !== 'publish_plan_ready') {
    throw Object.assign(new Error('publish_plan_not_ready'), { code: 'publish_plan_not_ready', status: 409 });
  }
  if (targetPageKey !== publishPlan.target_page.page_key) {
    throw Object.assign(new Error('target_page_key_mismatch'), { code: 'target_page_key_mismatch', status: 409 });
  }
  if (publishPlanChecksum !== publishPlan.publish_plan_checksum) {
    throw Object.assign(new Error('publish_plan_checksum_mismatch'), { code: 'publish_plan_checksum_mismatch', status: 409 });
  }

  const authorization = findMatchingAuthorization(await listProductVideoPublishAuthorizations(), {
    previewId: input.item.preview_id,
    targetPageKey,
    publishPlanChecksum,
    idempotencyKey,
  });
  if (!authorization) {
    throw Object.assign(new Error('publish_authorization_not_found'), {
      code: 'publish_authorization_not_found',
      status: 409,
    });
  }

  const executionPlan = buildExecutionPlan(input.item, publishPlan);

  if (publishPlan.media.media_status === 'not_rendered') {
    const existing = (await listProductVideoPublishExecutionDryRunAudits()).find((record) => (
      record.preview_id === input.item.preview_id
      && record.target_page_key === targetPageKey
      && record.publish_plan_checksum === publishPlanChecksum
      && record.idempotency_key === idempotencyKey
      && record.authorization_id === authorization.authorization_id
    ));
    if (existing) {
      return {
        execution_plan: existing.execution_plan,
        audit: existing,
        idempotent_replay: true,
      };
    }

    const audit: ProductVideoPublishExecutionDryRunAudit = {
      execution_audit_id: randomUUID(),
      preview_id: input.item.preview_id,
      authorization_id: authorization.authorization_id,
      status: 'publish_execution_blocked',
      block_reason: 'media_not_rendered',
      local_only: true,
      dry_run: true,
      audit_only: true,
      safe_to_audit: true,
      real_posting_enabled: false,
      idempotency_key: idempotencyKey,
      target_page_key: targetPageKey,
      publish_plan_checksum: publishPlanChecksum,
      publish_plan_status: publishPlan.publish_plan_status,
      authorization_status: authorization.status,
      media_status: publishPlan.media.media_status,
      execution_plan: executionPlan,
      audited_at: new Date().toISOString(),
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
    };

    const auditPath = getPublishExecutionDryRunAuditPath();
    await mkdir(path.dirname(auditPath), { recursive: true });
    await writeFile(auditPath, `${JSON.stringify(audit)}\n`, { flag: 'a' });

    return {
      execution_plan: executionPlan,
      audit,
      idempotent_replay: false,
    };
  }

  throw Object.assign(new Error('unsupported_media_status'), { code: 'unsupported_media_status', status: 409 });
}
