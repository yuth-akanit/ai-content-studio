import { NextRequest, NextResponse } from 'next/server';
import { appendProductVideoPreviewLog, PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS } from '@/lib/product-video-preview-log';
import {
  redactProductVideoFacebookPage,
  resolveProductVideoSelectedFacebookPage,
} from '@/lib/product-video-facebook-page';
import { validateMarketingCaption } from '@/lib/product-video-caption-validator';
import { generateDeterministicAIContent } from '@/lib/product-video-ai-generator';

export const dynamic = 'force-dynamic';

type ProductVideoPlatform = 'facebook_page' | 'facebook' | 'line' | string;
type BrandContext = 'syncflow' | 'paa_air' | 'paa' | string;

interface ProductVideoGenerateRequest {
  brand_context?: BrandContext;
  target_page_key?: string;
  selected_channel_id?: string;
  selected_page_id?: string;
  selected_page_name?: string;
  platform?: ProductVideoPlatform;
  caption?: string;
  marketing_caption?: string;
  preview_note?: string;
  preview_only?: boolean;
  real_posting_enabled?: boolean;
  line_broadcast_enabled?: boolean;
  schedule_enabled?: boolean;
  access_token?: unknown;
  page_access_token?: unknown;

  // New fields
  asset_id?: string;
  uploaded_asset_id?: string;
  public_image_url?: string;
  image_urls?: string[];
  brief?: string;
  selected_pages?: string[];
}

interface ProductVideoPayload {
  brand_context: string;
  target_page_key: string;
  selected_channel_id: string;
  selected_page_id: string;
  selected_page_name: string;
  external_id: string;
  facebook_page_id: string;
  platform: ProductVideoPlatform;
  caption: string;
  marketing_caption: string;
  preview_note: string;
  preview_only: true;
  real_posting_enabled: false;
  line_broadcast_enabled: false;
  schedule_enabled: false;

  // New fields
  asset_id?: string;
  uploaded_asset_id?: string;
  public_image_url?: string;
  image_urls?: string[];
  brief?: string;
  selected_pages?: string; // stringified JSON
  video_title?: string;
  hook?: string;
  scene_script?: string;
  overlay_texts?: string;
  hashtags?: string;
  creative_angle?: string;
  voiceover_style?: string;
  opening_pattern?: string;
  scene_variation_seed?: string;
  voiceover_full?: string;
  voiceover_prompt_requirements?: string;
}

const N8N_FORWARD_TIMEOUT_MS = 15_000;

function isFallbackAppIconUrl(value: string): boolean {
  try {
    return new URL(value).pathname === '/app-icon.png';
  } catch {
    return value.endsWith('/app-icon.png');
  }
}

