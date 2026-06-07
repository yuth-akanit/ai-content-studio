import { AlertTriangle, Award, CheckCircle2, Copy, Eye, ShieldCheck, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { buildShortVideoPreviewQueue, type PlatformMetadata, type ShortVideoPlatformVariant } from '@/lib/short-video-distribution/planner';
import { sampleApprovedMasterVerticalVideo } from '@/lib/short-video-distribution/sample-fixture';

function metadataEntries(metadata: PlatformMetadata): Array<{ label: string; value: string }> {
  return Object.entries(metadata).map(([key, value]) => ({
    label: key,
    value: Array.isArray(value) ? value.join(', ') : String(value),
  }));
}

function SafetyFlagGrid({ variant }: { variant: ShortVideoPlatformVariant }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Object.entries(variant.publish_flags).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs">
          <span className="font-medium text-emerald-950">{key}</span>
          <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
            {String(value)}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function PlatformCard({ variant }: { variant: ShortVideoPlatformVariant }) {
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <Video className="h-4 w-4 text-indigo-600" />
              {variant.platform_label}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">Variant ID: {variant.variant_id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Preview-only</Badge>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              Score {variant.quality_gate.score}/100
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Copy className="h-4 w-4 text-slate-500" />
            Platform metadata
          </div>
          <dl className="space-y-2">
            {metadataEntries(variant.metadata).map((entry) => (
              <div key={entry.label} className="rounded-lg bg-white p-2 ring-1 ring-slate-100">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{entry.label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-950">
              <Award className="h-4 w-4" />
              Creative Quality Gate v1
            </div>
            <Badge variant="outline" className="border-indigo-200 bg-white text-indigo-700">
              {variant.creative_quality_gate.decision}
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-3 ring-1 ring-indigo-100 sm:col-span-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">creative_score</div>
              <div className="text-3xl font-black text-indigo-950">{variant.creative_quality_gate.creative_score}</div>
            </div>
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              <div className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-indigo-100">Hook: <span className="font-bold">{variant.creative_quality_gate.hook_score}</span></div>
              <div className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-indigo-100">Visual clarity: <span className="font-bold">{variant.creative_quality_gate.visual_clarity_score}</span></div>
              <div className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-indigo-100">Platform fit: <span className="font-bold">{variant.creative_quality_gate.platform_fit_score}</span></div>
              <div className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-indigo-100">Caption strength: <span className="font-bold">{variant.creative_quality_gate.caption_strength_score}</span></div>
              <div className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-indigo-100 sm:col-span-2">CTA: <span className="font-bold">{variant.creative_quality_gate.cta_score}</span></div>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-indigo-100">
            <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Recommendations</div>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-indigo-950">
              {variant.creative_quality_gate.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              Publish readiness
            </div>
            <div className="mt-2 space-y-1 text-xs text-emerald-950">
              <p>Manual review: {variant.publish_readiness_report.ready_for_manual_review ? 'ready' : 'blocked'}</p>
              <p>API publish phase: {String(variant.publish_readiness_report.ready_for_api_publish_phase)}</p>
              <p>Missing fields: {variant.publish_readiness_report.missing_fields.length || 0}</p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Publish blocked
            </div>
            <p className="mt-2 text-xs text-amber-950">{variant.publish_readiness_report.publish_blocked_reason}</p>
          </div>
        </div>

        <SafetyFlagGrid variant={variant} />
      </CardContent>
    </Card>
  );
}

export default function ShortVideoDistributionPage() {
  const preview = buildShortVideoPreviewQueue(sampleApprovedMasterVerticalVideo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Short Video Distribution Preview"
        description="Preview-only metadata planner for one approved PA Air Service vertical MP4. No publish actions are available on this page."
      />

      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Preview-only safety lock
              </div>
              <p className="mt-1 text-sm text-slate-600">
                This module reads a local approved sample fixture and renders four platform variants for manual review only.
              </p>
            </div>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">production_actions_performed=false</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
              <div className="text-xs font-semibold text-slate-500">Variants</div>
              <div className="text-2xl font-black text-slate-950">{preview.summary.variant_count}</div>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
              <div className="text-xs font-semibold text-slate-500">Avg creative score</div>
              <div className="text-2xl font-black text-indigo-700">{preview.summary.average_creative_score}</div>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
              <div className="text-xs font-semibold text-slate-500">Ready / Improve / Blocked</div>
              <div className="text-sm font-bold text-slate-950">
                {preview.summary.ready_count} / {preview.summary.needs_improvement_count} / {preview.summary.blocked_count}
              </div>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
              <div className="text-xs font-semibold text-slate-500">Quality threshold</div>
              <div className="text-2xl font-black text-slate-950">{preview.quality_gate_threshold}+</div>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
              <div className="text-xs font-semibold text-slate-500">Publish flags</div>
              <div className="text-sm font-bold text-emerald-700">all false = {String(preview.summary.all_publish_flags_false)}</div>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
              <div className="text-xs font-semibold text-slate-500">Mode</div>
              <div className="text-sm font-bold text-amber-700">{preview.mode}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
            <div className="mb-2 flex items-center gap-2 font-bold text-slate-950">
              <Eye className="h-4 w-4 text-indigo-600" />
              Approved master video fixture
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <p><span className="font-semibold">ID:</span> {preview.master_video_id}</p>
              <p><span className="font-semibold">Asset:</span> {sampleApprovedMasterVerticalVideo.asset_type}, {sampleApprovedMasterVerticalVideo.aspect_ratio}, {sampleApprovedMasterVerticalVideo.duration_seconds}s</p>
              <p className="md:col-span-2"><span className="font-semibold">Video URL:</span> {sampleApprovedMasterVerticalVideo.video_url}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2" aria-label="Short video platform variants">
        {preview.preview_queue.map((variant) => (
          <PlatformCard key={variant.variant_id} variant={variant} />
        ))}
      </section>
    </div>
  );
}
