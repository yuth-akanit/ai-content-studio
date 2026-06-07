'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ShortVideoPlatform } from '@/lib/short-video-distribution/planner';
import type {
  ShortVideoOwnerDecision,
  ShortVideoOwnerReviewDecisionState,
} from '@/lib/short-video-distribution/owner-review-decisions';

type DecisionResponse = {
  ok?: boolean;
  error?: string;
  status?: string;
  decision_record?: ShortVideoOwnerReviewDecisionState;
  all_safety_flags_false?: boolean;
  publish_allowed?: boolean;
  facebook_post_performed?: boolean;
  instagram_post_performed?: boolean;
  tiktok_post_performed?: boolean;
  youtube_post_performed?: boolean;
  line_broadcast_performed?: boolean;
  schedule_enabled?: boolean;
  renderer_called?: boolean;
  tts_called?: boolean;
  s3_upload_performed?: boolean;
  mark_posted_performed?: boolean;
  production_actions_performed?: boolean;
};

type Props = {
  variantId: string;
  masterVideoId: string;
  platform: ShortVideoPlatform;
  platformLabel: string;
  initialState?: ShortVideoOwnerReviewDecisionState | null;
};

const decisionLabels: Record<ShortVideoOwnerDecision, string> = {
  approve: 'Approve for manual publish',
  reject: 'Reject',
  request_changes: 'Request changes',
};

const statusLabels: Record<string, string> = {
  pending_owner_review: 'รอ Owner ตัดสินใจ',
  approved_for_manual_publish: 'อนุมัติแบบ local-only สำหรับโพสต์เองภายหลัง',
  rejected: 'ปฏิเสธแล้ว',
  changes_requested: 'ขอแก้ไขก่อน',
};

const statusTone: Record<string, string> = {
  pending_owner_review: 'border-slate-200 bg-slate-50 text-slate-700',
  approved_for_manual_publish: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-red-200 bg-red-50 text-red-800',
  changes_requested: 'border-amber-200 bg-amber-50 text-amber-800',
};

const decisionIcon = {
  approve: CheckCircle2,
  reject: XCircle,
  request_changes: RotateCcw,
};

function assertSafeResponse(data: DecisionResponse): boolean {
  return data.all_safety_flags_false === true
    && data.publish_allowed === false
    && data.facebook_post_performed === false
    && data.instagram_post_performed === false
    && data.tiktok_post_performed === false
    && data.youtube_post_performed === false
    && data.line_broadcast_performed === false
    && data.schedule_enabled === false
    && data.renderer_called === false
    && data.tts_called === false
    && data.s3_upload_performed === false
    && data.mark_posted_performed === false
    && data.production_actions_performed === false;
}

export function OwnerReviewDecisionPanel({ variantId, masterVideoId, platform, platformLabel, initialState }: Props) {
  const [state, setState] = useState<ShortVideoOwnerReviewDecisionState | null>(initialState || null);
  const [pendingDecision, setPendingDecision] = useState<ShortVideoOwnerDecision | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const status = state?.status || 'pending_owner_review';
  const statusClass = statusTone[status] || statusTone.pending_owner_review;

  const lastDecisionText = useMemo(() => {
    if (!state) return 'ยังไม่มี decision audit สำหรับ preview นี้';
    return `${statusLabels[state.status] || state.status} • ${new Date(state.decided_at).toLocaleString('th-TH')}`;
  }, [state]);

  async function submitDecision(decision: ShortVideoOwnerDecision) {
    setPendingDecision(decision);
    setMessage(null);
    try {
      const response = await fetch(`/api/short-video-distribution/preview-decisions/${encodeURIComponent(variantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: variantId,
          master_video_id: masterVideoId,
          platform,
          decision,
          reason: `owner_review_panel:${platform}`,
        }),
      });
      const data = (await response.json()) as DecisionResponse;
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || 'short_video_decision_failed');
      }
      if (!assertSafeResponse(data)) {
        throw new Error('safety_flags_not_false');
      }
      const record = data.decision_record;
      if (!record) throw new Error('decision_record_missing');
      setState({
        variant_id: variantId,
        decision,
        status: record.status,
        decided_at: record.decided_at,
        reason: record.reason,
        local_only: true,
        preview_only: true,
        safety_flags: record.safety_flags,
      });
      setMessage('บันทึก decision แบบ local-only แล้ว — ไม่มีการโพสต์/เรียก provider');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึก decision ไม่สำเร็จ');
    } finally {
      setPendingDecision(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Owner Review Decision Layer v1
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            ตัดสินใจเฉพาะ preview ของ {platformLabel} แบบ local-only ยังไม่โพสต์จริงและไม่เรียก provider
          </p>
        </div>
        <Badge variant="outline" className={statusClass}>{statusLabels[status] || status}</Badge>
      </div>

      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{lastDecisionText}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(['approve', 'reject', 'request_changes'] as ShortVideoOwnerDecision[]).map((decision) => {
          const Icon = decisionIcon[decision];
          return (
            <button
              key={decision}
              type="button"
              onClick={() => submitDecision(decision)}
              disabled={pendingDecision !== null}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="h-4 w-4" />
              {pendingDecision === decision ? 'Saving...' : decisionLabels[decision]}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <div className="rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">publish_allowed=false</div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">provider/scheduler/LINE=false</div>
      </div>

      {message ? <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800">{message}</p> : null}
    </div>
  );
}
