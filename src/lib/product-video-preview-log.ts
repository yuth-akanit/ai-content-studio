import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ProductVideoPlatform = 'facebook_page' | 'facebook' | 'line' | string;

export type ProductVideoApprovalDecision = 'approve' | 'reject' | 'request_changes';

export type ProductVideoPreviewLogStatus =
  | 'pending_owner_review'
  | 'approved_for_future_publish'
  | 'rejected'
  | 'changes_requested';

export interface ProductVideoPreviewSafetyFlags {
  publish_allowed: false;
  facebook_post_performed: false;
  line_broadcast_performed: false;
  schedule_enabled: false;
  renderer_called: false;
  phaya_called: false;
  s3_upload_performed: false;
  mark_posted_performed: false;
}

export interface ProductVideoPreviewLogInput {
  brand_context: string;
  target_page_key: string;
  selected_page_id: string;
  selected_page_name: string;
  platform: ProductVideoPlatform;
  caption: string;
  n8n_forwarded: boolean;
  n8n_status: number | null;
  response_body_exposed: false;
}

export interface ProductVideoPreviewLogRecord extends ProductVideoPreviewLogInput, ProductVideoPreviewSafetyFlags {
  preview_id: string;
  created_at: string;
  updated_at?: string;
  preview_only: true;
  real_posting_enabled: false;
  line_broadcast_enabled: false;
  status: ProductVideoPreviewLogStatus;
}

export interface ProductVideoApprovalDecisionRecord extends ProductVideoPreviewSafetyFlags {
  decision_id: string;
  preview_id: string;
  decision: ProductVideoApprovalDecision;
  previous_status: ProductVideoPreviewLogStatus;
  status: ProductVideoPreviewLogStatus;
  reason: string | null;
  decided_at: string;
  local_only: true;
  preview_log_path: string;
}

const DEFAULT_PREVIEW_LOG_PATH = '/app/runtime/product-video-preview-logs.jsonl';
const DEFAULT_APPROVAL_DECISION_LOG_PATH = '/app/runtime/product-video-approval-decisions.jsonl';
const MAX_PREVIEW_LOG_ITEMS = 100;

export const PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS: ProductVideoPreviewSafetyFlags = {
  publish_allowed: false,
  facebook_post_performed: false,
  line_broadcast_performed: false,
  schedule_enabled: false,
  renderer_called: false,
  phaya_called: false,
  s3_upload_performed: false,
  mark_posted_performed: false,
};

const DECISION_TO_STATUS: Record<ProductVideoApprovalDecision, ProductVideoPreviewLogStatus> = {
  approve: 'approved_for_future_publish',
  reject: 'rejected',
  request_changes: 'changes_requested',
};

const VALID_STATUSES = new Set<ProductVideoPreviewLogStatus>([
  'pending_owner_review',
  'approved_for_future_publish',
  'rejected',
  'changes_requested',
]);

function getPreviewLogPath(): string {
  return process.env.PRODUCT_VIDEO_PREVIEW_LOG_PATH || DEFAULT_PREVIEW_LOG_PATH;
}

function getApprovalDecisionLogPath(): string {
  return process.env.PRODUCT_VIDEO_APPROVAL_DECISION_LOG_PATH || DEFAULT_APPROVAL_DECISION_LOG_PATH;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStatus(value: unknown): ProductVideoPreviewLogStatus | null {
  return typeof value === 'string' && VALID_STATUSES.has(value as ProductVideoPreviewLogStatus)
    ? value as ProductVideoPreviewLogStatus
    : null;
}

function normalizePreviewLogRecord(value: unknown): ProductVideoPreviewLogRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.preview_id !== 'string') return null;
  if (typeof value.created_at !== 'string') return null;
  if (value.preview_only !== true) return null;
  if (value.real_posting_enabled !== false) return null;
  if (value.line_broadcast_enabled !== false) return null;
  if (value.schedule_enabled !== false) return null;
  if (value.publish_allowed !== false) return null;
  if (value.facebook_post_performed !== false) return null;

  const status = normalizeStatus(value.status);
  if (!status) return null;

  return {
    ...(value as unknown as ProductVideoPreviewLogRecord),
    status,
    publish_allowed: false,
    facebook_post_performed: false,
    line_broadcast_performed: false,
    schedule_enabled: false,
    renderer_called: false,
    phaya_called: false,
    s3_upload_performed: false,
    mark_posted_performed: false,
  };
}

