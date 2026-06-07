'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Download, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ManualPublishPackage } from '@/lib/short-video-distribution/manual-publish-package';

type Props = {
  packages: ManualPublishPackage[];
};

function packageJsonText(pkg: ManualPublishPackage): string {
  return JSON.stringify(pkg, null, 2);
}

function downloadJson(pkg: ManualPublishPackage) {
  const blob = new Blob([packageJsonText(pkg)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pkg.package_id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ label, value, onCopied }: { label: string; value: string; onCopied: (label: string) => void }) {
  async function copyValue() {
    await navigator.clipboard.writeText(value);
    onCopied(label);
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 hover:bg-slate-50"
    >
      <Clipboard className="h-3.5 w-3.5" />
      Copy {label}
    </button>
  );
}

function PackageCard({ pkg, onCopied }: { pkg: ManualPublishPackage; onCopied: (label: string) => void }) {
  const jsonText = useMemo(() => packageJsonText(pkg), [pkg]);
  const hashtagText = pkg.hashtags.join(' ');

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-black text-slate-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {pkg.platform_label} Manual Publish Package
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            manual export only — ไม่มีการโพสต์จริง ไม่มีการเรียก platform API และไม่ mark posted
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
          {pkg.readiness}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold">package_id:</span> {pkg.package_id}</div>
        <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold">owner_decision:</span> {pkg.owner_decision}</div>
        <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold">source_badge:</span> {pkg.source_badge}</div>
        <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold">creative_score:</span> {pkg.creative_score}</div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs font-black text-slate-500">caption</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-900">{pkg.caption}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-900">
          <span className="font-black text-slate-500">hashtags:</span> {hashtagText || '-'}
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-900">
          <span className="font-black text-slate-500">CTA:</span> {pkg.cta}
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-900">
          <span className="font-black text-slate-500">video URL:</span> <span className="break-all">{pkg.master_video_url}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton label="caption" value={pkg.caption} onCopied={onCopied} />
        <CopyButton label="hashtags" value={hashtagText} onCopied={onCopied} />
        <CopyButton label="CTA" value={pkg.cta} onCopied={onCopied} />
        <CopyButton label="video URL" value={pkg.master_video_url} onCopied={onCopied} />
        <CopyButton label="JSON" value={jsonText} onCopied={onCopied} />
        <button
          type="button"
          onClick={() => downloadJson(pkg)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-xs font-black text-white hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5" />
          Download JSON
        </button>
      </div>

      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <summary className="cursor-pointer font-black text-slate-800">suggested_manual_steps + safety_flags</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {pkg.suggested_manual_steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {Object.entries(pkg.safety_flags).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-white px-2 py-1 font-bold text-emerald-800">{key}={String(value)}</div>
          ))}
        </div>
      </details>
    </div>
  );
}

export function ManualPublishPackagePanel({ packages }: Props) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  if (!packages.length) return null;

  function onCopied(label: string) {
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel(null), 1400);
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-black text-emerald-950">
            <ShieldCheck className="h-5 w-5" />
            Manual Publish Package
          </div>
          <p className="mt-1 text-sm leading-6 text-emerald-900">
            แสดงเฉพาะรายการที่ Owner approved หรือพร้อม owner review เพื่อให้แอดมิน copy/export ไปโพสต์เองเท่านั้น
          </p>
        </div>
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">manual_publish_package_v1=true</Badge>
      </div>
      {copiedLabel ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-800">Copied {copiedLabel}</p> : null}
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {packages.map((pkg) => <PackageCard key={pkg.package_id} pkg={pkg} onCopied={onCopied} />)}
      </div>
    </section>
  );
}
