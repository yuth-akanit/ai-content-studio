export interface ProductVideoTtsVoiceSettings {
  language: 'th-TH';
  speaking_rate: number;
  tone: 'neutral_warm';
  voice_hint: 'thai_conversational';
  natural_pauses: true;
}

export const PRODUCT_VIDEO_TTS_VOICE_SETTINGS: ProductVideoTtsVoiceSettings = {
  language: 'th-TH',
  speaking_rate: 0.95,
  tone: 'neutral_warm',
  voice_hint: 'thai_conversational',
  natural_pauses: true,
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function removeForbiddenTtsContent(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/(?:\+?66|0)\d[\d\s().-]{7,}\d/g, ' ')
    .replace(/^\s*#\S+.*$/gim, ' ')
    .replace(/^\s*(?:LINE OA|LINE|Website|เว็บไซต์|Phone|โทร|อีเมล|Email)\s*:?.*$/gim, ' ')
    .replace(/^\s*(?:SyncFlow by PAA Tech|PAA Air Service)\s*$/gim, ' ')
    .replace(/^\s*(?:Scene|ซีน)\s*\d+\s*[:：-]\s*/gim, '')
    .replace(/\s*(?:Scene|ซีน)\s*\d+\s*[:：-]\s*/gi, ' ')
    .replace(/[“”"'`]+/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLongPhrase(phrase: string): string[] {
  const cleanPhrase = phrase.trim();
  if (!cleanPhrase) return [];
  if (cleanPhrase.length <= 48) return [cleanPhrase];

  const softParts = cleanPhrase
    .split(/\s*(?:,|，|、|และ|แล้ว|โดย|ตั้งแต่|ไปจนถึง|เพราะ|แต่)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (softParts.length > 1 && softParts.every((part) => part.length <= 56)) {
    return softParts;
  }

  const words = cleanPhrase.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 48 && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function toSpokenLines(value: string): string[] {
  const cleaned = removeForbiddenTtsContent(value);
  const baseParts = cleaned
    .split(/(?:\n+|[.!?。！？]+|\s+\/\s+)/g)
    .flatMap((part) => part.split(/\s{2,}/g))
    .map((part) => part.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const part of baseParts) {
    lines.push(...splitLongPhrase(part));
  }
  return lines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^#/.test(line))
    .slice(0, 12);
}

function formatWithNaturalPauses(lines: string[]): string {
  const compact = lines.filter(Boolean);
  if (compact.length === 0) return '';

  const groups: string[] = [];
  const first = compact.slice(0, 2);
  const middle = compact.slice(2, Math.max(2, compact.length - 2));
  const last = compact.slice(Math.max(2, compact.length - 2));

  if (first.length) groups.push(first.map((line, index) => (index === 0 && !line.endsWith('...') ? `${line}...` : line)).join('\n'));
  if (middle.length) groups.push(middle.join('\n'));
  if (last.length) groups.push(last.join('\n'));

  return groups.join('\n\n').trim();
}

function softCtaForBrand(brandContext: string): string {
  const brand = cleanText(brandContext).toLowerCase();
  if (brand.includes('syncflow')) {
    return 'ถ้าอยากดูตัวอย่าง ทักมาคุยกันได้ครับ';
  }
  return 'ถ้าอยากให้ช่างช่วยดูเบื้องต้น ทักมาปรึกษาได้ครับ';
}

function endsWithSoftCta(value: string): boolean {
  const lastLine = value.split('\n').map((line) => line.trim()).filter(Boolean).at(-1) || '';
  return /(?:ทัก|คุย|ปรึกษา|ดูตัวอย่าง|เริ่มต้น|ลองดู)/.test(lastLine);
}

function ensureSoftCtaEnding(value: string, brandContext: string): string {
  const cleaned = removeForbiddenTtsContent(value);
  if (!cleaned) return cleaned;
  if (endsWithSoftCta(cleaned)) return cleaned;
  return `${cleaned}\n\n${softCtaForBrand(brandContext)}`.trim();
}

function fallbackSyncFlowTts(brief: string): string {
  const context = cleanText(brief).replace(/\s+/g, ' ');
  return formatWithNaturalPauses([
    'ลูกค้าทักมาหลายช่องทาง',
    'แอดมินตอบไม่ทัน งานก็หลุดง่าย',
    'SyncFlow ช่วยรวมแชท คิวงาน และสถานะไว้ในที่เดียว',
    'ทีมเห็นงานตรงกัน ตั้งแต่รับเรื่อง จนปิดงาน',
    context ? `ถ้าโจทย์ของคุณคือ ${context}` : '',
    'ลองเริ่มจากจัด flow งานให้ชัดก่อน',
    'ถ้าอยากดูตัวอย่าง ทักมาคุยกันได้ครับ',
  ]);
}

function fallbackPaaAirTts(brief: string): string {
  const context = cleanText(brief).replace(/\s+/g, ' ');
  return formatWithNaturalPauses([
    'แอร์เริ่มไม่เย็น หรือมีกลิ่นอับใช่ไหมครับ',
    'อาการเล็ก ๆ ถ้าปล่อยไว้นาน อาจเสียหนักกว่าเดิม',
    'PAA Air ช่วยตรวจเช็ก และแนะนำตามอาการจริง',
    'ให้รู้ขั้นตอนก่อนตัดสินใจซ่อมหรือล้าง',
    context ? `จากอาการที่แจ้งมา ${context}` : '',
    'ถ้าอยากให้ช่างช่วยดูเบื้องต้น',
    'ทักมาปรึกษาได้ครับ',
  ]);
}

export function hasForbiddenTtsContent(value: string): boolean {
  return /https?:\/\//i.test(value)
    || /www\./i.test(value)
    || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
    || /(?:\+?66|0)\d[\d\s().-]{7,}\d/.test(value)
    || /^\s*#/m.test(value)
    || /(?:Scene|ซีน)\s*\d+\s*[:：-]/i.test(value);
}

export function normalizeProductVideoTtsScript(input: {
  candidate?: unknown;
  voiceoverFull?: unknown;
  caption?: unknown;
  sceneScript?: unknown;
  brandContext?: unknown;
  brief?: unknown;
}): string {
  const brand = cleanText(input.brandContext).toLowerCase();
  const fallback = brand.includes('syncflow') ? fallbackSyncFlowTts(cleanText(input.brief)) : fallbackPaaAirTts(cleanText(input.brief));
  const source = cleanText(input.candidate) || cleanText(input.voiceoverFull) || cleanText(input.sceneScript) || cleanText(input.caption);
  const lines = toSpokenLines(source);
  const formatted = formatWithNaturalPauses(lines);

  if (!formatted || formatted.length < 40 || hasForbiddenTtsContent(formatted)) {
    return ensureSoftCtaEnding(fallback, brand);
  }

  return ensureSoftCtaEnding(formatted, brand);
}
