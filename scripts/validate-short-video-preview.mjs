import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  page: path.join(root, 'src/app/short-video-distribution/page.tsx'),
  planner: path.join(root, 'src/lib/short-video-distribution/planner.ts'),
  fixture: path.join(root, 'src/lib/short-video-distribution/sample-fixture.ts'),
  sidebar: path.join(root, 'src/components/layout/sidebar.tsx'),
  ownerDecisionLib: path.join(root, 'src/lib/short-video-distribution/owner-review-decisions.ts'),
  ownerDecisionRoute: path.join(root, 'src/app/api/short-video-distribution/preview-decisions/[variantId]/route.ts'),
  ownerDecisionPanel: path.join(root, 'src/components/short-video-distribution/owner-review-decision-panel.tsx'),
  manualPublishLib: path.join(root, 'src/lib/short-video-distribution/manual-publish-package.ts'),
  manualPublishRoute: path.join(root, 'src/app/api/short-video-distribution/manual-publish-package/route.ts'),
  manualPublishPanel: path.join(root, 'src/components/short-video-distribution/manual-publish-package-panel.tsx'),
};

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

const page = read(files.page);
const planner = read(files.planner);
const fixture = read(files.fixture);
const sidebar = read(files.sidebar);
const ownerDecisionLib = read(files.ownerDecisionLib);
const ownerDecisionRoute = read(files.ownerDecisionRoute);
const ownerDecisionPanel = read(files.ownerDecisionPanel);
const manualPublishLib = read(files.manualPublishLib);
const manualPublishRoute = read(files.manualPublishRoute);
const manualPublishPanel = read(files.manualPublishPanel);
const combinedNewModule = `${page}\n${planner}\n${fixture}`;
const ownerDecisionModule = `${ownerDecisionLib}\n${ownerDecisionRoute}\n${ownerDecisionPanel}`;
const manualPublishModule = `${manualPublishLib}\n${manualPublishRoute}\n${manualPublishPanel}`;

const expectedPlatforms = ['youtube_shorts', 'facebook_reels', 'instagram_reels', 'tiktok'];
for (const platform of expectedPlatforms) {
  if (!planner.includes(platform)) throw new Error(`Planner missing platform: ${platform}`);
}

for (const label of ['YouTube Shorts', 'Facebook Reels', 'Instagram Reels', 'TikTok']) {
  if (!planner.includes(label)) throw new Error(`Planner missing label: ${label}`);
}

const creativeFields = [
  'creative_score',
  'hook_score',
  'visual_clarity_score',
  'platform_fit_score',
  'caption_strength_score',
  'cta_score',
  'decision',
  'recommendations',
];

const summaryFields = [
  'average_creative_score',
  'ready_count',
  'needs_improvement_count',
  'blocked_count',
];

const requiredSnippets = [
  'variant_count: preview_queue.length',
  'all_publish_flags_false',
  'production_actions_performed: false',
  'publish_requested: false',
  'publish_enabled: false',
  'publish_attempted: false',
  'scheduler_enabled: false',
  'line_broadcast_enabled: false',
  'ready_for_api_publish_phase: false',
  'Preview-only',
  'Creative Quality Gate v1',
  'sampleApprovedMasterVerticalVideo',
  'ready_for_owner_review',
  'needs_improvement',
  'blocked_from_publish',
  ...creativeFields,
  ...summaryFields,
];

for (const snippet of requiredSnippets) {
  if (!combinedNewModule.includes(snippet)) throw new Error(`Missing required preview-only snippet: ${snippet}`);
}

