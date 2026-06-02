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
  selected_channel_id: string;
  selected_page_id: string;
  selected_page_name: string;
  external_id: string;
  facebook_page_id: string;
  platform: ProductVideoPlatform;
  caption: string;
  marketing_caption?: string;
  preview_note?: string;
  n8n_forwarded: boolean;
  n8n_status: number | null;
  response_body_exposed: false;
  campaign_id?: string;
  selected_pages?: string;
  asset_id?: string;
  uploaded_asset_id?: string;
  public_image_url?: string;
  image_urls?: string[];
  brief?: string;
  publish_caption?: string;
  video_title?: string;
  hook?: string;
  scene_script?: string;
  overlay_texts?: string;
  hashtags?: string;
  render_job_id?: string;
  render_status?: string;
  public_media_url?: string;
  media_type?: string;
  media_checksum?: string;
  media_status?: string;
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
    selected_channel_id: input.selected_channel_id,
    selected_page_id: input.selected_page_id,
    selected_page_name: input.selected_page_name,
    external_id: input.external_id,
    facebook_page_id: input.facebook_page_id,
    platform: input.platform,
    caption: input.caption,
    marketing_caption: input.marketing_caption || '',
    preview_note: input.preview_note || '',
    preview_only: true,
    real_posting_enabled: false,
    line_broadcast_enabled: false,
    n8n_forwarded: input.n8n_forwarded,
    n8n_status: input.n8n_status,
    response_body_exposed: false,
    status: 'pending_owner_review',
    campaign_id: input.campaign_id,
    selected_pages: input.selected_pages,
    asset_id: input.asset_id,
    uploaded_asset_id: input.uploaded_asset_id,
    public_image_url: input.public_image_url,
    image_urls: input.image_urls,
    brief: input.brief,
    publish_caption: input.publish_caption,
    video_title: input.video_title,
    hook: input.hook,
    scene_script: input.scene_script,
    overlay_texts: input.overlay_texts,
    hashtags: input.hashtags,
    render_job_id: input.render_job_id,
    render_status: input.render_status,
    public_media_url: input.public_media_url,
    media_type: input.media_type,
    media_checksum: input.media_checksum,
    media_status: input.media_status,
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

export async function findProductVideoPreviewLogById(
  previewId: string,
): Promise<ProductVideoPreviewLogRecord | null> {
  const cleanPreviewId = cleanText(previewId);
  if (!cleanPreviewId) return null;

  const items = await listProductVideoPreviewLogs();
  return items.find((item) => item.preview_id === cleanPreviewId) || null;
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

export async function updateProductVideoPreviewLog(
  previewId: string,
  updates: Partial<ProductVideoPreviewLogRecord>,
): Promise<ProductVideoPreviewLogRecord> {
  const cleanPreviewId = cleanText(previewId);
  if (!cleanPreviewId) {
    throw Object.assign(new Error('preview_id_required'), { code: 'preview_id_required', status: 400 });
  }

  const logPath = getPreviewLogPath();
  let content = '';
  try {
    content = await readFile(logPath, 'utf8');
  } catch {
    throw Object.assign(new Error('preview_log_not_found'), { code: 'preview_log_not_found', status: 404 });
  }

  const lines = content.split('\n');
  const nextLines: string[] = [];
  let updatedItem: ProductVideoPreviewLogRecord | null = null;

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const raw = parseRawPreviewLogLine(line);
    const record = normalizePreviewLogRecord(raw);

    if (!raw || !record || record.preview_id !== cleanPreviewId) {
      nextLines.push(line);
      continue;
    }

    updatedItem = {
      ...record,
      ...updates,
      updated_at: new Date().toISOString(),
    } as ProductVideoPreviewLogRecord;

    nextLines.push(JSON.stringify({
      ...raw,
      ...updatedItem,
    }));
  }

  if (!updatedItem) {
    throw Object.assign(new Error('preview_log_not_found'), { code: 'preview_log_not_found', status: 404 });
  }

  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, `${nextLines.join('\n')}\n`);

  return updatedItem;
}
