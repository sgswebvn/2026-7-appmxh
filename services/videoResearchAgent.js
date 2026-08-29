/**
 * ============================================================================
 * AI VIDEO RESEARCH & VIRAL PATTERN EXTRACTOR AGENT
 * ============================================================================
 * - Nghiên cứu video đang hoạt động tốt mà KHÔNG copy nguyên văn.
 * - Trích xuất 6 trụ cột: Hook, Structure, Script, Visual, Audio, Retention.
 * - Xây dựng và duy trì Video Pattern Knowledge Base & Failure Memory.
 */

const VideoKnowledgeBase = require('../models/VideoKnowledgeBase');
const FailureMemory = require('../models/FailureMemory');
const aiPoolService = require('./aiPoolService');

class VideoResearchAgent {
  constructor() {
    this.initialized = false;
  }

  // Khởi tạo các mẫu quy luật cơ sở ban đầu nếu DB còn trống
  async initializeDefaultKnowledgeBase() {
    try {
      const count = await VideoKnowledgeBase.countDocuments();
      if (count > 0) return;

      const initialPatterns = [
        {
          niche: 'travel_eco',
          topic: 'Du Lịch Sinh Thái & Trải Nghiệm Thiên Nhiên',
          hookPattern: {
            patternType: 'Paradoxical Warning + Visual Contrast',
            description: 'Đưa ra lời cảnh báo hoặc góc nhìn ngược chiều về điểm đến nổi tiếng kèm hình ảnh thiên nhiên hùng vĩ 3s đầu.',
            curiosityGapScore: 9.2,
            exampleHypothesis: 'Khẳng định 90% người đi du lịch đang bỏ lỡ điểm độc đáo nhất, tạo khoảng trống thông tin bắt buộc phải xem tiếp.'
          },
          titlePattern: {
            formula: 'Khám Phá [Số Lượng] Điểm [Chủ Đề] Tại [Địa Danh] Mà Bạn Chưa Từng Thấy',
            clickTriggers: ['Khám phá', 'Chưa từng thấy', 'Bí mật', 'Trải nghiệm đỉnh cao']
          },
          scriptStructure: {
            timeline: {
              hook0to3s: 'Đưa ra cảnh báo hoặc câu hỏi nghịch lý kích thích tò mò',
              promise3to10s: 'Cam kết 5 trải nghiệm độc bản không có ở tour thông thường',
              setup10to30s: 'Dẫn dắt qua 3 địa danh cụ thể kèm chi tiết trải nghiệm thực tế',
              valueDiscovery30sPlus: 'Lời khuyên giá trị về thời điểm, chi phí và cách bảo vệ môi trường',
              endingPayoffLoop: 'Kêu gọi bình luận địa điểm yêu thích + Câu hỏi nối loop sang video tiếp theo'
            },
            pacingWordsPerMinute: 150,
            sentenceLengthAvg: 12,
            openLoopsCount: 2
          },
          visualPattern: {
            avgShotDurationSec: 2.8,
            transitionStyle: 'Ken Burns Slow Zoom + Crossfade',
            textOverlayStyle: 'Hormozi Kinetic Yellow Bold with Multi-line Wrapping',
            brollType: '4K Contextual Nature Landscape Video & Authentic Scene Imagery',
            colorComposition: 'Vibrant Emerald Green & Golden Hour Warmth'
          },
          audioPattern: {
            voicePacing: 'Hào hứng, truyền cảm hứng, tốc độ 1.0x',
            sfxFrequency: 'Swoosh transition mỗi 3s, Pop icon khi xuất hiện từ khóa',
            bgmEnergy: 'Acoustic Uplifting & Cinematic Nature Ambient'
          },
          retentionHypothesis: {
            hookRetentionRisk: 'Nếu dùng hình ảnh chung chung không có địa danh cụ thể trong 3s đầu, tỷ lệ drop-off > 65%',
            peakRetentionTriggers: ['Hình ảnh địa danh độc lạ bất ngờ', 'Bí quyết tiết kiệm chi phí', 'Câu hỏi tương tác'],
            dropoffRisks: ['Đoạn văn đọc quá dài không đổi cảnh', 'Chữ phụ đề bị tràn màn hình', 'Bối cảnh không khớp chủ đề']
          },
          transferablePatterns: [
            'Luôn đưa địa danh cụ thể vào 3s đầu thay vì nói chung chung',
            'Đổi góc máy / hình ảnh mỗi 2.5–3.0 giây',
            'Ngắt dòng phụ đề tối đa 4–5 từ/dòng để khán giả đọc kịp không bị rối mắt',
            'Tự động khớp hình ảnh phong cảnh thiên nhiên thật với từng câu nói'
          ],
          patternsToAvoid: [
            'Sử dụng bối cảnh phòng kín công nghệ neon cho video thiên nhiên du lịch',
            'Để phụ đề dài 1 dòng tràn mép màn hình dọc',
            'Kịch bản chung chung không có tên địa danh cụ thể'
          ],
          performanceTier: 'TOP_PERFORMER',
          correlationStats: {
            topPerformerFrequencyPct: 88,
            poorPerformerFrequencyPct: 12,
            sampleSize: 45
          }
        },
        {
          niche: 'tech_ai',
          topic: 'Công Nghệ AI & Công Cụ Tự Động Hóa 2026',
          hookPattern: {
            patternType: 'FOMO + High-Stakes Transformation',
            description: 'Đưa ra mức độ nguy hiểm nếu bị bỏ lại phía sau hoặc năng suất tăng gấp 10 lần nhờ công cụ mới.',
            curiosityGapScore: 9.5,
            exampleHypothesis: 'Nếu bạn vẫn làm theo cách cũ, bạn đang mất 3 giờ mỗi ngày cho việc vô ích.'
          },
          titlePattern: {
            formula: 'Bí Mật AI 2026: [Số Lượng] Bước Khiến Bạn Đi Trước 99% Người Khác',
            clickTriggers: ['Bí mật', 'Đi trước 99%', 'Tự động hóa', 'Cảnh báo']
          },
          scriptStructure: {
            timeline: {
              hook0to3s: 'Cảnh báo nguy cơ tụt hậu trong kỷ nguyên AI',
              promise3to10s: 'Giải pháp tự động hóa giúp giải phóng 80% thời gian',
              setup10to30s: 'Demo 3 công cụ cốt lõi với thao tác thực tế',
              valueDiscovery30sPlus: 'Quy trình tích hợp vào công việc hàng ngày',
              endingPayoffLoop: 'Tặng prompt mẫu trong phần bình luận'
            },
            pacingWordsPerMinute: 160,
            sentenceLengthAvg: 10,
            openLoopsCount: 3
          },
          visualPattern: {
            avgShotDurationSec: 2.2,
            transitionStyle: 'Glitch & Dynamic Slide',
            textOverlayStyle: 'Cyberpunk Neon Box Highlight',
            brollType: 'Futuristic AI interfaces, Code matrices, Workflow graphs',
            colorComposition: 'Dark Obsidian & Neon Cyan (#38bdf8)'
          },
          audioPattern: {
            voicePacing: 'Quyết đoán, tốc độ nhanh 1.05x',
            sfxFrequency: 'Digital UI Click, Glitch swoosh, Notification ding',
            bgmEnergy: 'Cyber Tech Synthwave Beats'
          },
          retentionHypothesis: {
            hookRetentionRisk: 'Giải thích lý thuyết quá 5s mà không show công cụ cụ thể',
            peakRetentionTriggers: ['Kết quả trước và sau khi dùng AI', 'Thao tác 1-click'],
            dropoffRisks: ['Thuật ngữ kỹ thuật quá phức tạp không có ví dụ trực quan']
          },
          transferablePatterns: [
            'Minh họa ngay lập tức giao diện hoặc kết quả của AI',
            'Dùng số liệu cụ thể (VD: tiết kiệm 4 giờ, tăng 300% hiệu suất)',
            'Nhấn mạnh vào ứng dụng thực tế'
          ],
          patternsToAvoid: [
            'Nói lý thuyết chung chung không có tên công cụ',
            'Nhịp điệu video quá chậm rãi'
          ],
          performanceTier: 'TOP_PERFORMER',
          correlationStats: {
            topPerformerFrequencyPct: 91,
            poorPerformerFrequencyPct: 9,
            sampleSize: 60
          }
        }
      ];

      await VideoKnowledgeBase.insertMany(initialPatterns);
    } catch (err) {
      console.warn('Lỗi khởi tạo Knowledge Base:', err.message);
    }
  }

