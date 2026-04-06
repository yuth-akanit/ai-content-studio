-- ============================================================
-- Default Tone Presets
-- ============================================================
INSERT INTO tone_presets (name, description, rules) VALUES
('Professional', 'Clean, trustworthy, business-appropriate', '["Use polite, clear language","Avoid slang","Maintain confident voice","Be direct but not aggressive","Focus on credibility"]'),
('Friendly', 'Warm, approachable, neighbor-like', '["Use warm, welcoming language","Feel like talking to a trusted neighbor","Include empathetic expressions","Be conversational","Show genuine care"]'),
('Casual', 'Relaxed, social media-native', '["Use everyday language","Can use emoji","Feel like a post from a friend","Keep it light","Still maintain professionalism"]'),
('Urgent', 'Time-sensitive, action-driving', '["Create sense of urgency","Use time-bound language","Emphasize limited availability","Drive immediate action","Keep it honest"]'),
('Authoritative', 'Expert, confident, industry-leader', '["Project deep expertise","Use industry terminology","Cite facts and experience","Position as expert","Confident not arrogant"]'),
('Empathetic', 'Understanding, supportive, customer-first', '["Lead with understanding","Show genuine empathy","Use we understand language","Focus on solving pain","Build emotional connection"]'),
('Enthusiastic', 'Excited, energetic, high-energy', '["Show excitement","Use energetic language","Create genuine excitement","Good for promotions","Keep energy genuine"]'),
('Educational', 'Teaching, informative, value-sharing', '["Focus on teaching","Use clear explanations","Break complex topics simply","Position as helpful teacher","Build trust through expertise"]');

-- ============================================================
-- Default CTA Presets
-- ============================================================
INSERT INTO cta_presets (name, cta_style, examples) VALUES
('Book Now', 'direct_booking', '["โทรจองเลยวันนี้!","กดจองคิวได้เลย","นัดหมายผ่าน LINE ได้ทันที","จองคิวก่อนเต็ม!"]'),
('Get Quote', 'quote_request', '["ขอใบเสนอราคาฟรี","สอบถามราคาได้เลย ไม่มีค่าใช้จ่าย","ประเมินราคาฟรี! แอดไลน์เลย","รับใบเสนอราคาภายใน 30 นาที"]'),
('Call Now', 'phone_call', '["โทรหาเราเลย!","โทรปรึกษาฟรี ไม่มีค่าใช้จ่าย","ปัญหาด่วน? โทรเลย 24 ชม."]'),
('LINE Contact', 'line_chat', '["แอดไลน์ @paaair","แชทกับเราทาง LINE ได้เลย","ส่งรูปมาทาง LINE ประเมินฟรี!","แอดไลน์รับส่วนลดทันที"]'),
('Learn More', 'soft_cta', '["อ่านรายละเอียดเพิ่มเติม","ดูผลงานของเราได้ที่เว็บไซต์","เรียนรู้เพิ่มเติมเกี่ยวกับบริการ"]'),
('Limited Offer', 'urgency_cta', '["โปรนี้มีจำนวนจำกัด! จองเลย","ส่วนลดหมดเขตสิ้นเดือนนี้","เหลืออีก 10 คิวเท่านั้น!","รับโปรก่อนหมดเขต!"]');

-- ============================================================
-- Default Platform Presets
-- ============================================================
INSERT INTO platform_presets (platform, variant, format_rules) VALUES
('facebook', 'post', '{"max_length":2000,"hashtags":{"min":3,"max":5},"style":"social_natural","emoji":"moderate"}'),
('facebook', 'ad', '{"max_length":1000,"hashtags":{"min":0,"max":3},"style":"compelling","emoji":"minimal"}'),
('instagram', 'post', '{"max_length":2200,"hashtags":{"min":10,"max":20},"style":"visual_first","emoji":"moderate"}'),
('instagram', 'carousel', '{"max_slides":10,"min_slides":5,"style":"visual_first","text_per_slide":"short"}'),
('instagram', 'reel', '{"max_caption":300,"hashtags":{"min":5,"max":15},"style":"hook_first","emoji":"heavy"}'),
('line_oa', 'broadcast', '{"max_length":500,"style":"concise_clear","emoji":"light","button_required":true}'),
('line_oa', 'rich_message', '{"max_length":200,"style":"action_oriented","button_required":true}'),
('tiktok', 'short_video', '{"max_caption":300,"hashtags":{"min":3,"max":5},"style":"hook_3s","scene_flow":true}'),
('website', 'service_page', '{"seo_title_max":60,"meta_desc_max":160,"style":"seo_friendly","h2_sections":true,"faq":true}'),
('website', 'blog', '{"seo_title_max":60,"meta_desc_max":160,"style":"educational","h2_sections":true}');

-- ============================================================
-- Default Prompt Presets
-- ============================================================
INSERT INTO prompt_presets (name, platform, content_type, system_prompt, user_prompt_template, is_default) VALUES
('Facebook Promotion', 'facebook', 'promotion_post',
 'You are an expert social media marketer for Thai service businesses. Create engaging Facebook posts that drive bookings and trust.',
 'Create a promotional Facebook post for {{business_name}} about {{topic}}. Service: {{service_type}}. Include hook, body, CTA, and hashtags.',
 true),
