import { NextRequest, NextResponse } from 'next/server';
import { PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS } from '@/lib/product-video-preview-log';
import {
  createProductVideoUploadedAssetMetadata,
  saveProductVideoUploadedAsset,
} from '@/lib/product-video-assets';
import type { MediaComposerInput } from '@/lib/media-composer';

export const dynamic = 'force-dynamic';

type MediaComposerUploadKind = 'raw_video' | 'before_image' | 'after_image';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 80 * 1024 * 1024;
const ALLOWED_UPLOAD_KINDS = new Set<MediaComposerUploadKind>(['raw_video', 'before_image', 'after_image']);

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUploadKind(value: string): value is MediaComposerUploadKind {
  return ALLOWED_UPLOAD_KINDS.has(value as MediaComposerUploadKind);
}

function buildError(status: number, error: string, message: string) {
  return NextResponse.json(
    {
      ok: false,
      error,
      message,
      module: 'media_composer_direct_upload_v1',
      preview_only: true,
      source_badge: 'uploaded_asset',
      all_publish_flags_false: true,
      external_api_calls_performed: false,
      production_actions_performed: false,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
    },
    { status },
  );
}

function buildPreviewInput(uploadKind: MediaComposerUploadKind, publicMediaUrl: string): MediaComposerInput {
  const base = {
    tts_script: 'ไฟล์นี้อัปโหลดโดยตรงเพื่อทำ Media Composer preview เท่านั้น ไม่มีการโพสต์จริง',
    cta_banner: 'ทัก PA Air Service เพื่อจองคิว',
    brand: 'PA Air Service',
    source_id: `uploaded-asset-${uploadKind}`,
    source_badge: 'uploaded_asset' as const,
  };

  if (uploadKind === 'raw_video') {
    return {
      source_type: 'raw_video',
      raw_video_url: publicMediaUrl,
      ...base,
    };
  }

  return {
    source_type: 'image_pair',
    before_image_url: uploadKind === 'before_image' ? publicMediaUrl : '',
    after_image_url: uploadKind === 'after_image' ? publicMediaUrl : '',
    ...base,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const uploadKindText = cleanText(formData.get('upload_kind'));
    const file = formData.get('file');

    if (!isUploadKind(uploadKindText)) {
      return buildError(400, 'invalid_upload_kind', 'upload_kind must be raw_video, before_image, or after_image');
    }

    if (!file || !(file instanceof File)) {
      return buildError(400, 'no_file_uploaded', 'No file was provided in the media composer upload request');
    }

    const mimeType = file.type || '';
    const expectsVideo = uploadKindText === 'raw_video';
    if (expectsVideo && !mimeType.startsWith('video/')) {
      return buildError(400, 'invalid_mime_type', 'Upload Raw Video requires a video file');
    }
    if (!expectsVideo && !mimeType.startsWith('image/')) {
      return buildError(400, 'invalid_mime_type', 'Before/After uploads require image files');
    }

    const maxBytes = expectsVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
    if (file.size > maxBytes) {
      return buildError(400, 'file_too_large', `File exceeds the maximum limit of ${Math.round(maxBytes / (1024 * 1024))}MB`);
    }

    const metadata = createProductVideoUploadedAssetMetadata({
      request,
      originalFilename: file.name || (expectsVideo ? 'uploaded_raw_video.mp4' : 'uploaded_image.png'),
      mimeType,
      sizeBytes: file.size,
    });
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveProductVideoUploadedAsset(metadata, buffer);

    const publicMediaUrl = metadata.public_media_url || metadata.public_image_url;
    const previewInput = buildPreviewInput(uploadKindText, publicMediaUrl);

    return NextResponse.json({
      ok: true,
      status: 'upload_success',
      module: 'media_composer_direct_upload_v1',
      preview_only: true,
      upload_kind: uploadKindText,
      asset_id: metadata.asset_id,
      uploaded_asset_id: metadata.asset_id,
      filename: metadata.filename,
      mime_type: metadata.mime_type,
      media_type: metadata.media_type,
      size_bytes: metadata.size_bytes,
      public_media_url: publicMediaUrl,
      public_image_url: metadata.media_type === 'image' ? publicMediaUrl : null,
      image_urls: metadata.media_type === 'image' ? [publicMediaUrl] : [],
      source_badge: 'uploaded_asset',
      // source_badge=uploaded_asset
      source_option: {
        id: `uploaded-asset-${metadata.asset_id}-${uploadKindText}`,
        label: `Uploaded Asset · ${metadata.filename}`,
        source_type: uploadKindText === 'raw_video' ? 'raw_video' : 'image_pair',
        source_badge: 'uploaded_asset',
        is_fallback_sample: false,
        source_url_summary: publicMediaUrl,
        input: previewInput,
      },
      input: previewInput,
      all_publish_flags_false: true,
      external_api_calls_performed: false,
      production_actions_performed: false,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
    });
  } catch (error) {
    console.error('[media-composer] direct upload failed', error);
    return buildError(500, 'media_composer_upload_failed', error instanceof Error ? error.message : 'Unknown upload error');
  }
}