  // Trích xuất và suy luận các Pattern tối ưu cho một chủ đề cụ thể
  async researchAndSynthesizeStrategy(topic = '', targetNiche = 'general') {
    await this.initializeDefaultKnowledgeBase();

    // 1. Phân loại Niche tự động dựa trên từ khóa
    const lowerTopic = topic.toLowerCase();
    let detectedNiche = targetNiche;

    if (lowerTopic.includes('du lịch') || lowerTopic.includes('khám phá') || lowerTopic.includes('thiên nhiên') || lowerTopic.includes('địa điểm') || lowerTopic.includes('phượt') || lowerTopic.includes('resort')) {
      detectedNiche = 'travel_eco';
    } else if (lowerTopic.includes('ai') || lowerTopic.includes('công nghệ') || lowerTopic.includes('code') || lowerTopic.includes('phần mềm') || lowerTopic.includes('lập trình') || lowerTopic.includes('tự động')) {
      detectedNiche = 'tech_ai';
    } else if (lowerTopic.includes('tiền') || lowerTopic.includes('tài chính') || lowerTopic.includes('giàu') || lowerTopic.includes('đầu tư') || lowerTopic.includes('kinh doanh')) {
      detectedNiche = 'finance_money';
    }

    // 2. Tìm kiếm các Transferable Patterns đã được chứng minh hiệu quả trong Knowledge Base
    const patterns = await VideoKnowledgeBase.find({
      $or: [{ niche: detectedNiche }, { niche: 'general' }]
    }).sort({ 'correlationStats.topPerformerFrequencyPct': -1 }).limit(5);

    // 3. Tìm kiếm các bài học thất bại cần tránh trong Failure Memory
    const failureRules = await FailureMemory.find({
      ruleEnforcedInProduction: true
    }).sort({ createdAt: -1 }).limit(8);

    const avoidedRules = failureRules.map(f => `❌ ${f.newRule} (Lý do: ${f.lesson})`);

    // 4. Tổng hợp chiến lược nghiên cứu hành động
    const topPattern = patterns[0] || null;

    return {
      niche: detectedNiche,
      topic,
      topPattern,
      activeTransferablePatterns: topPattern ? topPattern.transferablePatterns : [
        'Hook 3s đầu trực diện kèm khoảng trống tò mò',
        'Thay đổi khung hình mỗi 2.5–3 giây',
        'Phụ đề ngắt dòng thông minh không tràn viền màn hình',
        'Khớp bối cảnh hình ảnh 100% với chủ đề'
      ],
      mandatoryRulesToEnforce: [
        'Phụ đề Karaoke phải ngắt dòng tối đa 4–6 từ/dòng, canh giữa màn hình',
        'Hình ảnh bối cảnh phải chính xác theo địa danh hoặc ngành nghề của chủ đề',
        ...avoidedRules
      ],
      recommendedVisualTheme: detectedNiche === 'travel_eco'
        ? 'Lush Vietnamese Nature, 4K Emerald Mountains, Crystal Waters, Eco Landscapes'
        : (detectedNiche === 'tech_ai' ? 'Futuristic Cyberpunk Tech Studio & Glowing Neural Holograms' : 'Modern Luxury Executive Architecture'),
      recommendedPacing: topPattern?.scriptStructure?.pacingWordsPerMinute || 150
    };
  }

