export interface CTAPresetConfig {
  name: string;
  style: string;
  examples: {
    th: string[];
    en: string[];
  };
}

export const defaultCTAPresets: Record<string, CTAPresetConfig> = {
  book_now: {
    name: 'Book Now',
    style: 'direct_booking',
    examples: {
      th: [
        'โทรจองเลยวันนี้!',
        'กดจองคิวได้เลย',
        'นัดหมายผ่าน LINE ได้ทันที',
        'จองคิวก่อนเต็ม!',
      ],
      en: [
        'Book your appointment now!',
        'Schedule your service today',
        'Reserve your spot before we fill up',
      ],
    },
  },
  get_quote: {
    name: 'Get a Quote',
    style: 'quote_request',
    examples: {
      th: [
        'ขอใบเสนอราคาฟรี',
        'สอบถามราคาได้เลย ไม่มีค่าใช้จ่าย',
        'ประเมินราคาฟรี! แอดไลน์เลย',
        'รับใบเสนอราคาภายใน 30 นาที',
      ],
      en: [
        'Get your free quote today',
        'Request a no-obligation estimate',
        'Free assessment — contact us now',
      ],
    },
  },
  call_now: {
    name: 'Call Now',
    style: 'phone_call',
    examples: {
      th: [
        'โทรหาเราเลย!',
        'โทร. xxx-xxx-xxxx',
        'โทรปรึกษาฟรี ไม่มีค่าใช้จ่าย',
        'ปัญหาด่วน? โทรเลย 24 ชม.',
      ],
      en: [
        'Call us now for immediate help',
        'Speak with an expert today',
        'Emergency? Call us 24/7',
      ],
    },
  },
  line_contact: {
    name: 'LINE Contact',
    style: 'line_chat',
    examples: {
      th: [
        'แอดไลน์ @xxxxx',
        'แชทกับเราทาง LINE ได้เลย',
        'ส่งรูปมาทาง LINE ประเมินฟรี!',
        'แอดไลน์รับส่วนลดทันที',
      ],
      en: [
        'Add us on LINE for instant help',
        'Chat with us on LINE',
        'Send photos via LINE for a free assessment',
      ],
    },
  },
  learn_more: {
    name: 'Learn More',
    style: 'soft_cta',
    examples: {
      th: [
        'อ่านรายละเอียดเพิ่มเติม',
        'ดูผลงานของเราได้ที่เว็บไซต์',
        'เรียนรู้เพิ่มเติมเกี่ยวกับบริการ',
        'กดอ่านต่อ...',
      ],
      en: [
        'Learn more about our services',
        'See our portfolio',
        'Read more on our website',
      ],
    },
  },
  limited_offer: {
    name: 'Limited Offer',
    style: 'urgency_cta',
    examples: {
      th: [
        'โปรนี้มีจำนวนจำกัด! จองเลย',
        'ส่วนลดหมดเขตสิ้นเดือนนี้',
        'เหลืออีก 10 คิวเท่านั้น!',
        'รับโปรก่อนหมดเขต!',
      ],
      en: [
        'Limited spots available — book now!',
        'Offer ends this month',
        'Only 10 slots remaining!',
      ],
    },
  },
};

export function getCTAExamples(style: string, language: string = 'th'): string[] {
  const preset = defaultCTAPresets[style] || defaultCTAPresets.book_now;
  const lang = language === 'th' ? 'th' : 'en';
  return preset.examples[lang];
}

export function getCTAGuidance(style: string, language: string = 'th'): string {
  const examples = getCTAExamples(style, language);
  return `CTA Style: ${style}\nExamples:\n${examples.map(e => `- "${e}"`).join('\n')}`;
}
