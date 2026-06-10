import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'short-video-qg-test-'));
const uploadRoot = path.join(tmpRoot, 'uploads');
const metadataLog = path.join(tmpRoot, 'uploaded-assets.jsonl');
await fsp.mkdir(uploadRoot, { recursive: true });
process.env.PRODUCT_VIDEO_UPLOAD_DIR = uploadRoot;
process.env.PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH = metadataLog;
process.env.SHORT_VIDEO_VISION_ANALYSIS_APPROVED = 'false';
process.env.REAL_SOCIAL_PUBLISH_ENABLED = 'false';

const modulePath = '../src/lib/short-video-distribution/real-video-quality-gate.ts';
const readinessPath = '../src/lib/short-video-distribution/publish-readiness.ts';
const publishPath = '../src/lib/short-video-distribution/publish.ts';
const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/short-video-distribution/page.tsx'), 'utf8');
const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/short-video-distribution/real-video-quality-gate.ts'), 'utf8');

const {
  buildRealVideoQualityGateV2,
  buildFrameTimestamps,
  parseProductVideoAssetIdFromTrustedRoute,
} = await import(modulePath);
const { buildShortVideoPublishReadiness } = await import(readinessPath);
const { publishShortVideoDistribution } = await import(publishPath);
const {
  buildShortVideoPreviewSourceMetadata,
} = await import('../src/lib/short-video-distribution/manual-publish-package.ts');

function run(command, args) {
  execFileSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
}

function metadata(record) {
  return JSON.stringify({
    filename: record.saved_filename,
    public_image_url: `https://studio.paaair.online/api/product-video/assets/${record.asset_id}`,
    public_media_url: `https://studio.paaair.online/api/product-video/assets/${record.asset_id}`,
    image_urls: [],
    media_urls: [`https://studio.paaair.online/api/product-video/assets/${record.asset_id}`],
    uploaded_at: new Date().toISOString(),
    source_badge: 'uploaded_asset',
    ...record,
  });
}

const videoAssetId = 'assetvalidvideo001';
const videoPath = path.join(uploadRoot, `${videoAssetId}.mp4`);
run('ffmpeg', [
  '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=24:duration=4',
  '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=4',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', videoPath,
]);

const noAudioAssetId = 'assetnoaudio001';
const noAudioPath = path.join(uploadRoot, `${noAudioAssetId}.mp4`);
run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=24:duration=2', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', noAudioPath]);

const invalidAssetId = 'assetinvalid001';
const invalidPath = path.join(uploadRoot, `${invalidAssetId}.mp4`);
await fsp.writeFile(invalidPath, 'not a real video');

const outsidePath = path.join(tmpRoot, 'outside.mp4');
await fsp.copyFile(videoPath, outsidePath);

await fsp.writeFile(metadataLog, [
  metadata({ asset_id: videoAssetId, saved_filename: `${videoAssetId}.mp4`, mime_type: 'video/mp4', media_type: 'video', size_bytes: fs.statSync(videoPath).size, local_asset_path: videoPath }),
  metadata({ asset_id: noAudioAssetId, saved_filename: `${noAudioAssetId}.mp4`, mime_type: 'video/mp4', media_type: 'video', size_bytes: fs.statSync(noAudioPath).size, local_asset_path: noAudioPath }),
  metadata({ asset_id: invalidAssetId, saved_filename: `${invalidAssetId}.mp4`, mime_type: 'video/mp4', media_type: 'video', size_bytes: fs.statSync(invalidPath).size, local_asset_path: invalidPath }),
  metadata({ asset_id: 'assetoutside001', saved_filename: 'assetoutside001.mp4', mime_type: 'video/mp4', media_type: 'video', size_bytes: fs.statSync(outsidePath).size, local_asset_path: outsidePath }),
].join('\n') + '\n');

assert.equal(parseProductVideoAssetIdFromTrustedRoute(`https://studio.paaair.online/api/product-video/assets/${videoAssetId}`), videoAssetId, 'approved asset URL parses correctly');
assert.equal(parseProductVideoAssetIdFromTrustedRoute('https://evil.example/media.mp4'), null, 'external URL is not parsed');
assert.equal(parseProductVideoAssetIdFromTrustedRoute('https://studio.paaair.online/api/product-video/assets/%2e%2e%2fsecret'), null, 'encoded traversal rejected');
assert.deepEqual(buildFrameTimestamps(2), [0, 1, 1.95], 'frame timestamps clamp and deduplicate for short clips');