const forbiddenPatterns = [
  /fetch\s*\(/,
  /method\s*:\s*['"]POST['"]/i,
  /videos\.insert/i,
  /graph\.facebook\.com/i,
  /business_discovery/i,
  /content\/posting/i,
  /LINE_BROADCAST_API/i,
  /scheduler_enabled\s*:\s*true/i,
  /line_broadcast_enabled\s*:\s*true/i,
  /production_actions_performed\s*:\s*true/i,
  /publish_enabled\s*:\s*true/i,
  /publish_attempted\s*:\s*true/i,
  /process\.env/,
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(combinedNewModule)) throw new Error(`Forbidden pattern found in preview module: ${pattern}`);
}

if (/<button\b/i.test(page)) throw new Error('Preview page must not expose server-rendered action buttons.');
if (!sidebar.includes('/short-video-distribution')) throw new Error('Sidebar link missing for preview module.');
if (!fixture.includes("approval_status: 'approved'")) throw new Error('Fixture must represent an approved master video.');
if (!fixture.includes("asset_type: 'vertical_mp4'")) throw new Error('Fixture must represent a vertical MP4.');
if (!fixture.includes('visual_notes')) throw new Error('Fixture must include visual_notes for creative quality scoring.');
if (!fixture.includes('creative_angle')) throw new Error('Fixture must include creative_angle for creative quality scoring.');

const ownerDecisionRequiredSnippets = [
  "'approve'",
  "'reject'",
  "'request_changes'",
  "approved_for_manual_publish",
  "changes_requested",
  "short-video-preview-owner-decisions.jsonl",
  "record_type: 'short_video_preview_owner_decision'",
  "local_only: true",
  "preview_only: true",
  "publish_allowed: false",
  "facebook_post_performed: false",
  "instagram_post_performed: false",
  "tiktok_post_performed: false",
  "youtube_post_performed: false",
  "line_broadcast_performed: false",
  "schedule_enabled: false",
  "scheduler_enabled: false",
  "renderer_called: false",
  "tts_called: false",
  "s3_upload_performed: false",
  "mark_posted_performed: false",
  "production_actions_performed: false",
  "all_safety_flags_false",
  "Owner Review Decision Layer v1",
  "No publish/provider action was performed",
];

for (const snippet of ownerDecisionRequiredSnippets) {
  if (!ownerDecisionModule.includes(snippet)) throw new Error(`Missing owner decision snippet: ${snippet}`);
}

const forbiddenOwnerDecisionPatterns = [
  /graph\.facebook\.com/i,
  /business_discovery/i,
  /videos\.insert/i,
  /tiktok\.com/i,
  /LINE_BROADCAST_API/i,
  /publish_allowed\s*:\s*true/i,
  /post_performed\s*:\s*true/i,
  /schedule_enabled\s*:\s*true/i,
  /scheduler_enabled\s*:\s*true/i,
  /renderer_called\s*:\s*true/i,
  /tts_called\s*:\s*true/i,
  /s3_upload_performed\s*:\s*true/i,
  /mark_posted_performed\s*:\s*true/i,
  /production_actions_performed\s*:\s*true/i,
  /process\.env/,
];

for (const pattern of forbiddenOwnerDecisionPatterns) {
  if (pattern.test(ownerDecisionModule)) throw new Error(`Forbidden pattern found in owner decision layer: ${pattern}`);
}

const manualPublishRequiredSnippets = [
  'ManualPublishPackage',
  'package_id',
  'master_video_id',
  'variant_id',
  'platform_label',
  'owner_decision',
  'source_badge',
  'source_id',
  'source_type',
  'master_video_url',
  'caption',
  'hashtags',
  'cta',
  'suggested_manual_steps',
  'creative_score',
  'readiness',
  'generated_at',
  'safety_flags',
  'manual_publish_package_v1',
  'Manual Publish Package',
  'label="caption"',
  'label="hashtags"',
  'label="CTA"',
  'label="video URL"',
  'Download JSON',
  'manual export only',
  'approved_for_manual_publish',
  'ready_for_owner_review',
  'facebook_publish_enabled: false',
  'instagram_publish_enabled: false',
  'tiktok_publish_enabled: false',
  'youtube_publish_enabled: false',
  'line_broadcast_enabled: false',
  'scheduler_enabled: false',
  'external_api_calls_performed: false',
  'production_actions_performed: false',
  'mark_posted_performed: false',
  'all_publish_flags_false',
];

for (const snippet of manualPublishRequiredSnippets) {
  if (!manualPublishModule.includes(snippet) && !page.includes(snippet)) throw new Error(`Missing manual publish package snippet: ${snippet}`);
}

const forbiddenManualPublishPatterns = [
  /graph\.facebook\.com/i,
  /business_discovery/i,
  /videos\.insert/i,
  /content\/posting/i,
  /api\.tiktok/i,
  /LINE_BROADCAST_API/i,
  /publish_enabled\s*:\s*true/i,
  /publish_attempted\s*:\s*true/i,
  /facebook_publish_enabled\s*:\s*true/i,
  /instagram_publish_enabled\s*:\s*true/i,
  /tiktok_publish_enabled\s*:\s*true/i,
  /youtube_publish_enabled\s*:\s*true/i,
  /scheduler_enabled\s*:\s*true/i,
  /line_broadcast_enabled\s*:\s*true/i,
  /external_api_calls_performed\s*:\s*true/i,
  /mark_posted_performed\s*:\s*true/i,
  /production_actions_performed\s*:\s*true/i,
  /process\.env/,
];

for (const pattern of forbiddenManualPublishPatterns) {
  if (pattern.test(manualPublishModule)) throw new Error(`Forbidden pattern found in manual publish package layer: ${pattern}`);
}

console.log(JSON.stringify({
  ok: true,
  route: '/short-video-distribution',
  expected_variant_count: 4,
  platforms: expectedPlatforms,
  preview_only: true,
  creative_quality_gate_v1: true,
  creative_fields: creativeFields,
  summary_fields: summaryFields,
  no_publish_action_exists: true,
  owner_review_decision_layer_v1: true,
  manual_publish_package_v1: true,
  manual_publish_package_api: '/api/short-video-distribution/manual-publish-package',
  manual_publish_package_safety_flags_false: true,
  allowed_owner_decisions: ['approve', 'reject', 'request_changes'],
  decision_audit_log: 'runtime/short-video-preview-owner-decisions.jsonl',
  all_decision_safety_flags_false: true,
  all_publish_flags_false: true,
  production_actions_performed: false,
  validation_scope: 'static safety + creative quality gate integration checks for short-video preview module',
}, null, 2));
