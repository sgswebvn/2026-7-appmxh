const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Phân tích và sinh nội dung Video thông minh bằng Gemini AI 2.5 Flash
 */
async function analyzeAndGenerateContent({
  topic,
  targetAudience = 'Khán giả đại chúng',
  tone = 'Hấp dẫn, kích thích tò mò',
  channels = [],
  apiKey = ''
}) {
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY;

  if (effectiveKey && effectiveKey.trim().length > 10) {
    try {
      const genAI = new GoogleGenerativeAI(effectiveKey.trim());
      // Sử dụng model gemini-2.5-flash hoặc gemini-flash-latest
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const channelNames = channels.map(c => c.title || c).join(', ');

      const prompt = `
Bạn là chuyên gia sáng tạo nội dung YouTube hàng đầu (YouTube Growth & SEO Master).
Hãy phân tích chủ đề sau và tạo ra gói nội dung video YouTube tối ưu nhất:

CHỦ ĐỀ VIDEO: "${topic}"
ĐỐI TƯỢNG XEM: "${targetAudience}"
PHONG CÁCH: "${tone}"
DANH SÁCH KÊNH SẼ PHÂN PHỐI: "${channelNames || 'Nhiều kênh khác nhau'}"

Hãy trả về kết quả theo ĐÚNG ĐỊNH DẠNG JSON sau (chỉ trả về chuỗi JSON thuần túy, không kèm markdown hay text thừa):
{
  "viralTitles": [
    { "title": "Tiêu đề 1", "hookType": "Gây tò mò", "clickScore": 96 },
    { "title": "Tiêu đề 2", "hookType": "Cảnh báo / Bất ngờ", "clickScore": 93 },
    { "title": "Tiêu đề 3", "hookType": "Hướng dẫn / Bí mật", "clickScore": 90 },
    { "title": "Tiêu đề 4", "hookType": "Trải nghiệm thực tế", "clickScore": 92 },
    { "title": "Tiêu đề 5", "hookType": "Đặt câu hỏi", "clickScore": 88 }
  ],
  "seoDescription": "Bản mô tả hoàn chỉnh có mở đầu thu hút, tóm tắt nội dung chính, dàn ý timestamp gợi ý (00:00 - Giới thiệu, 01:30 - Chi tiết...), lời kêu gọi đăng ký (CTA), và 5-7 hashtag phổ biến nhất...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13", "tag14", "tag15"],
  "channelVariants": [
    {
      "channelTitle": "Tên kênh 1",
      "customTitle": "Tiêu đề tùy biến riêng cho kênh này",
      "customDescription": "Mở đầu mô tả tùy biến riêng cho kênh này để tránh trùng lặp nội dung YouTube"
    }
  ],
  "contentAdvice": "Lời khuyên ngắn gọn 2-3 câu về cách làm thumbnail và 5 giây đầu giữ chân khán giả."
}
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, isAiGenerated: true, data: parsed };
      }
    } catch (apiErr) {
      console.warn('Lỗi gọi Gemini API (Sẽ chuyển sang Smart Template Engine):', apiErr.message);
    }
  }

  // Fallback Engine
  return {
    success: true,
    isAiGenerated: false,
    data: generateSmartFallbackContent(topic, targetAudience, channels)
  };
}

function generateSmartFallbackContent(topic, targetAudience, channels) {
  const cleanTopic = topic.trim();
  const lowerTopic = cleanTopic.toLowerCase();

  const viralTitles = [
    {
      title: `🔥 BÍ MẬT: ${cleanTopic} - Những Điều Bạn Chưa Từng Được Biết!`,
      hookType: 'Gây tò mò tột độ',
      clickScore: 96
    },
    {
      title: `Sự Thật Về ${cleanTopic}: Đừng Làm Điều Này Nếu Không Muốn Hối Hận!`,
      hookType: 'Cảnh báo & Giật tít',
      clickScore: 93
    },
    {
      title: `Hướng Dẫn Toàn Diện ${cleanTopic} Từ A-Z Cho Người Mới (Mới Nhất 2026)`,
      hookType: 'Chuyên gia & Giá trị',
      clickScore: 89
    },
    {
      title: `Tôi Đã Thử ${cleanTopic} Suốt 30 Ngày Và Cái Kết Bất Ngờ...`,
      hookType: 'Trải nghiệm cá nhân',
      clickScore: 94
    },
    {
      title: `Liệu ${cleanTopic} Có Thực Sự Xứng Đáng? Đánh Giá Chi Tiết!`,
      hookType: 'Phân tích & Đánh giá',
      clickScore: 88
    }
  ];

  const seoDescription = `📌 Trong video hôm nay, chúng ta sẽ cùng khám phá toàn bộ sự thật và bí quyết về "${cleanTopic}". Dành riêng cho ${targetAudience}!

⏱️ TIMESTAMPS / CÁC MỐC THỜI GIAN QUAN TRỌNG:
00:00 - Mở đầu & Tổng quan
01:15 - Những hiểu lầm phổ biến về ${cleanTopic}
03:40 - Chi tiết từng bước thực hiện hiệu quả nhất
06:20 - Sai lầm cần tuyệt đối tránh
08:50 - Lời khuyên vàng & Tổng kết

🔔 ĐỪNG QUÊN BẤM LIKE & ĐĂNG KÝ KÊNH ĐỂ KHÔNG BỎ LỠ NHỮNG VIDEO MỚI NHẤT!
💬 Bình luận ý kiến của bạn về ${cleanTopic} ở bên dưới nhé!

#${lowerTopic.replace(/\s+/g, '')} #trending #huongdan #review #kienthuc #youtube`;

  const words = cleanTopic.split(/\s+/).filter(w => w.length > 2);
  const baseTags = [
    cleanTopic,
    `huong dan ${cleanTopic}`,
    `review ${cleanTopic}`,
    `bi quyet ${cleanTopic}`,
    `${cleanTopic} 2026`,
    'kinh nghiem hay',
    'huong dan chi tiet',
    'xu huong',
    'trending youtube'
  ];
  words.forEach(w => baseTags.push(w));

  const channelVariants = channels.map((c, idx) => {
    const titleStyle = [
      `[Tập ${idx + 1}] ${cleanTopic} - Xem Ngay Kẻo Lỡ!`,
      `Khám Phá ${cleanTopic} Cực Hay (Bản Chi Tiết)`,
      `Review Cực Gắt Về ${cleanTopic} - Có Nên Thử?`,
      `Tips & Tricks: ${cleanTopic} Chuẩn Không Cần Chỉnh`
    ];
    return {
      channelId: c.id || c.channelId || `ch_${idx}`,
      channelTitle: c.title || c,
      customTitle: titleStyle[idx % titleStyle.length],
      customDescription: `Chào mừng bạn đến với kênh ${c.title || ''}! Hôm nay hãy cùng tìm hiểu về ${cleanTopic}. Đừng quên nhấn Subscribe để ủng hộ kênh nhé!`
    };
  });

  return {
    viralTitles,
    seoDescription,
    tags: Array.from(new Set(baseTags)).slice(0, 15),
    channelVariants,
    contentAdvice: '💡 Mẹo Thumbnail: Sử dụng ảnh cận cảnh biểu cảm ngạc nhiên hoặc hình ảnh tương phản cao với chữ lớn (tối đa 4-5 từ) để tăng tỷ lệ nhấp chuột (CTR) trên 10%!'
  };
}

module.exports = {
  analyzeAndGenerateContent
};