function isUploadedProductVideoAssetUrl(value: string): boolean {
  try {
    return new URL(value).pathname.startsWith('/api/product-video/assets/');
  } catch {
    return value.includes('/api/product-video/assets/');
  }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function normalizeForSimilarity(value: string): string {
  return value
    .replace(/Scene\s*\d+\s*:/gi, ' ')
    .replace(/ซีน\s*\d+\s*:/gi, ' ')
    .replace(/[\s\n\r\t,.:;!?'"“”‘’()\-[\]{}]+/g, '')
    .toLowerCase();
}

function stripSceneLabels(value: string): string {
  return value
    .replace(/^\s*(Scene|ซีน)\s*\d+\s*[:：-]\s*/gim, '')
    .replace(/\s*(Scene|ซีน)\s*\d+\s*[:：-]\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isNearIdenticalVoiceover(voiceover: string, sceneScript: string): boolean {
  const normalizedVoiceover = normalizeForSimilarity(voiceover);
  const normalizedSceneScript = normalizeForSimilarity(sceneScript);

  if (!normalizedVoiceover || !normalizedSceneScript) return false;
  if (normalizedVoiceover === normalizedSceneScript) return true;

  const shorterLength = Math.min(normalizedVoiceover.length, normalizedSceneScript.length);
  const longerLength = Math.max(normalizedVoiceover.length, normalizedSceneScript.length);
  if (shorterLength / longerLength < 0.72) return false;

  return normalizedVoiceover.includes(normalizedSceneScript.slice(0, shorterLength))
    || normalizedSceneScript.includes(normalizedVoiceover.slice(0, shorterLength));
}

function buildVoiceoverPromptRequirements(input: {
  brand: string;
  creativeAngle: string;
  voiceoverStyle: string;
  openingPattern: string;
  sceneVariationSeed: string;
}): string {
  const productName = input.brand === 'syncflow' ? 'SyncFlow by PAA Tech' : 'PAA Air Service';
  return [
    `Generate a Thai short-form video voiceover for ${productName}.`,
    'Do not copy the scene script word-for-word; use scene_script only as visual context.',
    'Do not include Scene 1 / Scene 2 / Scene 3 labels or Thai scene labels in voiceover_full.',
    'Start with a pain-point hook, explain the solution in simple words, and end with a soft CTA.',
    'Use natural Thai spoken narration for a 20–30 second vertical reel.',
    'Avoid hard-selling, robotic wording, repeated sentence structure, fake claims, pricing, and emojis.',
    `Keep tone aligned with voiceover_style=${input.voiceoverStyle}.`,
    `Use creative_angle=${input.creativeAngle}, opening_pattern=${input.openingPattern}, scene_variation_seed=${input.sceneVariationSeed}.`,
  ].join('\n');
}

function resolveSafeVoiceoverFull(input: {
  candidate: string;
  fallback: string;
  sceneScript: string;
}): string {
  const candidate = stripSceneLabels(clean(input.candidate));
  if (!candidate) return input.fallback;
  if (/Scene\s*\d+\s*[:：-]/i.test(input.candidate) || /ซีน\s*\d+\s*[:：-]/i.test(input.candidate)) {
    return input.fallback;
  }
  if (isNearIdenticalVoiceover(candidate, input.sceneScript)) {
    return input.fallback;
  }
  return candidate;
}

function buildThaiVoiceover(input: {
  brand: string;
  brief: string;
  creativeAngle: string;
  voiceoverStyle: string;
  openingPattern: string;
  seed: number;
}): string {
  const brief = clean(input.brief);
  const isSyncFlow = input.brand === 'syncflow';

  if (isSyncFlow) {
    const hooks = [
      'งานเข้าหลายทาง แต่ทีมยังต้องคอยไล่เช็กเองอยู่หรือเปล่า?',
      'เคยไหม ลูกค้าทักมาแล้วงานหลุด เพราะข้อมูลกระจายอยู่คนละที่?',
      'ถ้าวันหนึ่งมีทั้งแชท โทร และงานหน้างานเข้าพร้อมกัน ทีมจะตามทันไหม?',
      'เจ้าของธุรกิจบริการเสียโอกาสได้ง่ายมาก แค่ตอบช้าหรือคิวตกหล่นหนึ่งงาน',
      'ปัญหาไม่ได้อยู่ที่ทีมไม่ขยัน แต่อยู่ที่งานกระจายจนมองภาพรวมไม่ทัน',
      'พองานเยอะขึ้น การจำด้วยแชทหรือกระดาษอย่างเดียวเริ่มไม่พอแล้ว',
    ];
    const solutions = [
      'SyncFlow by PAA Tech ช่วยรวมงานและสถานะลูกค้าไว้ในที่เดียว ให้ทีมเห็นคิวเดียวกัน',
      'ระบบช่วยให้รับเรื่อง จัดช่าง และติดตามงานได้ชัดขึ้น โดยไม่ต้องสลับหลายหน้าจอ',
      'เจ้าของร้านเห็นภาพรวมงานที่รอทำ งานที่กำลังทำ และงานที่ต้องปิดบิลได้ง่ายขึ้น',
      'จากแชทที่กระจัดกระจาย เปลี่ยนเป็นรายการงานที่ทีมตามต่อได้เป็นขั้นตอน',
      'เหมาะกับธุรกิจบริการที่อยากลดงานหลุด ตอบลูกค้าไวขึ้น และคุมทีมง่ายกว่าเดิม',
      'ทีมแอดมินและช่างทำงานจากข้อมูลชุดเดียวกัน ลูกค้าก็ได้รับคำตอบเร็วขึ้น',
    ];
    const ctas = [
      'ถ้าอยากเห็นว่าระบบเข้ากับงานของคุณไหม ทักมาขอดูตัวอย่างได้เลยครับ',
      'ลองเริ่มจากดูเดโมสั้น ๆ ก่อน แล้วค่อยปรับให้เหมาะกับทีมของคุณได้ครับ',
      'สนใจให้เราช่วยดู flow งานปัจจุบัน ทัก SyncFlow by PAA Tech ได้เลยครับ',
      'ถ้าธุรกิจคุณกำลังโต ลองคุยกันก่อนว่า SyncFlow ช่วยลดจุดไหนได้บ้าง',
      'อยากเริ่มแบบไม่ซับซ้อน ทักมาขอดูตัวอย่างการใช้งานจริงได้ครับ',
      'ทักมาคุยกันเบา ๆ ได้ครับ ว่างานแบบคุณควรเริ่มจัดระบบตรงไหนก่อน',
    ];
    const index = input.seed % hooks.length;
    const context = brief ? ` จากโจทย์นี้ ${brief}` : '';
    return `${hooks[index]} ${solutions[(index + 2) % solutions.length]}${context} ใช้งานแบบเข้าใจง่ายสำหรับเจ้าของธุรกิจ ไม่ใช่ ERP หรือ MES เต็มระบบ แต่ช่วยให้รับงาน จัดทีม และติดตามสถานะเป็นระบบขึ้น ${ctas[(index + 4) % ctas.length]}`;
  }

  const hooks = [
    'แอร์เริ่มไม่เย็น มีกลิ่นอับ หรือมีน้ำหยด อย่าปล่อยให้ปัญหาบานปลาย',
    'ถ้าเปิดแอร์แล้วรู้สึกไม่สดชื่น อาจถึงเวลาตรวจเช็กก่อนเสียหนัก',
    'บ้านหรือร้านที่ใช้แอร์ทุกวัน ฝุ่นสะสมเร็วกว่าที่คิด',
    'ค่าไฟสูงขึ้นแต่แอร์ยังไม่ค่อยเย็น อาการนี้ควรให้ช่างดูหน้างาน',
  ];
  const solutions = [
    'PAA Air Service ช่วยตรวจเช็กและทำความสะอาดตามอาการจริงของเครื่อง',
    'ทีมช่างดูหน้างานให้ชัดก่อน แล้วแนะนำบริการที่เหมาะกับเครื่องของคุณ',
    'การล้างและตรวจระบบอย่างถูกวิธี ช่วยให้แอร์ทำงานดีขึ้นและลดความเสี่ยงเสียซ้ำ',
    'เราเน้นอธิบายง่าย นัดหมายชัด และให้ลูกค้าตัดสินใจก่อนเริ่มงาน',
  ];
  const ctas = [
    'ถ้าอยากเช็กอาการแอร์ ทักมาปรึกษา PAA Air ได้ครับ',
    'ส่งรูปหรืออาการเบื้องต้นมาได้ เดี๋ยวช่วยประเมินขั้นต่อไปให้ครับ',
    'สนใจจองคิวหรือสอบถามรายละเอียด ทักหาเราได้เลยครับ',
    'คุยกับช่างก่อนตัดสินใจได้ครับ ไม่มี hard sell',
  ];
  const index = input.seed % hooks.length;
  const context = brief ? ` จากรายละเอียดที่แจ้งมา ${brief}` : '';
  return `${hooks[index]} ${solutions[(index + 1) % solutions.length]}${context} เหมาะสำหรับคนที่อยากแก้ปัญหาให้ตรงจุดและรู้ขั้นตอนก่อนตัดสินใจ ${ctas[(index + 2) % ctas.length]}`;
}

function buildVariationMetadata(input: {
  brand: string;
  brief: string;
  assetId: string;
  publicImageUrl: string;
  aiContent: ReturnType<typeof generateDeterministicAIContent>;
}): Pick<ProductVideoPayload, 'creative_angle' | 'voiceover_style' | 'opening_pattern' | 'scene_variation_seed' | 'voiceover_full' | 'voiceover_prompt_requirements'> {
  const uniqueSource = `${Date.now()}|${Math.random()}|${crypto.randomUUID?.() || ''}`;
  const seedSource = [
    input.brand,
    input.brief,
    input.assetId,
    input.publicImageUrl,
    input.aiContent.hook,
    input.aiContent.scene_script,
    uniqueSource,
  ].filter(Boolean).join('|');
  const seed = hashString(seedSource || JSON.stringify(input.aiContent));
  const syncflowAngles = [
    'pain_first',
    'owner_dashboard',
    'customer_reply_speed',
    'job_tracking',
    'reduce_lost_jobs',
    'before_after',
    'service_business_case',
    'demo_invite',
  ];
  const paaAirAngles = [
    'symptom_first',
    'homeowner_warning',
    'technician_inspection',
    'cost_prevention',
    'before_after_cleaning',
    'repair_case',
    'seasonal_check',
    'booking_cta',
  ];
  const voiceoverStyles = [
    'เจ้าของธุรกิจเล่าเองแบบกระชับ',
    'ที่ปรึกษาชี้ปัญหาและทางออก',
    'เล่าเป็นเคสหน้างานจริง',
    'เปรียบเทียบก่อนและหลัง',
    'คำถามเปิดให้คนดูคิดตาม',
    'สรุปขั้นตอนแบบมืออาชีพ',
  ];
  const openingPatterns = [
    'เริ่มจาก pain-point hook',
    'เปิดด้วยคำถามเฉพาะจาก brief',
    'เปิดด้วยสถานการณ์หนึ่งวันทำงาน',
    'เปิดด้วยผลเสียถ้าปล่อยไว้นาน',
    'เปิดด้วยมุมมองเจ้าของกิจการหรือลูกค้าหน้างาน',
    'เปิดด้วย before-after โดยไม่ใช้ประโยคเดิม',
  ];
  const angles = input.brand === 'syncflow' ? syncflowAngles : paaAirAngles;
  const creativeAngle = angles[seed % angles.length];
  const voiceoverStyle = voiceoverStyles[Math.floor(seed / angles.length) % voiceoverStyles.length];
  const openingPattern = openingPatterns[Math.floor(seed / (angles.length * voiceoverStyles.length)) % openingPatterns.length];
  const generatedVoiceover = stripSceneLabels(buildThaiVoiceover({
    brand: input.brand,
    brief: input.brief,
    creativeAngle,
    voiceoverStyle,
    openingPattern,
    seed,
  }));
  const fallbackVoiceover = input.brand === 'syncflow'
    ? 'งานเข้าหลายช่องทางแล้วทีมเริ่มตามไม่ทันใช่ไหมครับ SyncFlow by PAA Tech ช่วยรวมงาน จัดคิว และติดตามสถานะให้เห็นชัดในที่เดียว ใช้งานง่ายสำหรับเจ้าของธุรกิจบริการ ไม่ใช่ระบบใหญ่ที่ซับซ้อน ถ้าอยากดูว่าเหมาะกับทีมคุณไหม ทักมาขอดูตัวอย่างได้ครับ'
    : 'แอร์มีอาการผิดปกติแล้วไม่แน่ใจควรเริ่มตรงไหน ให้ PAA Air ช่วยตรวจเช็กและอธิบายทางเลือกแบบเข้าใจง่ายก่อนตัดสินใจครับ';
  const voiceoverFull = isNearIdenticalVoiceover(generatedVoiceover, input.aiContent.scene_script)
    ? fallbackVoiceover
    : generatedVoiceover;

  const sceneVariationSeed = `studio-${seed}-${Date.now()}`;

  return {
    creative_angle: creativeAngle,
    voiceover_style: voiceoverStyle,
    opening_pattern: openingPattern,
    scene_variation_seed: sceneVariationSeed,
    voiceover_full: voiceoverFull,
    voiceover_prompt_requirements: buildVoiceoverPromptRequirements({
      brand: input.brand,
      creativeAngle,
      voiceoverStyle,
      openingPattern,
      sceneVariationSeed,
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function pickNestedString(data: Record<string, unknown>, path: string[]): string {
  let current: unknown = data;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record) return '';
    current = record[segment];
  }
  return clean(current);
}

function pickN8nString(data: Record<string, unknown>, key: string): string {
  const containers: Record<string, unknown>[] = [data];
  const containerKeys = ['payload', 'result', 'preview', 'body', 'ai_generated_copy', 'script', 'metadata', 'n8n_response'];

  for (const containerKey of containerKeys) {
    const container = asRecord(data[containerKey]);
    if (container) containers.push(container);
  }

  for (const container of containers) {
    const value = clean(container[key]);
    if (value) return value;
  }

  if (key === 'voiceover_full') {
    for (const container of containers) {
      const value = pickNestedString(container, ['voiceover', 'full']);
      if (value) return value;
    }
  }

  return '';
}

async function buildPayload(body: ProductVideoGenerateRequest): Promise<ProductVideoPayload> {
  const selectedPagesList = Array.isArray(body.selected_pages) ? body.selected_pages : [];
  const selectedPageSelector =
    clean(body.selected_channel_id) ||
    clean(body.selected_page_id) ||
    (selectedPagesList.length > 0 ? clean(selectedPagesList[0]) : '');

  if (!selectedPageSelector) {
    throw Object.assign(new Error('selected_social_page_required'), {
      code: 'selected_social_page_required',
      status: 400,
    });
  }

  const selectedPage = await resolveProductVideoSelectedFacebookPage(selectedPageSelector);

  const brand = clean(body.brand_context) || 'paa_air';
  const brief = clean(body.brief);
  const aiContent = generateDeterministicAIContent(brand, brief);

  const marketingCaption = clean(body.marketing_caption || body.caption) || aiContent.marketing_caption;
  const previewNote = clean(body.preview_note) || aiContent.preview_note;
  const publicImageUrl = clean(body.public_image_url);
  const assetId = clean(body.asset_id || body.uploaded_asset_id);
  if (!assetId || !publicImageUrl || isFallbackAppIconUrl(publicImageUrl) || !isUploadedProductVideoAssetUrl(publicImageUrl)) {
    throw Object.assign(new Error('real_uploaded_product_video_asset_required'), {
      code: 'real_uploaded_product_video_asset_required',
      status: 400,
    });
  }
  const variationMetadata = buildVariationMetadata({
    brand,
    brief,
    assetId,
    publicImageUrl,
    aiContent,
  });
  const imageUrls = Array.isArray(body.image_urls)
    ? body.image_urls.map(clean).filter(Boolean)
    : [];
  const normalizedImageUrls = publicImageUrl
    ? Array.from(new Set([publicImageUrl, ...imageUrls]))
    : imageUrls;

  // Resolve all selected pages details
  const resolvedPagesInfo = [];
  for (const pageSel of selectedPagesList) {
    try {
      const pageInfo = await resolveProductVideoSelectedFacebookPage(clean(pageSel));
      resolvedPagesInfo.push({
        page_id: pageInfo.selected_page_id,
        page_name: pageInfo.selected_page_name,
        target_page_key: clean(body.target_page_key) || 'paa_air',
        facebook_page_id: pageInfo.facebook_page_id,
        status: 'pending_authorization',
        publish_plan_checksum: null,
        idempotency_key: null,
        facebook_post_id: null,
        error: null,
      });
    } catch (e) {
      console.warn(`[product-video] could not resolve page detail for ${pageSel}`, e);
    }
  }

  return {
    brand_context: brand,
    target_page_key: clean(body.target_page_key) || 'paa_air',
    selected_channel_id: selectedPage.selected_channel_id,
    selected_page_id: selectedPage.selected_page_id,
    selected_page_name: selectedPage.selected_page_name,
    external_id: selectedPage.external_id,
    facebook_page_id: selectedPage.facebook_page_id,
    platform: 'facebook_page',
    caption: marketingCaption,
    marketing_caption: marketingCaption,
    preview_note: previewNote,
    preview_only: true,
    real_posting_enabled: false,
    line_broadcast_enabled: false,
    schedule_enabled: false,

    // New fields
    asset_id: assetId,
    uploaded_asset_id: assetId,
    public_image_url: publicImageUrl || normalizedImageUrls[0] || '',
    image_urls: normalizedImageUrls,
    brief: brief,
    selected_pages: resolvedPagesInfo.length > 0 ? JSON.stringify(resolvedPagesInfo) : undefined,
    video_title: aiContent.video_title,
    hook: aiContent.hook,
    scene_script: aiContent.scene_script,
    overlay_texts: aiContent.overlay_texts,
    hashtags: aiContent.hashtags,
    ...variationMetadata,
  };
}

function validatePayload(payload: ProductVideoPayload): string[] {
  const errors: string[] = [];

  if (!payload.brand_context) errors.push('brand_context_required');
  if (!payload.target_page_key) errors.push('target_page_key_required');
  if (!payload.selected_channel_id) errors.push('selected_channel_id_required');
  if (!payload.selected_page_id) errors.push('selected_page_id_required');
  if (!payload.selected_page_name) errors.push('selected_page_name_required');
  if (!payload.external_id) errors.push('external_id_required');
  if (!payload.facebook_page_id) errors.push('facebook_page_id_required');
  if (!payload.platform) errors.push('platform_required');

  if (payload.brand_context === 'syncflow' && payload.target_page_key !== 'syncflow') {
    errors.push('syncflow_requires_target_page_key_syncflow');
  }

  if ((payload.brand_context === 'paa' || payload.brand_context === 'paa_air') && payload.target_page_key !== 'paa_air') {
    errors.push('paa_requires_target_page_key_paa_air');
  }

  const captionErrors = validateMarketingCaption(payload.marketing_caption, payload.brand_context);
  errors.push(...captionErrors);

  return errors;
}

function buildN8nForwardPayload(payload: ProductVideoPayload): ProductVideoPayload {
  return payload;
}

async function forwardToN8n(payload: ProductVideoPayload) {
  const webhookUrl = process.env.PRODUCT_VIDEO_N8N_WEBHOOK_URL;
  const forwardEnabled = process.env.PRODUCT_VIDEO_N8N_FORWARD_ENABLED === 'true';

  if (!webhookUrl || !forwardEnabled) {
    return {
      forwarded: false,
      reason: 'n8n_forward_disabled',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_FORWARD_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildN8nForwardPayload(payload)),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const renderJobId = pickN8nString(data, 'render_job_id') || pickN8nString(data, 'job_id');
    const publicMediaUrl = pickN8nString(data, 'public_media_url');
    const thumbnailUrl = pickN8nString(data, 'thumbnail_url');
    const renderStatus = pickN8nString(data, 'render_status') || pickN8nString(data, 'status');
    const rendererCalled = data.renderer_called === true;
    const creativeFields = {
      creative_angle: pickN8nString(data, 'creative_angle'),
      voiceover_style: pickN8nString(data, 'voiceover_style'),
      opening_pattern: pickN8nString(data, 'opening_pattern'),
      scene_variation_seed: pickN8nString(data, 'scene_variation_seed'),
      voiceover_full: pickN8nString(data, 'voiceover_full'),
    };

    return {
      forwarded: true,
      ok: response.ok,
      status: response.status,
      response_body_exposed: false,
      render_job_id: renderJobId,
      render_status: renderStatus,
      public_media_url: publicMediaUrl,
      thumbnail_url: thumbnailUrl,
      media_type: typeof data.media_type === 'string' ? data.media_type.trim() : '',
      media_status: typeof data.media_status === 'string' ? data.media_status.trim() : '',
      renderer_called: rendererCalled,
      ...creativeFields,
    };
  } catch {
    return {
      forwarded: false,
      ok: false,
      reason: 'n8n_forward_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const supabase_diagnostics = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_SERVICE_KEY: Boolean(process.env.SUPABASE_SERVICE_KEY),
    SUPABASE_SERVICE_ROLE: Boolean(process.env.SUPABASE_SERVICE_ROLE),
  };

  try {
    const body = await request.json() as ProductVideoGenerateRequest;
    if (body.access_token || body.page_access_token) {
      return NextResponse.json(
        {
          ok: false,
          error: 'request_body_token_rejected',
          supabase_diagnostics,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS
        },
        { status: 400 },
      );
    }

    const payload = await buildPayload(body);
    const validationErrors = validatePayload(payload);

    const guard = {
      preview_only: payload.preview_only,
      real_posting_enabled: payload.real_posting_enabled,
      line_broadcast_enabled: payload.line_broadcast_enabled,
      schedule_enabled: payload.schedule_enabled,
      n8n_called_from_client: false,
      validation_errors: validationErrors,
    };

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_product_video_request',
          message: 'Invalid product video request',
          validation_errors: validationErrors,
          supabase_diagnostics,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
          guard,
          payload,
        },
        { status: 400 },
      );
    }

    const n8n = await forwardToN8n(payload);
    const n8nStatus = ('status' in n8n && typeof n8n.status === 'number') ? n8n.status : null;
    const responseBodyExposed = 'response_body_exposed' in n8n ? n8n.response_body_exposed : false;
    const previewSafetyLocked =
      payload.preview_only === true &&
      payload.real_posting_enabled === false &&
      payload.line_broadcast_enabled === false &&
      payload.schedule_enabled === false &&
      responseBodyExposed === false;
    const n8nPublicMediaUrl = ('public_media_url' in n8n && typeof n8n.public_media_url === 'string') ? n8n.public_media_url : '';
    const n8nThumbnailUrl = ('thumbnail_url' in n8n && typeof n8n.thumbnail_url === 'string') ? n8n.thumbnail_url : '';
    const n8nRenderJobId = ('render_job_id' in n8n && typeof n8n.render_job_id === 'string') ? n8n.render_job_id : '';
    const n8nRenderStatus = ('render_status' in n8n && typeof n8n.render_status === 'string') ? n8n.render_status : '';
    const n8nMediaType = ('media_type' in n8n && typeof n8n.media_type === 'string') ? n8n.media_type : '';
    const n8nMediaStatus = ('media_status' in n8n && typeof n8n.media_status === 'string') ? n8n.media_status : '';
    const n8nCreativeAngle = ('creative_angle' in n8n && typeof n8n.creative_angle === 'string') ? n8n.creative_angle : '';
    const n8nVoiceoverStyle = ('voiceover_style' in n8n && typeof n8n.voiceover_style === 'string') ? n8n.voiceover_style : '';
    const n8nOpeningPattern = ('opening_pattern' in n8n && typeof n8n.opening_pattern === 'string') ? n8n.opening_pattern : '';
    const n8nSceneVariationSeed = ('scene_variation_seed' in n8n && typeof n8n.scene_variation_seed === 'string') ? n8n.scene_variation_seed : '';
    const n8nVoiceoverFull = ('voiceover_full' in n8n && typeof n8n.voiceover_full === 'string') ? n8n.voiceover_full : '';
    const n8nRendererCalled = 'renderer_called' in n8n && n8n.renderer_called === true;
    const n8nRendered = n8n.forwarded && n8nStatus === 200 && n8nPublicMediaUrl.length > 0;
    const safeVoiceoverFull = resolveSafeVoiceoverFull({
      candidate: n8nVoiceoverFull,
      fallback: payload.voiceover_full || '',
      sceneScript: payload.scene_script || '',
    });

    if (!n8n.forwarded || n8nStatus !== 200 || !previewSafetyLocked) {
      return NextResponse.json(
        {
          ok: false,
          error: 'product_video_preview_not_queued',
          message: 'Product Video preview was not queued because n8n did not return HTTP 200.',
          n8n_forwarded: n8n.forwarded,
          n8n_status: n8nStatus,
          response_body_exposed: responseBodyExposed,
          preview_log_created: false,
          preview_log: null,
          preview_only: guard.preview_only,
          real_posting_enabled: guard.real_posting_enabled,
          line_broadcast_enabled: guard.line_broadcast_enabled,
          supabase_diagnostics,
          guard,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 502 },
      );
    }

    const shouldCreateLog = n8n.forwarded && n8nStatus === 200 && previewSafetyLocked;

    const previewLog = shouldCreateLog
      ? await appendProductVideoPreviewLog({
        brand_context: payload.brand_context,
        target_page_key: payload.target_page_key,
        selected_channel_id: payload.selected_channel_id,
        selected_page_id: payload.selected_page_id,
        selected_page_name: payload.selected_page_name,
        external_id: payload.external_id,
        facebook_page_id: payload.facebook_page_id,
        platform: payload.platform,
        caption: payload.caption,
        marketing_caption: payload.marketing_caption,
        preview_note: payload.preview_note,
        n8n_forwarded: n8n.forwarded,
        n8n_status: n8nStatus,
        response_body_exposed: false,

        // New fields
        asset_id: payload.asset_id,
        uploaded_asset_id: payload.uploaded_asset_id,
        public_image_url: payload.public_image_url,
        image_urls: payload.image_urls,
        brief: payload.brief,
        selected_pages: payload.selected_pages,
        video_title: payload.video_title,
        hook: payload.hook,
        scene_script: payload.scene_script,
        overlay_texts: payload.overlay_texts,
        hashtags: payload.hashtags,
        creative_angle: n8nCreativeAngle || payload.creative_angle,
        voiceover_style: n8nVoiceoverStyle || payload.voiceover_style,
        opening_pattern: n8nOpeningPattern || payload.opening_pattern,
        scene_variation_seed: n8nSceneVariationSeed || payload.scene_variation_seed,
        voiceover_full: safeVoiceoverFull,
        status: n8nRendered ? 'rendered' : 'pending_owner_review',
        render_status: n8nRendered ? 'rendered' : (n8nRenderStatus || undefined),
        media_status: n8nRendered ? 'ready' : (n8nMediaStatus || undefined),
        public_media_url: n8nPublicMediaUrl || undefined,
        thumbnail_url: n8nThumbnailUrl || undefined,
        render_job_id: n8nRenderJobId || undefined,
        media_type: n8nRendered ? (n8nMediaType || 'video') : (n8nMediaType || undefined),
        renderer_called: n8nRendererCalled || n8nRendered,
        error: null,
      })
      : null;

    return NextResponse.json({
      ok: true,
      status: n8n.forwarded ? 'forwarded_to_server_side_wrapper_target' : 'preview_payload_ready',
      n8n_forwarded: n8n.forwarded,
      n8n_status: n8nStatus,
      response_body_exposed: responseBodyExposed,
      preview_only: guard.preview_only,
      real_posting_enabled: guard.real_posting_enabled,
      line_broadcast_enabled: guard.line_broadcast_enabled,
      schedule_enabled: guard.schedule_enabled,
      preview_log_created: Boolean(previewLog),
      preview_log: previewLog,
      selected_facebook_page: redactProductVideoFacebookPage({
        selected_channel_id: payload.selected_channel_id,
        selected_page_id: payload.selected_page_id,
        selected_page_name: payload.selected_page_name,
        external_id: payload.external_id,
        facebook_page_id: payload.facebook_page_id,
        provider: 'facebook',
        status: 'active',
        page_access_token: 'redacted-present',
      }),
      supabase_diagnostics,
      guard,
      payload,
      n8n,
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'failed_to_prepare_product_video_request';

    if (status >= 500) {
      console.error('[product-video] generate wrapper failed', error);
    }
    return NextResponse.json(
      {
        ok: false,
        error: code,
        message: error instanceof Error ? error.message : String(error),
        supabase_diagnostics,
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status },
    );
  }
}