function parsePreviewLogLine(line: string): ProductVideoPreviewLogRecord | null {
  try {
    return normalizePreviewLogRecord(JSON.parse(line) as unknown);
  } catch {
    return null;
  }
}

function parseRawPreviewLogLine(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseProductVideoApprovalDecision(value: unknown): ProductVideoApprovalDecision | null {
  if (value === 'approve' || value === 'reject' || value === 'request_changes') return value;
  return null;
}

export function getProductVideoPreviewStatusForDecision(
  decision: ProductVideoApprovalDecision,
): ProductVideoPreviewLogStatus {
  return DECISION_TO_STATUS[decision];
}

export function getProductVideoPreviewLogPathForDiagnostics(): string {
  return getPreviewLogPath();
}

export function getProductVideoApprovalDecisionLogPathForDiagnostics(): string {
  return getApprovalDecisionLogPath();
}

export async function appendProductVideoPreviewLog(
  input: ProductVideoPreviewLogInput,
): Promise<ProductVideoPreviewLogRecord> {
  const logPath = getPreviewLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });

  const record: ProductVideoPreviewLogRecord = {
    preview_id: randomUUID(),
    created_at: new Date().toISOString(),
    brand_context: input.brand_context,
    target_page_key: input.target_page_key,
    selected_page_id: input.selected_page_id,
    selected_page_name: input.selected_page_name,
    platform: input.platform,
    caption: input.caption,
    preview_only: true,
    real_posting_enabled: false,
    line_broadcast_enabled: false,
    n8n_forwarded: input.n8n_forwarded,
    n8n_status: input.n8n_status,
    response_body_exposed: false,
    status: 'pending_owner_review',
    ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  };

  await writeFile(logPath, `${JSON.stringify(record)}\n`, { flag: 'a' });
  return record;
}

export async function listProductVideoPreviewLogs(): Promise<ProductVideoPreviewLogRecord[]> {
  const logPath = getPreviewLogPath();
  try {
    await stat(logPath);
  } catch {
    return [];
  }

  const content = await readFile(logPath, 'utf8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parsePreviewLogLine)
    .filter((record): record is ProductVideoPreviewLogRecord => Boolean(record))
    .slice(-MAX_PREVIEW_LOG_ITEMS)
    .reverse();
}

export async function applyProductVideoPreviewDecision(input: {
  previewId: string;
  decision: ProductVideoApprovalDecision;
  reason?: string;
}): Promise<{
  item: ProductVideoPreviewLogRecord;
  decision_record: ProductVideoApprovalDecisionRecord;
}> {
  const previewId = cleanText(input.previewId);
  if (!previewId) {
    throw Object.assign(new Error('preview_id_required'), { code: 'preview_id_required', status: 400 });
  }

  const logPath = getPreviewLogPath();
  const decisionLogPath = getApprovalDecisionLogPath();
  let content = '';

  try {
    content = await readFile(logPath, 'utf8');
  } catch {
    throw Object.assign(new Error('preview_log_not_found'), { code: 'preview_log_not_found', status: 404 });
  }

  const lines = content.split('\n');
  const nextLines: string[] = [];
  let updatedItem: ProductVideoPreviewLogRecord | null = null;
  let previousStatus: ProductVideoPreviewLogStatus | null = null;

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const raw = parseRawPreviewLogLine(line);
    const record = normalizePreviewLogRecord(raw);

    if (!raw || !record || record.preview_id !== previewId) {
      nextLines.push(line);
      continue;
    }

    previousStatus = record.status;
    const nextStatus = getProductVideoPreviewStatusForDecision(input.decision);
    updatedItem = {
      ...record,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    nextLines.push(JSON.stringify({
      ...raw,
      ...updatedItem,
    }));
  }

  if (!updatedItem || !previousStatus) {
    throw Object.assign(new Error('preview_log_not_found'), { code: 'preview_log_not_found', status: 404 });
  }

  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, `${nextLines.join('\n')}\n`);

  const decisionRecord: ProductVideoApprovalDecisionRecord = {
    decision_id: randomUUID(),
    preview_id: previewId,
    decision: input.decision,
    previous_status: previousStatus,
    status: updatedItem.status,
    reason: cleanText(input.reason) || null,
    decided_at: updatedItem.updated_at || new Date().toISOString(),
    local_only: true,
    preview_log_path: logPath,
    ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  };

  await mkdir(path.dirname(decisionLogPath), { recursive: true });
  await writeFile(decisionLogPath, `${JSON.stringify(decisionRecord)}\n`, { flag: 'a' });

  return {
    item: updatedItem,
    decision_record: decisionRecord,
  };
}
