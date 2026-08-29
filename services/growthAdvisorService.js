/**
 * ============================================================================
 * AI GROWTH ADVISOR & MULTI-CHANNEL ANALYTICS ENGINE (PHASE 4 - MODULE 2)
 * ============================================================================
 * - Phân tích hiệu suất toàn diện đa kênh (YouTube, Facebook, TikTok).
 * - Sử dụng AI Pool để tìm công thức Viral, gợi ý Khung Giờ Vàng và Chủ Đề Nên Làm Tiếp.
 */

const aiPoolService = require('./aiPoolService');
const dbService = require('./dbService');

class GrowthAdvisorService {
  async generateGrowthReport(userId) {
    const channels = await dbService.getChannels(userId);
    const history = await dbService.getHistory(userId, 50);

    // Tính toán tổng quan các chỉ số
    let totalSubs = 0;
    let totalVideos = 0;
    let totalViews = 0;
    let ytCount = 0, fbCount = 0, ttCount = 0;

    channels.forEach(ch => {
      totalSubs += ch.subscriberCount || 0;
      totalVideos += ch.videoCount || 0;
      totalViews += ch.viewCount || 0;

      const plat = ch.tokens?.platform || (ch.id?.startsWith('fb_') ? 'FACEBOOK' : ch.id?.startsWith('tt_') ? 'TIKTOK' : 'YOUTUBE');
      if (plat === 'FACEBOOK') fbCount++;
      else if (plat === 'TIKTOK') ttCount++;
      else ytCount++;
    });

    const publishedCount = history.filter(h => h.status === 'SUCCESS').length;

    // Prompt gửi tới AI Pool để phân tích
    const prompt = `
Bạn là Giám đốc Tăng trưởng Nội dung Mạng Xã Hội (Chief Growth Officer).
Hãy phân tích dữ liệu hiệu suất của hệ thống kênh sau và đưa ra Báo cáo Chiến lược Tăng trưởng:

📊 DỮ LIỆU HIỆN TẠI:
- Tổng số kênh: ${channels.length} (YouTube: ${ytCount}, Facebook: ${fbCount}, TikTok: ${ttCount})
- Tổng Người theo dõi / Đăng ký: ${totalSubs.toLocaleString()}
- Tổng Video đã phân phối: ${totalVideos + publishedCount}
- Số video đăng thành công gần đây: ${publishedCount}

YÊU CẦU: Trả về DUY NHẤT một chuỗi JSON hợp lệ theo cấu trúc sau (không kèm markdown ngoài JSON):
{
  "performanceScore": 88,
  "summaryHeadline": "Tiêu đề đánh giá tốc độ tăng trưởng ngắn gọn, truyền cảm hứng",
  "goldenPostingHours": [
    { "slot": "11:30 - 13:00", "reason": "Khung giờ nghỉ trưa, tỷ lệ xem Shorts & Reels tăng 45%" },
    { "slot": "19:30 - 21:30", "reason": "Khung giờ vàng buổi tối, tương tác bình luận và chia sẻ cao nhất" }
  ],
  "viralFormulas": [
    "Công thức 1: Hook 3s dạng cảnh báo hoặc lật ngược niềm tin phổ biến",
    "Công thức 2: Nhịp độ cắt cảnh nhanh mỗi 2-3 giây kèm chữ phụ đề chạy từng từ (Karaoke Style)",
    "Công thức 3: Kêu gọi hành động CTA thả tim để lưu video về xem lại"
  ],
  "recommendedTopicsNext": [
    "Chủ đề xu hướng 1 có tiềm năng x3 lượt xem trong 7 ngày tới",
    "Chủ đề xu hướng 2 giải quyết nỗi đau cấp bách của khán giả",
    "Chủ đề xu hướng 3 dạng so sánh đối chiếu gây tranh luận tích cực"
  ],
  "strategicAdvice": "Đoạn phân tích chiến lược 100-150 từ hướng dẫn tối ưu lịch đăng và phân nhóm kênh để phủ sóng đa nền tảng hiệu quả nhất."
}
`;

    try {
      const response = await aiPoolService.queryActivePool(prompt);
      const parsed = this.parseCleanJson(response.content);
      if (parsed && parsed.performanceScore) {
        return {
          success: true,
          provider: response.provider,
          report: parsed,
          stats: { totalChannels: channels.length, totalSubs, totalVideos, publishedCount, ytCount, fbCount, ttCount }
        };
      }
      throw new Error('Dữ liệu AI trả về không đúng định dạng');
    } catch (e) {
      console.warn('AI Growth Advisor fallback:', e.message);
      return {
        success: true,
        provider: 'Algorithmic Growth Advisor Engine (Local)',
        report: this.getSmartFallbackGrowthReport(channels.length, totalSubs, publishedCount),
        stats: { totalChannels: channels.length, totalSubs, totalVideos, publishedCount, ytCount, fbCount, ttCount }
      };
    }
  }

  parseCleanJson(content) {
    if (!content) return null;
    try {
      const clean = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
      }
      return JSON.parse(clean);
    } catch (e) {
      return null;
    }
  }

  getSmartFallbackGrowthReport(channelCount, subs, publishedCount) {
    return {
      performanceScore: Math.min(95, 75 + channelCount * 3 + publishedCount * 2),
      summaryHeadline: "Hệ thống đang mở rộng kênh vững chắc với độ phủ sóng đa nền tảng cao!",
      goldenPostingHours: [
        { slot: "11:30 - 13:00", reason: "Khung giờ nghỉ trưa vàng, lưu lượng xem Shorts/Reels đạt đỉnh." },
        { slot: "19:30 - 21:30", reason: "Khung giờ giải trí tối, tỷ lệ giữ chân người xem và bình luận cao nhất." }
      ],
      viralFormulas: [
        "Hook 3s dạng sốc: 'Đừng bao giờ... nếu không muốn mất thời gian!'",
        "Chèn phụ đề Karaoke chữ vàng to nổi bật chuẩn phong cách Alex Hormozi",
        "Kêu gọi bình luận ý kiến ở cuối video để kích thích thuật toán lan truyền"
      ],
      recommendedTopicsNext: [
        "Bí quyết tự động hóa và đòn bẩy công nghệ 2026",
        "Top 3 sai lầm khiến 90% người mới thất bại",
        "Cách tạo thu nhập thụ động bền vững từ sáng tạo nội dung"
      ],
      strategicAdvice: `Hệ thống của bạn đang sở hữu ${channelCount} kênh và fanpage. Hãy duy trì tần suất đăng ít nhất 2 video Shorts/Reels mỗi ngày theo đúng ma trận lịch đã xếp để thuật toán YouTube và TikTok nhận diện kênh hoạt động liên tục.`
    };
  }
}

module.exports = new GrowthAdvisorService();
