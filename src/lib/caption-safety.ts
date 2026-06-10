export const INTERNAL_CAPTION_TERMS = [
  'master video',
  'TTS',
  'แปลงไฟล์ต้นทาง',
  'ตรวจทานก่อนกระจายคลิป',
  'quality gate',
  'provider',
  'API Publish',
  'generated asset',
] as const;

const INTERNAL_REWRITE_RULES: Array<[RegExp, string]> = [
  [/master video/gi, 'วิดีโอพร้อมโพสต์'],
  [/\bTTS\b/g, 'เสียงบรรยาย'],
  [/แปลงไฟล์ต้นทาง/g, 'ปรับคลิปให้พร้อมใช้งาน'],
  [/ตรวจทานก่อนกระจายคลิป/g, 'ตรวจข้อความก่อนโพสต์'],
  [/quality gate/gi, 'การตรวจคุณภาพ'],
  [/provider/gi, 'ช่องทาง'],
  [/API Publish/gi, 'โพสต์ผ่านระบบ'],
  [/generated asset/gi, 'ไฟล์วิดีโอ'],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteInternalCaptionWording(text: string): string {
  let rewritten = String(text || '');
  for (const [pattern, replacement] of INTERNAL_REWRITE_RULES) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  return rewritten.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function findInternalCaptionTerms(text: string): string[] {
  const source = String(text || '');
  return INTERNAL_CAPTION_TERMS.filter((term) => new RegExp(escapeRegExp(term), term === 'TTS' ? 'g' : 'i').test(source));
}

export function assertCustomerSafeCaption(text: string): void {
  const leakedTerms = findInternalCaptionTerms(text);
  if (leakedTerms.length > 0) {
    throw new Error(`Caption contains internal production wording: ${leakedTerms.join(', ')}`);
  }
}

export function sanitizeContentOutputForCustomers<T>(value: T): T {
  if (typeof value === 'string') {
    return rewriteInternalCaptionWording(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContentOutputForCustomers(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeContentOutputForCustomers(item)]),
    ) as T;
  }
  return value;
}
