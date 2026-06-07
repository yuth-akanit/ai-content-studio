import { NextRequest, NextResponse } from 'next/server';
import {
  allManualPublishPackageSafetyFlagsFalse,
  buildManualPublishPackages,
  buildShortVideoPreviewSourceMetadata,
  MANUAL_PUBLISH_PACKAGE_SAFETY_FLAGS,
} from '@/lib/short-video-distribution/manual-publish-package';
import { loadShortVideoOwnerDecisionState } from '@/lib/short-video-distribution/owner-review-decisions';

export async function GET(request: NextRequest) {
  const queryParams: Record<string, string | undefined> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const sourceMetadata = buildShortVideoPreviewSourceMetadata(queryParams);
  const ownerDecisionStateByVariant = await loadShortVideoOwnerDecisionState();
  const requestedVariantId = String(request.nextUrl.searchParams.get('variant_id') || '').trim();
  const packages = buildManualPublishPackages(sourceMetadata, ownerDecisionStateByVariant)
    .filter((pkg) => !requestedVariantId || pkg.variant_id === requestedVariantId);

  return NextResponse.json({
    ok: true,
    manual_publish_package_v1: true,
    preview_only: true,
    local_only: true,
    source_metadata: sourceMetadata,
    packages,
    package_count: packages.length,
    safety_flags: { ...MANUAL_PUBLISH_PACKAGE_SAFETY_FLAGS },
    all_publish_flags_false: true,
    all_safety_flags_false: allManualPublishPackageSafetyFlagsFalse(MANUAL_PUBLISH_PACKAGE_SAFETY_FLAGS),
    facebook_publish_enabled: false,
    instagram_publish_enabled: false,
    tiktok_publish_enabled: false,
    youtube_publish_enabled: false,
    line_broadcast_enabled: false,
    scheduler_enabled: false,
    external_api_calls_performed: false,
    production_actions_performed: false,
    mark_posted_performed: false,
    message: 'Manual export only. No platform API calls, no DB mutation, no scheduler, and no mark-posted action.',
  });
}
