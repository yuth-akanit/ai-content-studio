const DEFAULT_IMAGE_BUCKET = 'content-images';

export interface UploadAssetResult {
  publicUrl: string;
}

export function getImageBucketName(): string {
  return process.env.SUPABASE_CONTENT_IMAGE_BUCKET || DEFAULT_IMAGE_BUCKET;
}

export function getVideoBucketName(): string {
  return process.env.SUPABASE_CONTENT_VIDEO_BUCKET || getImageBucketName();
}

export async function uploadDataUrlToStorage(
  supabase: any,
  dataUrl: string,
  bucket: string,
  filenamePrefix: string,
): Promise<UploadAssetResult> {
  const matches = dataUrl.match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid data URL format');
  }

  const contentType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const ext = contentType.split('/')[1] || 'bin';
  const filename = `${filenamePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return {
    publicUrl: publicData.publicUrl,
  };
}

export async function normalizeImageUrls(
  supabase: any,
  imageUrls?: string[],
): Promise<string[] | undefined> {
  if (!imageUrls?.length) return imageUrls;

  return Promise.all(imageUrls.map(async (url) => {
    if (!url.startsWith('data:')) return url;
    const upload = await uploadDataUrlToStorage(
      supabase,
      url,
      getImageBucketName(),
      'content_image',
    );
    return upload.publicUrl;
  }));
}

export async function normalizeVideoUrl(
  supabase: any,
  videoUrl?: string,
): Promise<string | undefined> {
  if (!videoUrl) return videoUrl;
  if (!videoUrl.startsWith('data:')) return videoUrl;

  const upload = await uploadDataUrlToStorage(
    supabase,
    videoUrl,
    getVideoBucketName(),
    'content_video',
  );

  return upload.publicUrl;
}