  // Ghi nhận một lỗi thực tế vào Failure Memory và tự động sinh ra quy tắc mới
  async logFailure(failureData) {
    try {
      const record = await FailureMemory.create({
        videoTitle: failureData.videoTitle || 'Video không đạt chuẩn',
        niche: failureData.niche || 'general',
        whatHappened: failureData.whatHappened,
        expected: failureData.expected,
        actual: failureData.actual,
        probableCause: failureData.probableCause,
        lesson: failureData.lesson,
        newRule: failureData.newRule,
        ruleEnforcedInProduction: true
      });
      return record;
    } catch (e) {
      console.warn('Lỗi ghi nhận Failure Memory:', e.message);
      return null;
    }
  }

  // Lấy toàn bộ lịch sử bài học và cơ sở tri thức
  async getKnowledgeSummary() {
    await this.initializeDefaultKnowledgeBase();
    const knowledgeCount = await VideoKnowledgeBase.countDocuments();
    const failureCount = await FailureMemory.countDocuments();
    const topPatterns = await VideoKnowledgeBase.find().limit(6);
    const failureMemories = await FailureMemory.find().sort({ createdAt: -1 }).limit(10);

    return {
      totalPatternsLearned: knowledgeCount,
      totalFailureRulesEnforced: failureCount,
      topPatterns,
      failureMemories
    };
  }
}

module.exports = new VideoResearchAgent();
