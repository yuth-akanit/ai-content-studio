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
import {
  ProductVideoSelectedFacebookPage,
  resolveProductVideoSelectedFacebookPage,
} from '@/lib/product-video-facebook-page';

export type ProductVideoPublishExecutionDryRunStatus =
  | 'publish_execution_blocked'
  | 'publish_execution_ready_dry_run';
export type ProductVideoPublishExecutionBlockReason = 'media_not_rendered' | null;
export type ProductVideoManualPublishExecutionStatus = 'blocked' | 'published';
export type ProductVideoManualPublishExecutionBlockReason =
  | 'manual_execute_required'
  | 'request_real_publish_approval_required'
  | 'real_posting_flag_off'
  | 'preview_already_published'
  | null;

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
  selected_channel_id: string;
  selected_page_id: string;
  selected_page_name: string;
  external_id: string;
  facebook_page_id: string;
  publish_plan_checksum: string;
  publish_plan_status: 'publish_plan_ready';
  authorization_status: 'publish_authorized_for_manual_execution';
  media_status: 'not_rendered' | 'ready';
  execution_plan: ProductVideoPublishExecutionPlan;
  audited_at: string;
}

export interface ProductVideoPublishExecutionPlan extends ProductVideoPreviewSafetyFlags {
  preview_id: string;
  execution_mode: 'dry_run' | 'manual_publish';
  local_only: true;
  dry_run: true;
  would_publish_to: {
    platform: string;
    target_page_key: string;
    selected_channel_id: string;
    external_id: string;
    facebook_page_id: string;
    target_page_id: string;
    target_page_name: string;
  };
  content: {
    caption: string;
    brand_context: string;
  };
  media: {
    media_kind: 'product_video_preview';
    media_status: 'not_rendered' | 'ready';
    media_type: 'video' | 'image' | null;
    media_url: string | null;
    public_media_url: string | null;
    media_checksum: string | null;
    source: 'mock_metadata_only' | null;
    renderer_required_before_real_publish: boolean;
    block_real_publish_until_rendered: boolean;
  };
  verified_gates: {
    preview_id_valid: true;
    preview_status_approved: true;
    publish_plan_ready: true;
    publish_authorized_for_manual_execution: true;
    target_page_key_verified: true;
    publish_plan_checksum_verified: true;
    idempotency_key_verified: true;
    media_gate_passed: boolean;
  };
}

export interface ProductVideoManualPublishExecutionAudit {
  execution_id: string;
  preview_id: string;
  authorization_id: string;
  status: ProductVideoManualPublishExecutionStatus;
  block_reason: ProductVideoManualPublishExecutionBlockReason;
  local_only: true;
  manual_execution: true;
  safe_to_audit: true;
  publish_allowed: boolean;
  real_posting_enabled: boolean;
  facebook_real_publish_flag_enabled: boolean;
  request_scoped_real_publish_approval: boolean;
  idempotency_key: string;
  target_page_key: string;
  selected_channel_id: string;
  selected_page_id: string;
  selected_page_name: string;
  external_id: string;
  facebook_page_id: string;
  publish_plan_checksum: string;
  publish_plan_status: 'publish_plan_ready';
  authorization_status: 'publish_authorized_for_manual_execution';
  media_status: 'ready';
  execution_plan: ProductVideoPublishExecutionPlan;
  facebook_post_performed: boolean;
  facebook_post_id: string | null;
  facebook_graph_endpoint: string | null;
  line_broadcast_performed: false;
  schedule_enabled: false;
  renderer_called: false;
  phaya_called: false;
  s3_upload_performed: false;
  mark_posted_performed: boolean;
  executed_at: string;
}

const DEFAULT_PUBLISH_EXECUTION_DRY_RUN_AUDIT_PATH = '/app/runtime/product-video-publish-execution-dry-runs.jsonl';
const DEFAULT_MANUAL_PUBLISH_EXECUTION_AUDIT_PATH = '/app/runtime/product-video-publish-executions.jsonl';

