import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  page: path.join(root, 'src/app/short-video-distribution/page.tsx'),
  planner: path.join(root, 'src/lib/short-video-distribution/planner.ts'),
  fixture: path.join(root, 'src/lib/short-video-distribution/sample-fixture.ts'),
  sidebar: path.join(root, 'src/components/layout/sidebar.tsx'),
};

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

const page = read(files.page);
const planner = read(files.planner);
const fixture = read(files.fixture);
const sidebar = read(files.sidebar);
const combinedNewModule = `${page}\n${planner}\n${fixture}`;

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

if (/<button\b/i.test(page)) throw new Error('Preview page must not expose action buttons.');
if (!sidebar.includes('/short-video-distribution')) throw new Error('Sidebar link missing for preview module.');
if (!fixture.includes("approval_status: 'approved'")) throw new Error('Fixture must represent an approved master video.');
if (!fixture.includes("asset_type: 'vertical_mp4'")) throw new Error('Fixture must represent a vertical MP4.');
if (!fixture.includes('visual_notes')) throw new Error('Fixture must include visual_notes for creative quality scoring.');
if (!fixture.includes('creative_angle')) throw new Error('Fixture must include creative_angle for creative quality scoring.');

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
  all_publish_flags_false: true,
  production_actions_performed: false,
  validation_scope: 'static safety + creative quality gate integration checks for short-video preview module',
}, null, 2));
