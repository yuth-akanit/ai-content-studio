import { AlertTriangle, Award, CheckCircle2, Copy, Eye, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import Link from 'next/link';
import { buildShortVideoPreviewQueue, type PlatformMetadata, type ShortVideoPlatformVariant } from '@/lib/short-video-distribution/planner';
import { sampleApprovedMasterVerticalVideo } from '@/lib/short-video-distribution/sample-fixture';
import { sampleMediaComposerMasterVideoRecord } from '@/lib/media-composer';
import { loadShortVideoOwnerDecisionState, type ShortVideoOwnerReviewDecisionState } from '@/lib/short-video-distribution/owner-review-decisions';
import { OwnerReviewDecisionPanel } from '@/components/short-video-distribution/owner-review-decision-panel';
import { ManualPublishPackagePanel } from '@/components/short-video-distribution/manual-publish-package-panel';
import {
  buildManualPublishPackages,
  buildShortVideoPreviewSourceMetadata,
} from '@/lib/short-video-distribution/manual-publish-package';
import { buildRealVideoQualityGateV2, type RealVideoQualityGateV2 } from '@/lib/short-video-distribution/real-video-quality-gate';
import { buildShortVideoPublishReadiness, type ShortVideoPublishReadiness } from '@/lib/short-video-distribution/publish-readiness';

type ShortVideoDistributionSearchParams = Promise<Record<string, string | string[] | undefined>>;

const metadataLabelMap: Record<string, string> = {
  title: 'หัวข้อ',
  description: 'คำอธิบาย',
  tags: 'แท็ก',
  privacy_status: 'สถานะการมองเห็น',
  caption: 'แคปชัน',
  cta: 'ข้อความชวนให้ติดต่อ',
  page_id: 'เพจปลายทาง',
  hashtags: 'แฮชแท็ก',
  publish_mode: 'โหมดโพสต์',
};

const decisionLabelMap: Record<string, string> = {
  ready_for_owner_review: 'พร้อมให้เจ้าของรีวิว',
  needs_improvement: 'ควรปรับก่อนโพสต์',
  blocked_from_publish: 'ยังไม่ควรโพสต์',
};

const decisionStyleMap: Record<string, string> = {
  ready_for_owner_review: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  needs_improvement: 'border-amber-200 bg-amber-50 text-amber-800',
  blocked_from_publish: 'border-red-200 bg-red-50 text-red-800',
};

const systemValueLabelMap: Record<string, string> = {
  preview_only: 'ดูตัวอย่างเท่านั้น',
  manual_review: 'ให้แอดมินตรวจเองก่อนโพสต์',
  private: 'ส่วนตัว',
  unlisted: 'ไม่แสดงสาธารณะ',
  public: 'สาธารณะ',
};

const platformAccentMap: Record<string, string> = {
  youtube_shorts: 'from-red-50 to-white border-red-100',
  facebook_reels: 'from-blue-50 to-white border-blue-100',
  instagram_reels: 'from-fuchsia-50 to-white border-fuchsia-100',
  tiktok: 'from-slate-50 to-white border-slate-200',
};

function thaiBoolean(value: boolean): string {
  return value ? 'เปิด' : 'ปิด';
}

function friendlyValue(value: unknown): string {
  if (typeof value === 'boolean') return thaiBoolean(value);
  if (Array.isArray(value)) return value.join(', ');
  const text = String(value);
  return systemValueLabelMap[text] || text;
}

function metadataEntries(metadata: PlatformMetadata): Array<{ label: string; value: string; key: string }> {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    label: metadataLabelMap[key] || key,
    value: friendlyValue(value),
  }));
}

function mainPostText(metadata: PlatformMetadata): { label: string; value: string } {
  const record = metadata as Record<string, unknown>;
  if (typeof record.title === 'string') return { label: 'หัวข้อหลัก', value: record.title };
  if (typeof record.caption === 'string') return { label: 'แคปชันหลัก', value: record.caption };
  if (typeof record.description === 'string') return { label: 'ข้อความหลัก', value: record.description };
  return { label: 'ข้อความหลัก', value: friendlyValue(metadata) };
}

