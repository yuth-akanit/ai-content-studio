export const SYSTEM_NOTE_PATTERNS = [
  'preview เท่านั้น',
  'ยังไม่โพสต์จริง',
  'ยังไม่เปิด schedule',
  'real_posting_enabled=false',
  'publish_allowed=false',
  'schedule_enabled=false',
];

export function hasSystemNote(caption: string): boolean {
  if (!caption) return false;
  return SYSTEM_NOTE_PATTERNS.some((pattern) => caption.includes(pattern));
}

export function validateMarketingCaption(caption: string, brandContext: string): string[] {
  const errors: string[] = [];
  const cleanCaption = (caption || '').trim();

  if (!cleanCaption) {
    errors.push('caption_empty');
    return errors;
  }

  if (hasSystemNote(cleanCaption)) {
    errors.push('system_note_detected_in_caption');
  }

  if (cleanCaption.length < 100) {
    errors.push('caption_too_short');
  }

  // Must contain hashtags
  if (!cleanCaption.includes('#')) {
    errors.push('caption_missing_hashtags');
  }

  const lowerCaption = cleanCaption.toLowerCase();

  const ctaKeywords = ['ทัก', 'ติดต่อ', 'สนใจ', 'โทร', 'line', 'ไลน์', 'inbox', 'จอง', 'facebook', 'เบอร์'];
  const hasCta = ctaKeywords.some((kw) => lowerCaption.includes(kw));
  if (!hasCta) {
    errors.push('caption_missing_cta');
  }

  if (brandContext === 'syncflow') {
    // SyncFlow brand context check
    const syncflowKeywords = ['syncflow', 'ระบบ', 'งาน', 'ลูกค้า', 'แอดมิน', 'ตอบ'];
    const hasRelevance = syncflowKeywords.some((kw) => lowerCaption.includes(kw));
    if (!hasRelevance) {
      errors.push('syncflow_caption_missing_brand_context');
    }
  } else if (brandContext === 'paa' || brandContext === 'paa_air') {
    // PAA Air brand context check
    const serviceAreaKeywords = ['พื้นที่', 'กรุงเทพ', 'ปริมณฑล', 'เขต', 'กทม', 'บริการ', 'จังหวัด', 'อำเภอ'];
    const hasServiceArea = serviceAreaKeywords.some((kw) => lowerCaption.includes(kw));
    if (!hasServiceArea) {
      errors.push('paa_caption_missing_service_area');
    }

    const paaKeywords = ['paa', 'แอร์', 'ล้าง', 'บริการ', 'ช่าง'];
    const hasRelevance = paaKeywords.some((kw) => lowerCaption.includes(kw));
    if (!hasRelevance) {
      errors.push('paa_caption_missing_brand_context');
    }
  }

  return errors;
}
