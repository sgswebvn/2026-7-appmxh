/**
 * ============================================================================
 * DYNAMIC B-ROLL & VISUAL MATCHER SERVICE (PHASE 6 - FEATURE 1)
 * ============================================================================
 * - Lấy cảm hứng từ ShortGPT & MoneyPrinterTurbo.
 * - Phân tích ngữ nghĩa từng câu trong kịch bản để ghép B-Roll & Motion Visuals
 *   thay đổi liên tục sau mỗi 3-5 giây.
 */

const aiPoolService = require('./aiPoolService');

class BRollService {
  constructor() {
    // Thư viện các chủ đề B-Roll phổ biến với mã màu và video assets
    this.brollCategories = {
      tech_ai: {
        keywords: ['ai', 'công nghệ', 'lập trình', 'code', 'robot', 'phần mềm', 'máy tính', 'tool', 'tự động'],
        themeColor: '0x090d16',
        bgGradients: ['#0f172a', '#1e1b4b', '#0284c7'],
        visualDescription: 'Cyberpunk tech grid & glowing circuit motion'
      },
      finance_mmo: {
        keywords: ['tiền', 'tài chính', 'thu nhập', 'kinh doanh', 'đầu tư', 'triệu phú', 'thành công', 'giàu có', 'mmo'],
        themeColor: '0x064e3b',
        bgGradients: ['#064e3b', '#047857', '#0f766e'],
        visualDescription: 'Gold particles & stock market financial charts'
      },
      motivation_life: {
        keywords: ['động lực', 'thành công', 'ước mơ', 'cố gắng', 'thay đổi', 'bài học', 'tư duy', 'cuộc sống'],
        themeColor: '0x1c1917',
        bgGradients: ['#1c1917', '#292524', '#44403c'],
        visualDescription: 'Dramatic sunrise & mountain peak atmospheric motion'
      },
      comedy_fun: {
        keywords: ['hài hước', 'troll', 'buồn cười', 'cười', 'vui', 'chuyện lạ', 'bất ngờ'],
        themeColor: '0x831843',
        bgGradients: ['#831843', '#be185d', '#f43f5e'],
        visualDescription: 'Vibrant pop-art & dynamic color explosion'
      },
      news_breaking: {
        keywords: ['tin tức', 'thời sự', 'nóng', 'vừa xảy ra', 'cảnh báo', 'chấn động', 'mới nhất'],
        themeColor: '0x7f1d1d',
        bgGradients: ['#7f1d1d', '#991b1b', '#b91c1c'],
        visualDescription: 'Breaking news studio & red radar warning wave'
      }
    };
  }

  // 1. Phân tích kịch bản và lập bản đồ B-Roll từng cảnh (Scene Timeline Plan)
  async generateScenePlan(scriptText, totalDurationSec = 30) {
    if (!scriptText) return [];

    const sentences = scriptText
      .split(/[.\n?!]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) return [];

    const secPerSentence = totalDurationSec / sentences.length;
    const scenes = [];

    sentences.forEach((sentence, index) => {
      const startSec = Math.round(index * secPerSentence * 10) / 10;
      const endSec = Math.round(Math.min((index + 1) * secPerSentence, totalDurationSec) * 10) / 10;
      const duration = Math.round((endSec - startSec) * 10) / 10;

      // Tìm danh mục B-Roll khớp nhất với nội dung câu
      const matchedCategory = this.findMatchingCategory(sentence);
      const visualInfo = this.brollCategories[matchedCategory];

      scenes.push({
        sceneIndex: index + 1,
        sentenceText: sentence,
        startSec,
        endSec,
        durationSec: duration,
        category: matchedCategory,
        visualDescription: visualInfo.visualDescription,
        bgColor: visualInfo.themeColor,
        gradient: visualInfo.bgGradients[index % visualInfo.bgGradients.length],
        transitionEffect: index % 2 === 0 ? 'zoom_in' : 'slide_left'
      });
    });

    return scenes;
  }

  // 2. Tìm Category khớp nhất theo từ khóa
  findMatchingCategory(sentence) {
    const lower = sentence.toLowerCase();
    for (const [catKey, catData] of Object.entries(this.brollCategories)) {
      for (const kw of catData.keywords) {
        if (lower.includes(kw)) {
          return catKey;
        }
      }
    }
    return 'tech_ai'; // Mặc định
  }
}

module.exports = new BRollService();