function thaiDecision(decision: string): string {
  return decisionLabelMap[decision] || decision;
}

function thaiRecommendation(text: string): string {
  return text
    .replace('Hook is clear and thumb-stopping.', 'ฮุกเปิดคลิปชัด ดึงความสนใจได้ดี')
    .replace('Visual note is clear for reviewer.', 'รายละเอียดภาพชัดพอให้แอดมินรีวิวต่อได้')
    .replace('CTA is actionable and low-pressure.', 'มีคำชวนติดต่อที่ทำตามได้ง่ายและไม่กดดัน')
    .replace('เพิ่ม hook ให้ชัดใน 1-2 วินาทีแรก เพื่อหยุดนิ้วคนดู', 'เพิ่มฮุกใน 1–2 วินาทีแรกให้ชัดขึ้น เพื่อหยุดนิ้วคนดู')
    .replace('เพิ่ม visual_notes ให้ทีมตัดต่อเห็นภาพเปิดคลิปและ proof shot ชัดขึ้น', 'เพิ่มรายละเอียดภาพให้ทีมตัดต่อเห็นช็อตเปิดคลิปและหลักฐานหน้างานชัดขึ้น')
    .replace('ปรับ metadata ให้ตรงธรรมชาติของแพลตฟอร์ม เช่น Shorts tag, hashtags, หรือ manual review marker', 'ปรับข้อความให้เหมาะกับแพลตฟอร์ม เช่น #Shorts แฮชแท็ก หรือสถานะตรวจเองก่อนโพสต์')
    .replace('เพิ่ม CTA ที่ชวนให้ทักแชต จองคิว หรือขอคำปรึกษาแบบไม่ hard sell', 'เพิ่มคำชวนให้ทักแชต จองคิว หรือขอคำปรึกษาแบบไม่ขายแรง');
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-700';
  if (score >= 60) return 'text-amber-700';
  return 'text-red-700';
}

function SafetyFlagDetails({ variant }: { variant: ShortVideoPlatformVariant }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <summary className="cursor-pointer font-bold text-slate-800">รายละเอียดระบบ</summary>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Object.entries(variant.publish_flags).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-slate-100">
            <span className="font-medium text-slate-600">{key}</span>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              {thaiBoolean(value)}
            </Badge>
          </div>
        ))}
      </div>
    </details>
  );
}

