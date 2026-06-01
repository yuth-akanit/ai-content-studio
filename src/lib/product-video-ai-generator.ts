export interface AIContentPayload {
  marketing_caption: string;
  video_title: string;
  hook: string;
  scene_script: string;
  overlay_texts: string;
  cta: string;
  hashtags: string;
  brand_style: string;
  preview_note: string;
}

export function generateDeterministicAIContent(brandContext: string, brief: string): AIContentPayload {
  const cleanBrief = (brief || '').trim();
  const briefSegment = cleanBrief ? `\nรายละเอียดเพิ่มเติม: ${cleanBrief}\n` : '';

  if (brandContext === 'syncflow') {
    return {
      video_title: 'SyncFlow - ตอบไว จัดคิวง่าย ลดงานหลุด',
      hook: 'ลูกค้าทักมาหลายช่องทาง แต่งานไม่ควรหลุดเพราะตอบไม่ทัน',
      scene_script: 'Scene 1: แอดมินหัวหมุน ตอบแชทไม่ทันหลายช่องทาง\nScene 2: เปิดใช้งาน SyncFlow รวมทุกช่องทางในที่เดียว\nScene 3: อัปเดตสถานะงานทีมงานตอบคิวรวดเร็ว ลูกค้าประทับใจ',
      overlay_texts: 'แชทเยอะแค่ไหนก็ไม่หลุด, รวม LINE FB IG โทรศัพท์, จัดคิวง่ายในหน้าเดียว',
      cta: 'สนใจดูตัวอย่างระบบ ทัก SyncFlow by PAA Tech',
      hashtags: '#SyncFlow #ระบบจัดการงาน #ธุรกิจบริการ #AIContentStudio #จัดคิวงาน #ลดงานหลุด',
      brand_style: 'Professional & Business Service Solution',
      preview_note: 'สร้างวิดีโอสินค้าแบบ preview เท่านั้น ยังไม่โพสต์จริง และยังไม่เปิด schedule',
      marketing_caption: `ลูกค้าทักมาหลายช่องทาง แต่งานไม่ควรหลุดเพราะตอบไม่ทัน
${briefSegment}
ถ้าทีมแอดมินต้องไล่ตอบ LINE, Facebook, Instagram และโทรศัพท์พร้อมกัน โอกาสพลาดคิว พลาดงาน และตอบลูกค้าช้าจะสูงมาก

SyncFlow ช่วยรวมงานจากหลายช่องทางให้กลายเป็นระบบเดียว ตั้งแต่รับเรื่อง จัดคิว ติดตามสถานะ ไปจนถึงแจ้งเตือนทีมงาน

เหมาะกับธุรกิจบริการที่มีแอดมินหลายคน งานเข้าหลายช่องทาง และต้องการลดงานหลุดโดยไม่เพิ่มคน

สนใจดูตัวอย่างระบบ ทัก SyncFlow by PAA Tech

#SyncFlow #ระบบจัดการงาน #ธุรกิจบริการ #AIContentStudio #จัดคิวงาน #ลดงานหลุด`,
    };
  } else {
    // default/paa_air
    return {
      video_title: 'PAA Air - ล้างแอร์ฆ่าเชื้อโรคโดยช่างมืออาชีพ',
      hook: 'แอร์ไม่เย็น มีกลิ่นอับ น้ำหยด ปัญหาชวนปวดหัวในช่วงหน้าร้อน!',
      scene_script: 'Scene 1: แอร์ลมเบา มีฝุ่นเกาะหนาแน่น\nScene 2: ช่าง PAA Air ล้างทำความสะอาดด้วยอุปกรณ์มาตรฐาน\nScene 3: แอร์สะอาดเย็นฉ่ำ ประหยัดไฟ สุขภาพดีขึ้น',
      overlay_texts: 'ล้างสะอาดลึกฆ่าเชื้อโรค, บริการโดยช่างแอร์มืออาชีพ, ฟรีตรวจเช็กน้ำยาแอร์',
      cta: 'สนใจจองคิวบริการ ทัก PAA Air ได้ทันที',
      hashtags: '#PAAAir #ล้างแอร์ #ซ่อมแอร์ #ช่างแอร์ #แอร์บ้าน #กรุงเทพ',
      brand_style: 'Trustworthy & Premium Home Care Service',
      preview_note: 'สร้างวิดีโอสินค้าแบบ preview เท่านั้น ยังไม่โพสต์จริง และยังไม่เปิด schedule',
      marketing_caption: `แอร์ไม่เย็น มีกลิ่นอับ น้ำหยด ปัญหาชวนปวดหัวในช่วงหน้าร้อน!
${briefSegment}
ปล่อยไว้นานอาจทำให้ค่าไฟพุ่งกระฉูด แถมยังเป็นแหล่งสะสมของเชื้อโรคและฝุ่นละออง PM2.5 ที่ส่งผลเสียต่อสุขภาพครอบครัวคุณ

PAA Air บริการล้างแอร์ฆ่าเชื้อโรคด้วยทีมช่างมืออาชีพ ล้างสะอาดทุกซอกทุกมุม ตรวจเช็กระบบน้ำยาแอร์ฟรี

ให้บริการในพื้นที่กรุงเทพฯ และปริมณฑล สะดวกรวดเร็ว นัดง่าย ตรงเวลา

สนใจจองคิวบริการ ทัก PAA Air ได้ทันที

#PAAAir #ล้างแอร์ #ซ่อมแอร์ #ช่างแอร์ #แอร์บ้าน #กรุงเทพ`,
    };
  }
}
