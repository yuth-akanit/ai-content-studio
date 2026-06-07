import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ShortVideoPlatform } from '@/lib/short-video-distribution/planner';

export type ShortVideoOwnerDecision = 'approve' | 'reject' | 'request_changes';

export type ShortVideoOwnerReviewStatus =
  | 'pending_owner_review'
  | 'approved_for_manual_publish'
  | 'rejected'
  | 'changes_requested';

export type ShortVideoOwnerReviewSafetyFlags = {
  publish_allowed: false;
  facebook_post_performed: false;
  instagram_post_performed: false;
  tiktok_post_performed: false;
  youtube_post_performed: false;
  line_broadcast_performed: false;
  schedule_enabled: false;
  scheduler_enabled: false;
  renderer_called: false;
  tts_called: false;
  s3_upload_performed: false;
  mark_posted_performed: false;
  production_actions_performed: false;
};

export type ShortVideoOwnerReviewDecisionRecord = {
  record_type: 'short_video_preview_owner_decision';
  decided_at: string;
  variant_id: string;
  master_video_id: string;
  platform: ShortVideoPlatform;
  decision: ShortVideoOwnerDecision;
  status: ShortVideoOwnerReviewStatus;
  reason: string | null;
  local_only: true;
  preview_only: true;
  safety_flags: ShortVideoOwnerReviewSafetyFlags;
};

export type ShortVideoOwnerReviewDecisionState = {
  variant_id: string;
  decision: ShortVideoOwnerDecision;
  status: ShortVideoOwnerReviewStatus;
  decided_at: string;
  reason: string | null;
  local_only: true;
  preview_only: true;
  safety_flags: ShortVideoOwnerReviewSafetyFlags;
};

export const SHORT_VIDEO_OWNER_REVIEW_SAFETY_FLAGS: ShortVideoOwnerReviewSafetyFlags = Object.freeze({
  publish_allowed: false,
  facebook_post_performed: false,
  instagram_post_performed: false,
  tiktok_post_performed: false,
  youtube_post_performed: false,
  line_broadcast_performed: false,
  schedule_enabled: false,
  scheduler_enabled: false,
  renderer_called: false,
  tts_called: false,
  s3_upload_performed: false,
  mark_posted_performed: false,
  production_actions_performed: false,
});

export const SHORT_VIDEO_OWNER_DECISIONS: ShortVideoOwnerDecision[] = ['approve', 'reject', 'request_changes'];

const STATUS_BY_DECISION: Record<ShortVideoOwnerDecision, ShortVideoOwnerReviewStatus> = {
  approve: 'approved_for_manual_publish',
  reject: 'rejected',
  request_changes: 'changes_requested',
};

function runtimeDecisionLogPath(): string {
  return path.join(process.cwd(), 'runtime', 'short-video-preview-owner-decisions.jsonl');
}

export function isShortVideoOwnerDecision(value: unknown): value is ShortVideoOwnerDecision {
  return typeof value === 'string' && SHORT_VIDEO_OWNER_DECISIONS.includes(value as ShortVideoOwnerDecision);
}

export function statusForShortVideoDecision(decision: ShortVideoOwnerDecision): ShortVideoOwnerReviewStatus {
  return STATUS_BY_DECISION[decision];
}

export function normalizeShortVideoDecisionReason(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 500) : null;
}

export function allShortVideoOwnerReviewSafetyFlagsFalse(flags: ShortVideoOwnerReviewSafetyFlags): boolean {
  return Object.values(flags).every((value) => value === false);
}

async function readDecisionRecords(): Promise<ShortVideoOwnerReviewDecisionRecord[]> {
  try {
    const content = await fs.readFile(runtimeDecisionLogPath(), 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ShortVideoOwnerReviewDecisionRecord)
      .filter((record) => record.record_type === 'short_video_preview_owner_decision');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function loadShortVideoOwnerDecisionState(): Promise<Record<string, ShortVideoOwnerReviewDecisionState>> {
  const records = await readDecisionRecords();
  return records.reduce<Record<string, ShortVideoOwnerReviewDecisionState>>((acc, record) => {
    acc[record.variant_id] = {
      variant_id: record.variant_id,
      decision: record.decision,
      status: record.status,
      decided_at: record.decided_at,
      reason: record.reason,
      local_only: true,
      preview_only: true,
      safety_flags: { ...SHORT_VIDEO_OWNER_REVIEW_SAFETY_FLAGS },
    };
    return acc;
  }, {});
}

export async function appendShortVideoOwnerDecision(input: {
  variant_id: string;
  master_video_id: string;
  platform: ShortVideoPlatform;
  decision: ShortVideoOwnerDecision;
  reason?: string | null;
}): Promise<ShortVideoOwnerReviewDecisionRecord> {
  const record: ShortVideoOwnerReviewDecisionRecord = {
    record_type: 'short_video_preview_owner_decision',
    decided_at: new Date().toISOString(),
    variant_id: input.variant_id,
    master_video_id: input.master_video_id,
    platform: input.platform,
    decision: input.decision,
    status: statusForShortVideoDecision(input.decision),
    reason: normalizeShortVideoDecisionReason(input.reason),
    local_only: true,
    preview_only: true,
    safety_flags: { ...SHORT_VIDEO_OWNER_REVIEW_SAFETY_FLAGS },
  };

  await fs.mkdir(path.dirname(runtimeDecisionLogPath()), { recursive: true });
  await fs.appendFile(runtimeDecisionLogPath(), `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}