function getPublishExecutionDryRunAuditPath(): string {
  return process.env.PRODUCT_VIDEO_PUBLISH_EXECUTION_DRY_RUN_AUDIT_PATH || DEFAULT_PUBLISH_EXECUTION_DRY_RUN_AUDIT_PATH;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getManualPublishExecutionAuditPath(): string {
  return process.env.PRODUCT_VIDEO_PUBLISH_EXECUTION_AUDIT_PATH || DEFAULT_MANUAL_PUBLISH_EXECUTION_AUDIT_PATH;
}

function isRealFacebookPublishEnabled(): boolean {
  return process.env.PRODUCT_VIDEO_REAL_FACEBOOK_PUBLISH_ENABLED === 'true'
    && process.env.PRODUCT_VIDEO_MANUAL_PUBLISH_EXECUTE_APPROVED === 'true';
}

function isTruthy(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

function buildBlockedManualExecution(
  input: {
    item: ProductVideoPreviewLogRecord;
    authorization: ProductVideoPublishAuthorizationRecord;
    targetPageKey: string;
    publishPlanChecksum: string;
    idempotencyKey: string;
    executionPlan: ProductVideoPublishExecutionPlan;
    blockReason: Exclude<ProductVideoManualPublishExecutionBlockReason, null>;
    realPostingEnabled: boolean;
    requestScopedRealPublishApproval: boolean;
    selectedPage: ProductVideoSelectedFacebookPage;
  },
): ProductVideoManualPublishExecutionAudit {
  return {
    execution_id: randomUUID(),
    preview_id: input.item.preview_id,
    authorization_id: input.authorization.authorization_id,
    status: 'blocked',
    block_reason: input.blockReason,
    local_only: true,
    manual_execution: true,
    safe_to_audit: true,
    publish_allowed: false,
    real_posting_enabled: input.realPostingEnabled,
    facebook_real_publish_flag_enabled: isRealFacebookPublishEnabled(),
    request_scoped_real_publish_approval: input.requestScopedRealPublishApproval,
    idempotency_key: input.idempotencyKey,
    target_page_key: input.targetPageKey,
    selected_channel_id: input.selectedPage.selected_channel_id,
    selected_page_id: input.selectedPage.selected_page_id,
    selected_page_name: input.selectedPage.selected_page_name,
    external_id: input.selectedPage.external_id,
    facebook_page_id: input.selectedPage.facebook_page_id,
    publish_plan_checksum: input.publishPlanChecksum,
    publish_plan_status: 'publish_plan_ready',
    authorization_status: input.authorization.status,
    media_status: 'ready',
    execution_plan: input.executionPlan,
    facebook_post_performed: false,
    facebook_post_id: null,
    facebook_graph_endpoint: null,
    line_broadcast_performed: false,
    schedule_enabled: false,
    renderer_called: false,
    phaya_called: false,
    s3_upload_performed: false,
    mark_posted_performed: false,
    executed_at: new Date().toISOString(),
  };
}

async function publishProductVideoToFacebook(input: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  mediaUrl: string;
}): Promise<{ postId: string; endpoint: string }> {
  const pageAccessToken = cleanText(input.pageAccessToken);
  if (!pageAccessToken) {
    throw Object.assign(new Error('selected_facebook_page_access_token_missing'), {
      code: 'selected_facebook_page_access_token_missing',
      status: 503,
    });
  }

  const apiVersion = cleanText(process.env.PRODUCT_VIDEO_FACEBOOK_GRAPH_API_VERSION) || 'v20.0';
  const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(input.pageId)}/videos`;
  const body = new URLSearchParams({
    access_token: pageAccessToken,
    description: input.caption,
    file_url: input.mediaUrl,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    body,
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!response.ok || !id) {
    throw Object.assign(new Error('facebook_graph_publish_failed'), {
      code: 'facebook_graph_publish_failed',
      status: response.status >= 400 ? response.status : 502,
    });
  }

  return { postId: id, endpoint: `/${apiVersion}/${input.pageId}/videos` };
}

async function validatePublicMediaUrlBeforeFacebookGraph(input: {
  mediaUrl: string | null;
  mediaType: 'video' | 'image' | null;
}): Promise<void> {
  if (!input.mediaUrl) {
    throw Object.assign(new Error('media_url_required'), { code: 'media_url_required', status: 409 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.mediaUrl);
  } catch {
    throw Object.assign(new Error('media_url_invalid'), { code: 'media_url_invalid', status: 409 });
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw Object.assign(new Error('media_url_http_required'), { code: 'media_url_http_required', status: 409 });
  }

  const response = await fetch(parsedUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
    redirect: 'follow',
  });
  const contentType = cleanText(response.headers.get('content-type')).toLowerCase();
  const safeMediaDebug = {
    actual_status: response.status,
    actual_content_type: contentType || null,
  };
  if (response.status !== 200 && response.status !== 206) {
    throw Object.assign(new Error('media_url_not_http_200_or_206'), {
      code: 'media_url_not_http_200_or_206',
      status: 409,
      ...safeMediaDebug,
    });
  }

  const contentTypeAllowed = contentType.startsWith('video/') || contentType.startsWith('image/');
  if (!contentTypeAllowed) {
    throw Object.assign(new Error('media_url_content_type_invalid'), {
      code: 'media_url_content_type_invalid',
      status: 409,
      ...safeMediaDebug,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseExecutionDryRunAuditLine(line: string): ProductVideoPublishExecutionDryRunAudit | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) return null;
    if (parsed.status !== 'publish_execution_blocked' && parsed.status !== 'publish_execution_ready_dry_run') return null;
    if (parsed.status === 'publish_execution_blocked' && parsed.block_reason !== 'media_not_rendered') return null;
    if (parsed.status === 'publish_execution_ready_dry_run' && parsed.block_reason !== null) return null;
    if (typeof parsed.preview_id !== 'string') return null;
    if (typeof parsed.idempotency_key !== 'string') return null;
    if (parsed.safe_to_audit !== true) return null;
    if (parsed.real_posting_enabled !== false) return null;
    if (parsed.publish_allowed !== false) return null;
    if (parsed.facebook_post_performed !== false) return null;
    if (parsed.line_broadcast_performed !== false) return null;
    if (parsed.renderer_called !== false) return null;
    if (parsed.s3_upload_performed !== false) return null;
    return parsed as unknown as ProductVideoPublishExecutionDryRunAudit;
  } catch {
    return null;
  }
}

export function getProductVideoPublishExecutionDryRunAuditPathForDiagnostics(): string {
  return getPublishExecutionDryRunAuditPath();
}

export function getProductVideoManualPublishExecutionAuditPathForDiagnostics(): string {
  return getManualPublishExecutionAuditPath();
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

function parseManualPublishExecutionAuditLine(line: string): ProductVideoManualPublishExecutionAudit | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) return null;
    if (parsed.status !== 'blocked' && parsed.status !== 'published') return null;
    if (parsed.status === 'blocked' && (
      parsed.block_reason !== 'real_posting_flag_off'
      && parsed.block_reason !== 'manual_execute_required'
      && parsed.block_reason !== 'request_real_publish_approval_required'
      && parsed.block_reason !== 'preview_already_published'
    )) return null;
    if (parsed.status === 'published' && parsed.block_reason !== null) return null;
    if (typeof parsed.preview_id !== 'string') return null;
    if (typeof parsed.idempotency_key !== 'string') return null;
    if (parsed.safe_to_audit !== true) return null;
    if (parsed.status === 'blocked') {
      if (parsed.publish_allowed !== false) return null;
      if (parsed.facebook_post_performed !== false) return null;
      if (parsed.mark_posted_performed !== false) return null;
    } else {
      if (parsed.publish_allowed !== true) return null;
      if (parsed.facebook_post_performed !== true) return null;
      if (parsed.mark_posted_performed !== true) return null;
    }
    if (parsed.line_broadcast_performed !== false) return null;
    if (parsed.renderer_called !== false) return null;
    if (parsed.s3_upload_performed !== false) return null;
    return parsed as unknown as ProductVideoManualPublishExecutionAudit;
  } catch {
    return null;
  }
}

export async function listProductVideoManualPublishExecutions(): Promise<ProductVideoManualPublishExecutionAudit[]> {
  const auditPath = getManualPublishExecutionAuditPath();
  try {
    const content = await readFile(auditPath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map(parseManualPublishExecutionAuditLine)
      .filter((item): item is ProductVideoManualPublishExecutionAudit => Boolean(item));
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
  const mediaGatePassed = publishPlan.media.media_status === 'ready';
  return {
    preview_id: item.preview_id,
    execution_mode: 'dry_run',
    local_only: true,
    dry_run: true,
    would_publish_to: {
      platform: publishPlan.target_page.platform,
      target_page_key: publishPlan.target_page.page_key,
      selected_channel_id: item.selected_channel_id || item.selected_page_id,
      external_id: item.external_id || publishPlan.target_page.page_id,
      facebook_page_id: item.facebook_page_id || publishPlan.target_page.page_id,
      target_page_id: publishPlan.target_page.page_id,
      target_page_name: publishPlan.target_page.page_name,
    },
    content: {
      caption: publishPlan.content.caption,
      brand_context: publishPlan.content.brand_context,
    },
    media: {
      ...publishPlan.media,
      block_real_publish_until_rendered: !mediaGatePassed,
    },
    verified_gates: {
      preview_id_valid: true,
      preview_status_approved: true,
      publish_plan_ready: true,
      publish_authorized_for_manual_execution: true,
      target_page_key_verified: true,
      publish_plan_checksum_verified: true,
      idempotency_key_verified: true,
      media_gate_passed: mediaGatePassed,
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

  const publishPlan = await buildProductVideoPublishPlanPreview(input.item);
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
  const status: ProductVideoPublishExecutionDryRunStatus = publishPlan.media.media_status === 'ready'
    ? 'publish_execution_ready_dry_run'
    : 'publish_execution_blocked';
  const blockReason: ProductVideoPublishExecutionBlockReason = publishPlan.media.media_status === 'ready'
    ? null
    : 'media_not_rendered';

  const existing = (await listProductVideoPublishExecutionDryRunAudits()).find((record) => (
    record.preview_id === input.item.preview_id
    && record.target_page_key === targetPageKey
    && record.publish_plan_checksum === publishPlanChecksum
    && record.idempotency_key === idempotencyKey
    && record.authorization_id === authorization.authorization_id
    && record.status === status
    && record.media_status === publishPlan.media.media_status
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
    status,
    block_reason: blockReason,
    local_only: true,
    dry_run: true,
    audit_only: true,
    safe_to_audit: true,
    real_posting_enabled: false,
    idempotency_key: idempotencyKey,
    target_page_key: targetPageKey,
    selected_channel_id: input.item.selected_channel_id || input.item.selected_page_id,
    selected_page_id: input.item.selected_page_id,
    selected_page_name: input.item.selected_page_name,
    external_id: input.item.external_id || publishPlan.target_page.page_id,
    facebook_page_id: input.item.facebook_page_id || publishPlan.target_page.page_id,
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

export async function executeProductVideoManualPublish(input: {
  item: ProductVideoPreviewLogRecord;
  targetPageKey: string;
  publishPlanChecksum: string;
  idempotencyKey: string;
  manualExecute?: unknown;
  requestScopedRealPublishApproval?: unknown;
  selectedPageIdOrChannelId?: string;
}): Promise<{
  execution: ProductVideoManualPublishExecutionAudit;
  execution_plan: ProductVideoPublishExecutionPlan;
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
  if (publishPlan.publish_plan_status !== 'publish_plan_ready') {
    throw Object.assign(new Error('publish_plan_not_ready'), { code: 'publish_plan_not_ready', status: 409 });
  }
  if (targetPageKey !== publishPlan.target_page.page_key) {
    throw Object.assign(new Error('target_page_key_mismatch'), { code: 'target_page_key_mismatch', status: 409 });
  }
  if (publishPlanChecksum !== publishPlan.publish_plan_checksum) {
    throw Object.assign(new Error('publish_plan_checksum_mismatch'), { code: 'publish_plan_checksum_mismatch', status: 409 });
  }
  if (publishPlan.media.media_status !== 'ready') {
    throw Object.assign(new Error('media_not_ready'), { code: 'media_not_ready', status: 409 });
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

  const selectedPageSelector = cleanText(input.selectedPageIdOrChannelId)
    || input.item.selected_channel_id
    || input.item.selected_page_id
    || input.item.facebook_page_id
    || input.item.external_id
    || publishPlan.target_page.page_id;
  const selectedPage = await resolveProductVideoSelectedFacebookPage(selectedPageSelector);
  const expectedFacebookPageId = cleanText(input.item.facebook_page_id || input.item.external_id);
  if (expectedFacebookPageId && selectedPage.facebook_page_id !== expectedFacebookPageId) {
    throw Object.assign(new Error('selected_facebook_page_mismatch'), {
      code: 'selected_facebook_page_mismatch',
      status: 409,
    });
  }

  const executions = await listProductVideoManualPublishExecutions();
  const alreadyPublished = executions.find((record) => (
    record.preview_id === input.item.preview_id
    && record.status === 'published'
    && (record.facebook_page_id || record.execution_plan?.would_publish_to?.facebook_page_id || record.execution_plan?.would_publish_to?.target_page_id) === selectedPage.facebook_page_id
  ));

  const executionPlan = buildExecutionPlan(input.item, publishPlan);
  executionPlan.execution_mode = 'manual_publish';
  executionPlan.would_publish_to.selected_channel_id = selectedPage.selected_channel_id;
  executionPlan.would_publish_to.external_id = selectedPage.external_id;
  executionPlan.would_publish_to.facebook_page_id = selectedPage.facebook_page_id;
  executionPlan.would_publish_to.target_page_id = selectedPage.facebook_page_id;
  executionPlan.would_publish_to.target_page_name = selectedPage.selected_page_name;

  const manualExecute = isTruthy(input.manualExecute);
  const requestScopedRealPublishApproval = isTruthy(input.requestScopedRealPublishApproval);
  const envRealPublishEnabled = isRealFacebookPublishEnabled();
  const realPostingEnabled = envRealPublishEnabled;

  const existing = executions.find((record) => (
    record.preview_id === input.item.preview_id
    && record.target_page_key === targetPageKey
    && record.publish_plan_checksum === publishPlanChecksum
    && record.idempotency_key === idempotencyKey
    && record.authorization_id === authorization.authorization_id
    && (record.status === 'published' || !envRealPublishEnabled)
    && (record.facebook_page_id || record.execution_plan?.would_publish_to?.facebook_page_id || record.execution_plan?.would_publish_to?.target_page_id) === selectedPage.facebook_page_id
  ));

  if (alreadyPublished) {
    const execution = buildBlockedManualExecution({
      item: input.item,
      authorization,
      targetPageKey,
      publishPlanChecksum,
      idempotencyKey,
      executionPlan,
      blockReason: 'preview_already_published',
      realPostingEnabled,
      requestScopedRealPublishApproval,
      selectedPage,
    });
    return { execution, execution_plan: executionPlan, idempotent_replay: true };
  }

  if (existing) {
    return {
      execution: existing,
      execution_plan: existing.execution_plan,
      idempotent_replay: true,
    };
  }

  let blockReason: Exclude<ProductVideoManualPublishExecutionBlockReason, null> | null = null;
  if (!manualExecute) {
    blockReason = 'manual_execute_required';
  } else if (!requestScopedRealPublishApproval) {
    blockReason = 'request_real_publish_approval_required';
  } else if (!realPostingEnabled) {
    blockReason = 'real_posting_flag_off';
  }

  if (blockReason) {
    const execution = buildBlockedManualExecution({
      item: input.item,
      authorization,
      targetPageKey,
      publishPlanChecksum,
      idempotencyKey,
      executionPlan,
      blockReason,
      realPostingEnabled,
      requestScopedRealPublishApproval,
      selectedPage,
    });

    const auditPath = getManualPublishExecutionAuditPath();
    await mkdir(path.dirname(auditPath), { recursive: true });
    await writeFile(auditPath, `${JSON.stringify(execution)}\n`, { flag: 'a' });

    return {
      execution,
      execution_plan: executionPlan,
      idempotent_replay: false,
    };
  }

  await validatePublicMediaUrlBeforeFacebookGraph({
    mediaUrl: publishPlan.media.public_media_url,
    mediaType: publishPlan.media.media_type,
  });

  const facebookResult = await publishProductVideoToFacebook({
    pageId: selectedPage.facebook_page_id,
    pageAccessToken: selectedPage.page_access_token,
    caption: publishPlan.content.caption,
    mediaUrl: publishPlan.media.public_media_url,
  });

  const execution: ProductVideoManualPublishExecutionAudit = {
    execution_id: randomUUID(),
    preview_id: input.item.preview_id,
    authorization_id: authorization.authorization_id,
    status: 'published',
    block_reason: null,
    local_only: true,
    manual_execution: true,
    safe_to_audit: true,
    publish_allowed: true,
    real_posting_enabled: true,
    facebook_real_publish_flag_enabled: true,
    request_scoped_real_publish_approval: true,
    idempotency_key: idempotencyKey,
    target_page_key: targetPageKey,
    selected_channel_id: selectedPage.selected_channel_id,
    selected_page_id: selectedPage.selected_page_id,
    selected_page_name: selectedPage.selected_page_name,
    external_id: selectedPage.external_id,
    facebook_page_id: selectedPage.facebook_page_id,
    publish_plan_checksum: publishPlanChecksum,
    publish_plan_status: publishPlan.publish_plan_status,
    authorization_status: authorization.status,
    media_status: publishPlan.media.media_status,
    execution_plan: executionPlan,
    facebook_post_performed: true,
    facebook_post_id: facebookResult.postId,
    facebook_graph_endpoint: facebookResult.endpoint,
    line_broadcast_performed: false,
    schedule_enabled: false,
    renderer_called: false,
    phaya_called: false,
    s3_upload_performed: false,
    mark_posted_performed: true,
    executed_at: new Date().toISOString(),
  };

  const auditPath = getManualPublishExecutionAuditPath();
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(execution)}\n`, { flag: 'a' });

  return {
    execution,
    execution_plan: executionPlan,
    idempotent_replay: false,
  };
}
