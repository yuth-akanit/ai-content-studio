export interface TonePresetConfig {
  name: string;
  description: string;
  rules: string[];
  languageModifiers: {
    th: string;
    en: string;
  };
}

export const defaultTonePresets: Record<string, TonePresetConfig> = {
  professional: {
    name: 'Professional',
    description: 'Clean, trustworthy, business-appropriate tone',
    rules: [
      'Use polite, clear language',
      'Avoid slang or overly casual expressions',
      'Maintain a confident, knowledgeable voice',
      'Be direct but not aggressive',
      'Focus on credibility and reliability',
    ],
    languageModifiers: {
      th: 'ใช้ภาษาสุภาพ เป็นทางการพอดี ไม่เยิ่นเย้อ สื่อสารตรงประเด็น',
      en: 'Professional but approachable. Clear and confident.',
    },
  },
  friendly: {
    name: 'Friendly',
    description: 'Warm, approachable, neighbor-like tone',
    rules: [
      'Use warm, welcoming language',
      'Feel like talking to a trusted neighbor',
      'Include empathetic expressions',
      'Be conversational but not unprofessional',
      'Show genuine care for the customer',
    ],
    languageModifiers: {
      th: 'ใช้ภาษาที่เป็นมิตร อบอุ่น เหมือนพี่น้อง ไม่ห่างเหินแต่ยังสุภาพ',
      en: 'Warm and welcoming, like a friendly neighbor who happens to be an expert.',
    },
  },
  casual: {
    name: 'Casual',
    description: 'Relaxed, social media-native tone',
    rules: [
      'Use everyday language',
      'Can use emoji and informal expressions',
      'Feel like a social media post from a friend',
      'Keep it light and easy to read',
      'Still maintain basic professionalism',
    ],
    languageModifiers: {
      th: 'ใช้ภาษาง่ายๆ สบายๆ แบบโพสต์โซเชียล ใส่อิโมจิได้',
      en: 'Casual and social-native. Easy to read, easy to share.',
    },
  },
  urgent: {
    name: 'Urgent',
    description: 'Time-sensitive, action-driving tone',
    rules: [
      'Create sense of urgency without being manipulative',
      'Use time-bound language',
      'Emphasize limited availability or deadline',
      'Drive immediate action',
      'Keep it honest — fake urgency damages trust',
    ],
    languageModifiers: {
      th: 'สร้างความเร่งด่วน จำกัดเวลา กระตุ้นให้ตัดสินใจเร็ว แต่ไม่หลอกลวง',
      en: 'Create genuine urgency. Time-sensitive language. Drive immediate action.',
    },
  },
  authoritative: {
    name: 'Authoritative',
    description: 'Expert, confident, industry-leader tone',
    rules: [
      'Project deep expertise and knowledge',
      'Use industry-specific terminology appropriately',
      'Cite facts, numbers, or experience',
      'Position as the go-to expert',
      'Confident without being arrogant',
    ],
    languageModifiers: {
      th: 'แสดงความเป็นผู้เชี่ยวชาญ มั่นใจ ใช้ข้อมูลอ้างอิง สร้างความน่าเชื่อถือ',
      en: 'Expert authority. Data-backed claims. Industry leader positioning.',
    },
  },
  empathetic: {
    name: 'Empathetic',
    description: 'Understanding, supportive, customer-first tone',
    rules: [
      'Lead with understanding the customer problem',
      'Show genuine empathy for their situation',
      'Use "we understand" type language',
      'Focus on solving their pain, not selling',
      'Build emotional connection',
    ],
    languageModifiers: {
      th: 'เข้าใจปัญหาลูกค้า แสดงความห่วงใย เน้นช่วยแก้ปัญหา ไม่เน้นขายของ',
      en: 'Lead with empathy. Understand first, then solve. Customer pain comes first.',
    },
  },
  enthusiastic: {
    name: 'Enthusiastic',
    description: 'Excited, energetic, high-energy tone',
    rules: [
      'Show excitement about the service or offer',
      'Use energetic, positive language',
      'Create excitement without being fake',
      'Good for promotions and celebrations',
      'Keep the energy genuine',
    ],
    languageModifiers: {
      th: 'กระตือรือร้น ตื่นเต้น พลังบวก เหมาะกับโปรโมชั่นและข่าวดี',
      en: 'High energy. Excited and positive. Celebrate the offer or achievement.',
    },
  },
  educational: {
    name: 'Educational',
    description: 'Teaching, informative, value-sharing tone',
    rules: [
      'Focus on teaching and sharing knowledge',
      'Use clear, easy-to-understand explanations',
      'Break complex topics into simple points',
      'Position as a helpful teacher, not a sales pitch',
      'Build trust through expertise sharing',
    ],
    languageModifiers: {
      th: 'ให้ความรู้ อธิบายง่าย สอนเทคนิค แบ่งปันประสบการณ์ สร้างความไว้วางใจ',
      en: 'Teacher mode. Explain simply. Share expertise. Build trust through education.',
    },
  },
};

export function getToneRules(tone: string, language: string = 'th'): string {
  const preset = defaultTonePresets[tone] || defaultTonePresets.professional;
  const lang = language === 'th' ? 'th' : 'en';
  return [
    `Tone: ${preset.name} — ${preset.description}`,
    `Language modifier: ${preset.languageModifiers[lang]}`,
    ...preset.rules.map(r => `- ${r}`),
  ].join('\n');
}