('Instagram Visual', 'instagram', 'promotion_post',
 'You are an Instagram content specialist for service businesses. Create visual-first content with strong hooks and engaging captions.',
 'Create an Instagram post for {{business_name}} about {{topic}}. Include short caption, carousel ideas, and hashtags.',
 true),
('LINE Broadcast', 'line_oa', 'broadcast_message',
 'You are a messaging specialist. Create concise, action-oriented LINE OA broadcasts for Thai service businesses.',
 'Create a LINE broadcast message for {{business_name}} about {{topic}}. Keep it under 500 characters with clear CTA button text.',
 true),
('TikTok Script', 'tiktok', 'short_video_script',
 'You are a TikTok content creator for service businesses. Create hook-driven short video scripts that capture attention in 3 seconds.',
 'Create a TikTok video script for {{business_name}} about {{topic}}. Include 3-second hook, scene flow, and on-screen text.',
 true),
('Website Service Page', 'website', 'service_page_draft',
 'You are an SEO copywriter for service business websites. Create conversion-focused, SEO-optimized service pages.',
 'Create a service page for {{business_name}} about {{service_type}} in {{location}}. Include SEO title, meta description, H1, H2 sections, trust signals, and FAQ.',
 true);

-- ============================================================
-- Sample Business Profile
-- ============================================================
INSERT INTO business_profiles (
  business_name, business_type, description, tone_of_voice, brand_style,
  service_categories, service_areas, target_audience, pain_points,
  trust_signals, promotion_goals, brand_keywords, banned_words,
  contact_phone, contact_line, website_url, default_ctas,
  default_language, bilingual_enabled,
  faq_knowledge, review_examples
) VALUES (
  'PAA Air Service, 'air_conditioning',
  'บริการล้างแอร์ ซ่อมแอร์ ติดตั้งแอร์ ครบวงจร โดยทีมช่างมืออาชีพ ประสบการณ์กว่า 10 ปี',
  'friendly', 'clean',
  '["ล้างแอร์","ซ่อมแอร์","ติดตั้งแอร์","เติมน้ำยาแอร์","ล้างแอร์โรงงาน"]',
  '["กรุงเทพ","นนทบุรี","ปทุมธานี","สมุทรปราการ"]',
  '["เจ้าของบ้าน","เจ้าของคอนโด","ผู้จัดการอาคาร","เจ้าของสำนักงาน"]',
  '["แอร์ไม่เย็น","ค่าไฟแพง","แอร์มีกลิ่น","แอร์น้ำหยด","หาช่างแอร์ดีๆ ยาก"]',
  '["ประสบการณ์ 10 ปี","ช่างผ่านการอบรม","รับประกันผลงาน","ราคาตรงไปตรงมา","รีวิว 5 ดาว"]',
  '["เพิ่มยอดจอง","สร้างการรับรู้แบรนด์","รักษาลูกค้าเก่า"]',
  '["ล้างแอร์","ซ่อมแอร์","ช่างแอร์","แอร์ไม่เย็น","ค่าไฟแพง"]',
  '["ถูกที่สุด","รับประกันตลอดชีพ"]',
  '084-2824465', '@paaair',
  'https://paaair.com',
  '["โทรจองเลย","แอดไลน์ @paaair","ขอใบเสนอราคาฟรี"]',
  'th', false,
  '[{"question":"ล้างแอร์ราคาเท่าไหร่?","answer":"เริ่มต้นที่ 500 บาท ขึ้นอยู่กับขนาดและรุ่นของแอร์"},{"question":"ใช้เวลาล้างแอร์นานเท่าไหร่?","answer":"ประมาณ 30-60 นาทีต่อเครื่อง"},{"question":"ควรล้างแอร์บ่อยแค่ไหน?","answer":"แนะนำทุก 3-6 เดือน เพื่อประสิทธิภาพสูงสุด"}]',
  '[{"text":"ช่างมาตรงเวลา ทำงานเรียบร้อย แอร์เย็นขึ้นเยอะเลย ราคาไม่แพง จะเรียกใช้อีกแน่นอน","rating":5,"source":"Google"},{"text":"บริการดีมาก ช่างสุภาพ อธิบายละเอียด แนะนำจริงๆ ครับ","rating":5,"source":"Facebook"}]'
);

-- ============================================================
-- Sample Campaigns
-- ============================================================
INSERT INTO content_projects (business_profile_id, name, description, campaign_type, status) VALUES
((SELECT id FROM business_profiles LIMIT 1), 'Summer AC Campaign', 'แคมเปญล้างแอร์หน้าร้อน กระตุ้นยอดจองช่วง เม.ย.-พ.ค.', 'summer', 'active'),
((SELECT id FROM business_profiles LIMIT 1), 'Rainy Season Maintenance', 'แคมเปญดูแลแอร์หน้าฝน ป้องกันปัญหาแอร์เสีย', 'rainy_season', 'active'),
((SELECT id FROM business_profiles LIMIT 1), 'Customer Reactivation', 'ดึงลูกค้าเก่ากลับมาใช้บริการ เน้นส่วนลดพิเศษ', 'customer_reactivation', 'active');