function PlatformCard({
  variant,
  ownerDecisionState,
  realVideoQualityGate,
  publishReadiness,
}: {
  variant: ShortVideoPlatformVariant;
  ownerDecisionState?: ShortVideoOwnerReviewDecisionState | null;
  realVideoQualityGate: RealVideoQualityGateV2;
  publishReadiness: ShortVideoPublishReadiness;
}) {
  const postText = mainPostText(variant.metadata);
  const metadataList = metadataEntries(variant.metadata);
  const displayedScore = realVideoQualityGate.real_video_quality_gate_v2 ? realVideoQualityGate.quality_score : variant.creative_quality_gate.creative_score;
  const displayedDecision = realVideoQualityGate.real_video_quality_gate_v2
    ? (realVideoQualityGate.decision === 'passed' ? 'ready_for_owner_review' : realVideoQualityGate.decision === 'needs_review' ? 'needs_improvement' : 'blocked_from_publish')
    : variant.creative_quality_gate.decision;
  const decisionClass = decisionStyleMap[displayedDecision] || 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <Card className={`overflow-hidden bg-gradient-to-br shadow-sm ${platformAccentMap[variant.platform] || 'border-slate-200 from-white to-slate-50'}`}>
      <CardHeader className="border-b border-white/80 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <VideoIcon />
              {variant.platform_label}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">ข้อความที่ระบบเตรียมไว้ให้แอดมินตรวจ ก่อนนำไปโพสต์เอง</p>
          </div>
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">ดูตัวอย่างเท่านั้น</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Copy className="h-4 w-4 text-indigo-600" />
            ข้อความสำหรับโพสต์
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-xs font-bold text-slate-500">{postText.label}</div>
            <p className="mt-2 whitespace-pre-wrap break-words text-base font-semibold leading-7 text-slate-950">{postText.value}</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {metadataList
              .filter((entry) => entry.value !== postText.value)
              .map((entry) => (
                <div key={entry.key} className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                  <dt className="text-xs font-bold text-slate-500">{entry.label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-900">{entry.value}</dd>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-950">
              <Award className="h-4 w-4" />
              {realVideoQualityGate.real_video_quality_gate_v2 ? 'Real Video Quality Gate v2' : 'Preview heuristic score'}
              {/* Creative Quality Gate v1 */}
            </div>
            <Badge variant="outline" className={decisionClass}>
              {thaiDecision(displayedDecision)}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr]">
            <div className="rounded-2xl bg-indigo-50 p-4 text-center ring-1 ring-indigo-100">
              <div className="text-xs font-bold text-indigo-500">คะแนนรวม</div>
              <div className={`mt-1 text-5xl font-black ${scoreTone(displayedScore)}`}>
                {displayedScore}
              </div>
              <div className="text-xs text-slate-500">{realVideoQualityGate.score_label}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ScorePill label="ฮุกเปิดคลิป" value={realVideoQualityGate.real_video_quality_gate_v2 ? realVideoQualityGate.hook_score : variant.creative_quality_gate.hook_score} />
              <ScorePill label="ภาพและความชัดเจน" value={realVideoQualityGate.real_video_quality_gate_v2 ? realVideoQualityGate.visual_clarity_score : variant.creative_quality_gate.visual_clarity_score} />
              <ScorePill label="เสียง" value={realVideoQualityGate.real_video_quality_gate_v2 ? realVideoQualityGate.audio_quality_score : variant.creative_quality_gate.caption_strength_score} />
              <ScorePill label="เหมาะกับแพลตฟอร์ม" value={realVideoQualityGate.real_video_quality_gate_v2 ? realVideoQualityGate.platform_fit_score : variant.creative_quality_gate.platform_fit_score} />
              <ScorePill label="คำชวนติดต่อ" value={variant.creative_quality_gate.cta_score} />
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {realVideoQualityGate.real_video_quality_gate_v2 ? (
              <>
                <p><span className="font-bold">resolver:</span> {realVideoQualityGate.asset_resolver_source} · <span className="font-bold">final_master_asset_id:</span> {realVideoQualityGate.final_master_video_asset_id ? `${realVideoQualityGate.final_master_video_asset_id.slice(0, 8)}…` : 'none'} · <span className="font-bold">analyzed_asset_id:</span> {realVideoQualityGate.analyzed_asset_id ? `${realVideoQualityGate.analyzed_asset_id.slice(0, 8)}…` : 'none'} · <span className="font-bold">sha:</span> {realVideoQualityGate.video_sha256_prefix || 'none'}</p>
                <p><span className="font-bold">ffprobe_performed:</span> {String(realVideoQualityGate.ffprobe_performed)} · <span className="font-bold">frames_extracted:</span> {String(realVideoQualityGate.frames_extracted)} · <span className="font-bold">audio_analyzed:</span> {String(realVideoQualityGate.audio_analyzed)}</p>
                <p><span className="font-bold">score_kind:</span> {realVideoQualityGate.score_kind} · <span className="font-bold">analysis_timestamp:</span> {realVideoQualityGate.analysis_timestamp}</p>
                <p><span className="font-bold">video:</span> {realVideoQualityGate.width}x{realVideoQualityGate.height}, {realVideoQualityGate.duration_seconds}s, aspect={realVideoQualityGate.aspect_ratio}, codec={realVideoQualityGate.video_codec || 'none'}</p>
                <p><span className="font-bold">audio:</span> has_audio={String(realVideoQualityGate.audio.has_audio)}, codec={realVideoQualityGate.audio_codec || 'none'}, sample_rate={realVideoQualityGate.audio_sample_rate || 'none'}, channels={realVideoQualityGate.audio_channels || 'none'}</p>
                <p><span className="font-bold">audio checks:</span> loudness_not_silent={String(realVideoQualityGate.audio.loudness_not_silent)}, opening_silence={String(realVideoQualityGate.audio.opening_silence)}, clipping_risk={String(realVideoQualityGate.audio.clipping_risk)}</p>
                <p><span className="font-bold">vision_model_called:</span> {String(realVideoQualityGate.vision_model_called)} · <span className="font-bold">video_frames_analyzed:</span> {realVideoQualityGate.video_frames_analyzed}</p>
                {realVideoQualityGate.score_label === 'technical_video_score' ? <p className="font-bold text-amber-800">Vision ปิดอยู่: คะแนนนี้คือ technical_video_score ไม่ใช่ vision score</p> : null}
              </>
            ) : (
              <p className="font-bold text-amber-800">คะแนนนี้ยังไม่ใช่การวิเคราะห์วิดีโอจริง</p>
            )}
          </div>
          <div className="mt-4 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-950">
              <Sparkles className="h-4 w-4" />
              คำแนะนำสำหรับแอดมิน
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-indigo-950">
              {variant.creative_quality_gate.recommendations.map((recommendation) => (
                <li key={recommendation}>{thaiRecommendation(recommendation)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${publishReadiness.publish_allowed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <CheckCircle2 className="h-4 w-4" />
              Publish Readiness Gate
            </div>
            <div className="mt-2 space-y-1 text-sm leading-6 text-slate-950">
              <p>owner_approved: {thaiBoolean(publishReadiness.owner_approved)}</p>
              <p>real_video_quality_gate_passed: {thaiBoolean(publishReadiness.real_video_quality_gate_passed)}</p>
              <p>provider_connected: {thaiBoolean(publishReadiness.provider_connected)}</p>
              <p>target_selected: {thaiBoolean(publishReadiness.target_selected)}</p>
              <p>video_url_200: {thaiBoolean(publishReadiness.video_url_200)}</p>
              <p>caption_present: {thaiBoolean(publishReadiness.caption_present)}</p>
              <p className="font-black">publish_allowed: {thaiBoolean(publishReadiness.publish_allowed)}</p>
            </div>
            {publishReadiness.blocked_reasons.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-semibold leading-6 text-red-900">
                {publishReadiness.blocked_reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : null}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Owner-click publish flow
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-950">
              ไม่มี scheduler / auto-post / background publish ปุ่มจะกดได้เฉพาะเมื่อ gate ผ่านและเจ้าของคลิกเอง
            </p>
            <button
              type="button"
              disabled={!publishReadiness.publish_allowed}
              className="mt-3 min-h-11 rounded-2xl bg-slate-300 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              Publish Now
            </button>
          </div>
        </div>

        <OwnerReviewDecisionPanel
          variantId={variant.variant_id}
          masterVideoId={variant.master_video_id}
          platform={variant.platform}
          platformLabel={variant.platform_label}
          initialState={ownerDecisionState || null}
        />

        <SafetyFlagDetails variant={variant} />
      </CardContent>
    </Card>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-100">
      <span className="font-medium text-slate-700">{label}</span>
      <span className={`text-lg font-black ${scoreTone(value)}`}>{value}</span>
    </div>
  );
}

function VideoIcon() {
  return <Eye className="h-5 w-5 text-indigo-600" />;
}

export default async function ShortVideoDistributionPage({ searchParams }: { searchParams: ShortVideoDistributionSearchParams }) {
  const sourceMetadata = buildShortVideoPreviewSourceMetadata(await searchParams);
  const masterVideoForPreview = {
    ...sampleApprovedMasterVerticalVideo,
    id: sourceMetadata.master_video_id,
    video_url: sourceMetadata.master_video_url,
    visual_notes: `${sampleApprovedMasterVerticalVideo.visual_notes || ''} Media Composer source_badge=${sourceMetadata.source_badge}; source_id=${sourceMetadata.source_id}; source_type=${sourceMetadata.source_type}.`,
    creative_angle: sourceMetadata.fallback_used
      ? sampleApprovedMasterVerticalVideo.creative_angle
      : `ใช้ metadata จริงจาก Media Composer render: ${sourceMetadata.source_badge} / ${sourceMetadata.source_id}`,
  };
  const preview = buildShortVideoPreviewQueue(masterVideoForPreview);
  const realVideoQualityGate = await buildRealVideoQualityGateV2(masterVideoForPreview.video_url, {
    final_master_video_asset_id: sourceMetadata.final_master_video_asset_id,
    video_asset_id: sourceMetadata.analyzed_video_asset_id,
    raw_video_asset_id: sourceMetadata.raw_video_asset_id,
    source_id: sourceMetadata.source_id,
    audio_expectation: sourceMetadata.audio_expectation,
  });
  const ownerDecisionStateByVariant = await loadShortVideoOwnerDecisionState();
  const manualPublishPackages = buildManualPublishPackages(sourceMetadata, ownerDecisionStateByVariant);
  const readyLabel = `${preview.summary.ready_count} พร้อม / ${preview.summary.needs_improvement_count} ควรปรับ / ${preview.summary.blocked_count} ยังไม่ควรโพสต์`;
  const sourceBadgeTone = sourceMetadata.fallback_used
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className="space-y-6">
      <PageHeader
        title="ตัวอย่างข้อความสำหรับลง Short Video"
        description="เตรียมข้อความสำหรับ YouTube Shorts, Facebook Reels, Instagram Reels และ TikTok จากคลิปแนวตั้งที่อนุมัติแล้ว"
      />

      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-amber-700" />
            <div>
              <div className="text-base font-black text-amber-950">หน้านี้เป็นโหมดดูตัวอย่างเท่านั้น ยังไม่มีการโพสต์จริง</div>
              <p className="text-sm text-amber-900">แอดมินใช้หน้านี้เพื่อตรวจข้อความและคะแนน ก่อนนำไปโพสต์เองแบบ Manual</p>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">ไม่มีการทำงานบนระบบจริง</Badge>
        </CardContent>
      </Card>

      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 shadow-sm">
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xl font-black text-slate-950">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                สรุปภาพรวมสำหรับแอดมิน
              </div>
              <p className="mt-1 text-sm text-slate-600">
                ระบบสร้างข้อความตัวอย่างครบ 4 แพลตฟอร์มจากคลิปเดียว โดยยังไม่เชื่อมต่อการโพสต์จริง
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
              สถานะระบบจริง = {thaiBoolean(preview.production_actions_performed)}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="จำนวนแพลตฟอร์ม" value={`${preview.summary.variant_count} ช่องทาง`} />
            <SummaryTile label="คะแนนเฉลี่ย" value={`${preview.summary.average_creative_score}/100`} tone="indigo" />
            <SummaryTile label="สถานะคลิปนี้" value={readyLabel} tone="emerald" />
            <SummaryTile label="เกณฑ์ผ่าน" value={`${preview.quality_gate_threshold}+ คะแนน`} />
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-700 md:grid-cols-2">
            <div>
              <div className="mb-2 font-black text-slate-950">Media Composer metadata handoff</div>
              <p><span className="font-semibold">source_label:</span> {sourceMetadata.source_label}</p>
              <p><span className="font-semibold">fallback_used:</span> {String(sourceMetadata.fallback_used)}</p>
              <p><span className="font-semibold">source_badge:</span> <Badge variant="outline" className={sourceBadgeTone}>{sourceMetadata.source_badge}</Badge></p>
              <p><span className="font-semibold">source_id:</span> {sourceMetadata.source_id}</p>
              <p><span className="font-semibold">video_asset_id:</span> {sourceMetadata.video_asset_id ? `${sourceMetadata.video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">raw_video_asset_id:</span> {sourceMetadata.raw_video_asset_id ? `${sourceMetadata.raw_video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">final_master_video_asset_id:</span> {sourceMetadata.final_master_video_asset_id ? `${sourceMetadata.final_master_video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">analyzed_video_asset_id:</span> {sourceMetadata.analyzed_video_asset_id ? `${sourceMetadata.analyzed_video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">audio_expectation:</span> {sourceMetadata.audio_expectation}</p>
            </div>
            <div>
              <div className="mb-2 font-black text-slate-950">Preview video reference</div>
              <p className="break-words"><span className="font-semibold">master_video_url:</span> {sourceMetadata.master_video_url}</p>
              <p><span className="font-semibold">source_type:</span> {sourceMetadata.source_type}</p>
              <p><span className="font-semibold">ready_for_distribution_preview:</span> true</p>
              <p><span className="font-semibold">creative_quality_gate_v1:</span> true</p>
              <p><span className="font-semibold">real_video_quality_gate_v2:</span> {String(realVideoQualityGate.real_video_quality_gate_v2)}</p>
              <p><span className="font-semibold">score_label:</span> {realVideoQualityGate.score_label}</p>
              <p className="line-clamp-2"><span className="font-semibold">tts_script:</span> {sourceMetadata.tts_script}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-700">
            <div className="mb-2 flex items-center gap-2 font-bold text-slate-950">
              <Eye className="h-4 w-4 text-indigo-600" />
              คลิปต้นฉบับที่ใช้ทำตัวอย่างจาก Media Composer
            </div>
            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <video className="aspect-[9/16] w-full rounded-2xl bg-slate-950 shadow-sm" controls preload="metadata" playsInline>
                <source src={masterVideoForPreview.video_url} type="video/mp4" />
                Browser ไม่รองรับวิดีโอ MP4
              </video>
              <div className="space-y-2">
                <p><span className="font-semibold">รหัสคลิป:</span> {preview.master_video_id}</p>
                <p><span className="font-semibold">รูปแบบ:</span> วิดีโอแนวตั้ง MP4, {masterVideoForPreview.aspect_ratio}, {masterVideoForPreview.duration_seconds} วินาที</p>
                <p><span className="font-semibold">source_type:</span> {sourceMetadata.source_type}</p>
                <p><span className="font-semibold">source_badge:</span> {sourceMetadata.source_badge}</p>
                <p><span className="font-semibold">source_id:</span> {sourceMetadata.source_id}</p>
                <p><span className="font-semibold">video_asset_id:</span> {sourceMetadata.video_asset_id ? `${sourceMetadata.video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">raw_video_asset_id:</span> {sourceMetadata.raw_video_asset_id ? `${sourceMetadata.raw_video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">final_master_video_asset_id:</span> {sourceMetadata.final_master_video_asset_id ? `${sourceMetadata.final_master_video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">analyzed_video_asset_id:</span> {sourceMetadata.analyzed_video_asset_id ? `${sourceMetadata.analyzed_video_asset_id.slice(0, 8)}…` : 'not provided'}</p>
              <p><span className="font-semibold">audio_expectation:</span> {sourceMetadata.audio_expectation}</p>
                <p><span className="font-semibold">ready_for_distribution_preview:</span> {String(sampleMediaComposerMasterVideoRecord.ready_for_distribution_preview)}</p>
                <Link href="/media-composer" className="inline-flex min-h-10 items-center rounded-2xl border border-indigo-200 bg-indigo-50 px-4 font-black text-indigo-700 hover:bg-indigo-100">
                  เปิด Media Composer
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ManualPublishPackagePanel packages={manualPublishPackages} />

      <section className="grid gap-4 xl:grid-cols-2" aria-label="ข้อความตัวอย่างแยกตามแพลตฟอร์ม">
        {preview.preview_queue.map((variant) => {
          const ownerDecisionState = ownerDecisionStateByVariant[variant.variant_id] || null;
          const publishReadiness = buildShortVideoPublishReadiness(variant, realVideoQualityGate, ownerDecisionState);
          return (
            <PlatformCard
              key={variant.variant_id}
              variant={variant}
              ownerDecisionState={ownerDecisionState}
              realVideoQualityGate={realVideoQualityGate}
              publishReadiness={publishReadiness}
            />
          );
        })}
      </section>
    </div>
  );
}

function SummaryTile({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'indigo' | 'emerald' }) {
  const toneClass = {
    slate: 'text-slate-950',
    indigo: 'text-indigo-700',
    emerald: 'text-emerald-700',
  }[tone];

  return (
    <div className="rounded-2xl bg-white/85 p-4 ring-1 ring-white">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-black leading-6 ${toneClass}`}>{value}</div>
    </div>
  );
}
