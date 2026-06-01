import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ProductVideoPlatform = 'facebook_page' | 'facebook' | 'line' | string;

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

export interface ProductVideoPreviewLogRecord extends ProductVideoPreviewLogInput {
  preview_id: string;
  created_at: string;
  preview_only: true;
  real_posting_enabled: false;
  line_broadcast_enabled: false;
  schedule_enabled: false;
  status: 'pending_owner_review';
  publish_allowed: false;
  facebook_post_performed: false;
}

const DEFAULT_PREVIEW_LOG_PATH = '/app/runtime/product-video-preview-logs.jsonl';
const MAX_PREVIEW_LOG_ITEMS = 100;

function getPreviewLogPath(): string {
  return process.env.PRODUCT_VIDEO_PREVIEW_LOG_PATH || DEFAULT_PREVIEW_LOG_PATH;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parsePreviewLogLine(line: string): ProductVideoPreviewLogRecord | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed.preview_id !== 'string') return null;
    if (typeof parsed.created_at !== 'string') return null;
    if (parsed.preview_only !== true) return null;
    if (parsed.real_posting_enabled !== false) return null;
    if (parsed.line_broadcast_enabled !== false) return null;
    if (parsed.schedule_enabled !== false) return null;
    if (parsed.status !== 'pending_owner_review') return null;
    if (parsed.publish_allowed !== false) return null;
    if (parsed.facebook_post_performed !== false) return null;
    return parsed as unknown as ProductVideoPreviewLogRecord;
  } catch {
    return null;
  }
}

export function getProductVideoPreviewLogPathForDiagnostics(): string {
  return getPreviewLogPath();
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
    schedule_enabled: false,
    n8n_forwarded: input.n8n_forwarded,
    n8n_status: input.n8n_status,
    response_body_exposed: false,
    status: 'pending_owner_review',
    publish_allowed: false,
    facebook_post_performed: false,
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