const beforeTmp = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('short-video-quality-v2-')));
const validGate = await buildRealVideoQualityGateV2(`https://studio.paaair.online/api/product-video/assets/${videoAssetId}`);
const afterTmp = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('short-video-quality-v2-')));
assert.equal(validGate.asset_resolver_source, 'asset_route_url', 'valid asset resolves through trusted route');
assert.equal(validGate.resolved_asset_id, videoAssetId, 'valid asset resolves correctly');
assert.equal(validGate.ffprobe_performed, true, 'ffprobe parser runs');
assert.equal(validGate.frames_extracted, true, 'frames extracted');
assert.equal(validGate.audio_analyzed, true, 'audio inspected');
assert.ok(validGate.duration_seconds > 0, 'duration populated');
assert.equal(validGate.width, 1080, 'width populated');
assert.equal(validGate.height, 1920, 'height populated');
assert.equal(validGate.aspect_ratio, '9:16', 'aspect ratio populated');
assert.equal(validGate.video_codec, 'h264', 'video codec populated');
assert.equal(validGate.audio_codec, 'aac', 'audio codec populated');
assert.ok(validGate.audio_sample_rate > 0, 'audio sample rate populated');
assert.ok(validGate.audio_channels > 0, 'audio channels populated');
assert.equal(validGate.audio.has_audio, true, 'has_audio true for audio file');
assert.equal(validGate.vision_model_called, false, 'vision disabled');
assert.equal(validGate.score_label, 'technical_video_score', 'vision-disabled result uses technical_video_score');
assert.ok(validGate.quality_score > 0, 'technical score > 0');
assert.deepEqual(beforeTmp, afterTmp, 'temporary frame directory cleaned');

const noAudioGate = await buildRealVideoQualityGateV2(`https://studio.paaair.online/api/product-video/assets/${noAudioAssetId}`, {
  audio_expectation: 'required',
});
assert.equal(noAudioGate.audio_analyzed, true, 'no-audio inspection completed');
assert.equal(noAudioGate.audio.has_audio, false, 'no-audio file returns has_audio=false');
assert.equal(noAudioGate.decision, 'blocked', 'required audio missing blocks gate');
assert.equal(noAudioGate.ready_for_publish, false, 'required audio missing keeps publish unready');
assert.equal(noAudioGate.recommendations.includes('วิดีโอสุดท้ายไม่มีเสียง ทั้งที่ตั้งค่าให้ใช้เสียงบรรยาย'), true, 'required audio missing returns Thai hard-fail reason');

const finalMasterAssetId = 'finalmaster001';
const rawSourceAssetId = 'rawsource001';
const finalMasterPath = path.join(uploadRoot, `${finalMasterAssetId}.mp4`);
run('ffmpeg', [
  '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=24:duration=4',
  '-f', 'lavfi', '-i', 'sine=frequency=1200:duration=4',
  '-vf', 'hue=s=0.7', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', finalMasterPath,
]);
await fsp.appendFile(metadataLog, metadata({ asset_id: finalMasterAssetId, saved_filename: `${finalMasterAssetId}.mp4`, mime_type: 'video/mp4', media_type: 'video', size_bytes: fs.statSync(finalMasterPath).size, local_asset_path: finalMasterPath, asset_role: 'final_master_video' }) + '\n');
const sourceMetadata = buildShortVideoPreviewSourceMetadata({
  master_video_id: 'master-video-id',
  raw_video_asset_id: rawSourceAssetId,
  final_master_video_asset_id: finalMasterAssetId,
  video_asset_id: rawSourceAssetId,
  master_video_url: `https://studio.paaair.online/api/product-video/assets/${rawSourceAssetId}`,
  final_master_video_url: `https://studio.paaair.online/api/product-video/assets/${finalMasterAssetId}`,
  audio_expectation: 'required',
  source_badge: 'uploaded_asset',
});
assert.equal(sourceMetadata.raw_video_asset_id, rawSourceAssetId, 'raw source id is preserved separately');
assert.equal(sourceMetadata.final_master_video_asset_id, finalMasterAssetId, 'final master id is preserved separately');
assert.notEqual(sourceMetadata.raw_video_asset_id, sourceMetadata.final_master_video_asset_id, 'raw and final master IDs are distinct');
assert.equal(sourceMetadata.analyzed_video_asset_id, finalMasterAssetId, 'distribution prefers final master for analysis');
assert.equal(sourceMetadata.master_video_url, `https://studio.paaair.online/api/product-video/assets/${finalMasterAssetId}`, 'trusted final master URL overrides raw source URL');
const finalMasterGate = await buildRealVideoQualityGateV2(sourceMetadata.master_video_url, {
  final_master_video_asset_id: sourceMetadata.final_master_video_asset_id,
  video_asset_id: sourceMetadata.analyzed_video_asset_id,
  raw_video_asset_id: sourceMetadata.raw_video_asset_id,
  audio_expectation: sourceMetadata.audio_expectation,
});
assert.equal(finalMasterGate.resolved_asset_id, finalMasterAssetId, 'quality gate analyzes final master asset id');
assert.equal(finalMasterGate.analyzed_asset_id, finalMasterAssetId, 'analyzed asset id is final master');
assert.equal(finalMasterGate.asset_role, 'final_master_video', 'asset role is final master');
assert.equal(finalMasterGate.audio.has_audio, true, 'final master with audio passes audio presence');
assert.equal(finalMasterGate.decision, 'passed', 'valid final master with audio passes technical analysis');
assert.equal(finalMasterGate.ready_for_publish, true, 'valid final master is technically publish-ready before owner/provider gates');
assert.notEqual(finalMasterGate.video_sha256_prefix, validGate.video_sha256_prefix, 'changed final master invalidates previous checksum');

