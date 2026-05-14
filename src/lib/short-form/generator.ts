import {
  ShortFormContentOutput,
  ShortFormFormat,
  ShortFormPlatformTarget,
} from '@/types/database';

interface GenerateShortFormItemsInput {
  platform_targets: ShortFormPlatformTarget[];
  primary_platform: ShortFormPlatformTarget;
  service_type: string;
  target_area: string;
  content_angle: string;
  format: ShortFormFormat;
  cta_text: string;
  count: number;
}

const formatLabels: Record<ShortFormFormat, string> = {
  '15s_short': '15 วินาที',
  '30s_short': '30 วินาที',
  '45s_educational_short': '45 วินาทีเชิงความรู้',
  before_after_service_clip: 'ก่อน/หลังงานบริการ',
  problem_solution_clip: 'ปัญหา-วิธีแก้',
  technician_advice_clip: 'คำแนะนำจากช่าง',
  customer_faq_clip: 'ตอบคำถามลูกค้า',
  promo_offer_clip: 'โปรโมชัน/ข้อเสนอ',
  myth_busting_clip: 'แก้ความเข้าใจผิด',
  checklist_clip: 'เช็กลิสต์',
};

const hooks = [
  'แอร์มีน้ำหยด อย่าเพิ่งสรุปว่าต้องเติมน้ำยา',
  'เปิดแอร์แล้วไม่เย็น ลองเช็ก 3 จุดนี้ก่อนเรียกช่าง',
  'ล้างแอร์ไม่ใช่แค่ฉีดน้ำผ่าน ๆ จุดนี้คนมักพลาด',
  'กลิ่นอับจากแอร์อาจไม่ได้มาจากห้องเสมอไป',
  'ค่าไฟขึ้นผิดปกติ แอร์อาจกำลังทำงานหนักเกินจำเป็น',
  'ก่อนย้ายแอร์ ควรถามช่างเรื่องนี้ก่อน',
  'ตู้แช่ไม่เย็น อย่าเพิ่งปรับอุณหภูมิลงอย่างเดียว',
  'แอร์เก่าไม่จำเป็นต้องเปลี่ยนทุกเคส ต้องตรวจอาการก่อน',
  'เสียงดังจากคอยล์เย็น บางครั้งเริ่มจากจุดเล็ก ๆ',
  'ก่อนหน้าร้อน ควรเตรียมแอร์แบบนี้',
];

function hashtagsFor(target: ShortFormPlatformTarget, serviceType: string, targetArea: string): string[] {
  const areaTag = targetArea.split(/[,\s/]+/).filter(Boolean)[0] || 'สมุทรปราการ';
  const base = ['#ล้างแอร์', '#ช่างแอร์', `#${areaTag}`, '#PAAAirService'];

  if (serviceType.includes('repair') || serviceType.includes('ซ่อม')) {
    base[0] = '#ซ่อมแอร์';
  }

  if (target === 'youtube_shorts') return ['#Shorts', ...base.slice(0, 3)];
  if (target === 'tiktok') return [...base, '#แอร์ไม่เย็น'];
  return [...base, '#บริการแอร์'];
}

export function generateShortFormItems(input: GenerateShortFormItemsInput): ShortFormContentOutput[] {
  return Array.from({ length: input.count }, (_, index) => {
    const hook = hooks[index % hooks.length];
    const angle = input.content_angle;
    const formatLabel = formatLabels[input.format];
    const service = input.service_type.replace(/_/g, ' ');
    const targetArea = input.target_area;
    const cta = input.cta_text || 'ทัก LINE @paairservice เพื่อประเมินอาการ/เช็กคิว';
    const sequence = index + 1;

    const script = [
      `0-3s: ${hook}`,
      `3-10s: เปิดให้เห็นอาการจริงของลูกค้า เช่น ${angle} ในพื้นที่ ${targetArea}`,
      `10-22s: ช่างอธิบายแบบตรงไปตรงมาว่าต้องตรวจหน้างานก่อน ไม่ฟันธงราคา/น้ำยาโดยยังไม่เห็นอาการ`,
      `22-ท้ายคลิป: สรุปขั้นตอนที่ PAA Air Service แนะนำสำหรับงาน ${service} และปิดด้วย CTA`,
    ].join('\n');

    const captionCore = `${hook}\n\nเคส ${service} ในพื้นที่ ${targetArea} ควรตรวจอาการจริงก่อนสรุปวิธีแก้ โดยเฉพาะเรื่องน้ำยา ราคา และอะไหล่\n\n${cta}`;

    return {
      platform_targets: input.platform_targets,
      primary_platform: input.primary_platform,
      format: input.format,
      hook,
      script,
      shot_list: [
        'เปิดคลิปด้วยภาพอาการจริงหรือภาพหน้างาน',
        'ถ่ายช่างชี้จุดที่ต้องตรวจแบบใกล้และชัด',
        'แทรกข้อความสั้น 1 ประเด็นต่อจอ',
        'ปิดด้วยภาพทีม/อุปกรณ์/ช่องทาง LINE โดยไม่อ้างผลเกินจริง',
      ],
      caption_tiktok: `${captionCore}\n\n${hashtagsFor('tiktok', service, targetArea).join(' ')}`,
      caption_youtube_shorts: `${hook} | ${service} ${targetArea}\n\n${captionCore}\n\n${hashtagsFor('youtube_shorts', service, targetArea).join(' ')}`,
      caption_instagram_reels: `${captionCore}\n\n${hashtagsFor('instagram_reels', service, targetArea).join(' ')}`,
      caption_facebook_reels: `${captionCore}\n\nพื้นที่บริการ: ${targetArea}\n${hashtagsFor('facebook_reels', service, targetArea).join(' ')}`,
      hashtags_tiktok: hashtagsFor('tiktok', service, targetArea),
      hashtags_youtube_shorts: hashtagsFor('youtube_shorts', service, targetArea),
      hashtags_instagram_reels: hashtagsFor('instagram_reels', service, targetArea),
      hashtags_facebook_reels: hashtagsFor('facebook_reels', service, targetArea),
      cta,
      thumbnail_text: sequence % 2 === 0 ? 'เช็กก่อนเติมน้ำยา' : 'แอร์ไม่เย็น เช็กจุดนี้',
      video_prompt: `Vertical 9:16 short video, Thai HVAC technician, practical real-service tone, ${formatLabel}, focus on ${angle}, service area ${targetArea}, no exaggerated guarantee.`,
      voiceover_style: 'พูดจริง ตรง ไม่เวอร์',
      compliance_notes: [
        'ไม่รับประกันราคาโดยไม่รู้พื้นที่/จำนวนเครื่อง',
        'ไม่บอกว่าต้องเติมน้ำยาทุกเคส',
        'ไม่อ้าง before/after หากไม่มี footage จริง',
        'ไม่ใช้ความเร่งด่วนเกินจริงโดยไม่มีเหตุผลทางเทคนิค',
      ],
    };
  });
}