const invalidGate = await buildRealVideoQualityGateV2(`https://studio.paaair.online/api/product-video/assets/${invalidAssetId}`);
assert.equal(invalidGate.ffprobe_performed, false, 'invalid video cannot ffprobe');
assert.equal(invalidGate.decision, 'blocked', 'invalid video cannot pass');

const missingGate = await buildRealVideoQualityGateV2('https://studio.paaair.online/api/product-video/assets/notfound001');
assert.equal(missingGate.errors.includes('asset_metadata_not_found'), true, 'missing metadata returns typed failure');

const outsideGate = await buildRealVideoQualityGateV2('https://studio.paaair.online/api/product-video/assets/assetoutside001');
assert.equal(outsideGate.errors.includes('asset_path_outside_root'), true, 'path outside approved root rejected');

const externalGate = await buildRealVideoQualityGateV2('https://evil.example/video.mp4');
assert.equal(externalGate.errors.includes('external_url_not_allowed'), true, 'external URL rejected');

assert.match(source, /realpathSync\(PRODUCT_VIDEO_UPLOAD_DIR\)/, 'canonical approved root validation present');
assert.match(source, /!canonicalPath\.startsWith\(root \+ path\.sep\)/, 'symlink/root escape guard present');
assert.match(source, /metadata\.local_asset_path/, 'metadata.local_asset_path used only server-side');
assert.doesNotMatch(source, /fetch\s*\(/, 'no remote fallback/download added');
assert.equal((pageSource.match(/buildRealVideoQualityGateV2\(/g) || []).length, 1, 'page analyzes the physical video once');
assert.match(pageSource, /preview\.preview_queue\.map/, 'platform cards reuse shared result');

const variant = {
  variant_id: 'v1',
  master_video_id: 'm1',
  platform: 'facebook_reels',
  platform_label: 'Facebook Reels',
  video_url: `https://studio.paaair.online/api/product-video/assets/${videoAssetId}`,
  metadata: { caption: 'caption', page_id: 'FACEBOOK_PAGE_ID_PLACEHOLDER' },
  publish_flags: {},
  creative_quality_gate: { decision: 'ready_for_owner_review', creative_score: 90 },
};
const readiness = buildShortVideoPublishReadiness(variant, validGate, null);
assert.equal(readiness.publish_allowed, false, 'publish readiness remains blocked without owner/provider readiness');

const publishResult = await publishShortVideoDistribution({ platform: 'facebook_reels', dry_run: true, publish_readiness: readiness, real_video_quality_gate_v2: validGate });
assert.equal(publishResult.external_api_calls_performed, false, 'social adapters are not invoked');
assert.equal(publishResult.publish_attempted, false, 'publish not attempted');

console.log(JSON.stringify({
  ok: true,
  tests: [
    'approved asset URL parses correctly',
    'external URL rejected',
    'malformed/encoded traversal rejected',
    'missing metadata typed failure',
    'path outside root rejected',
    'valid asset resolves correctly',
    'ffprobe parser populates real media facts',
    'frame timestamps clamp and deduplicate',
    'no-audio returns audio_analyzed=true and has_audio=false',
    'required audio missing blocks Gate with Thai hard-fail reason',
    'distribution prefers final master over raw video',
    'final master and raw IDs are distinct',
    'valid final master with audio passes technical analysis',
    'changed final master invalidates previous Gate/checksum',
    'invalid video cannot pass',
    'analysis runs once and is reused by page',
    'vision-disabled result uses technical_video_score',
    'publish readiness blocked without owner/provider readiness',
    'social adapters are not invoked',
    'temporary files are cleaned',
  ],
  proof: {
    resolver: validGate.asset_resolver_source,
    asset_id_prefix: validGate.resolved_asset_id.slice(0, 8),
    ffprobe_performed: validGate.ffprobe_performed,
    frames_extracted: validGate.frames_extracted,
    audio_analyzed: validGate.audio_analyzed,
    duration_seconds: validGate.duration_seconds,
    width: validGate.width,
    height: validGate.height,
    aspect_ratio: validGate.aspect_ratio,
    has_audio: validGate.audio.has_audio,
    loudness_not_silent: validGate.audio.loudness_not_silent,
    clipping_risk: validGate.audio.clipping_risk,
    technical_video_score: validGate.quality_score,
    vision_model_called: validGate.vision_model_called,
    publish_allowed: readiness.publish_allowed,
  },
}, null, 2));

await fsp.rm(tmpRoot, { recursive: true, force: true });
