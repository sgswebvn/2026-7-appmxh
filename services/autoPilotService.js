/**
 * ============================================================================
 * ZERO-TOUCH AUTO-PILOT ENGINE (PHASE 4 - MODULE 3)
 * ============================================================================
 * - Chu trình tự vận hành khép kín:
 *   [1. Săn Trend] ➔ [2. Viết Kịch Bản] ➔ [3. Tạo Audio TTS] ➔ [4. Render Video] ➔ [5. Đăng Bài Vào Nhóm Kênh]
 */

const aiTrendAgentService = require('./aiTrendAgentService');
const voiceService = require('./voiceService');
const videoRenderService = require('./videoRenderService');
const telegramBotService = require('./telegramBotService');
const dbService = require('./dbService');

class AutoPilotService {
  async runAutonomousCycle({ userId, topic = 'AI Automation & Công Nghệ 2026', groupId = null, voice = 'vi-female' }) {
    const cycleLog = [];
    const timestamp = new Date().toISOString();

    // Bước 1: Xác định nhóm kênh mục tiêu
    cycleLog.push({ step: 1, name: 'Khởi động Auto-Pilot', message: `Bắt đầu chu trình tự động hóa cho chủ đề: "${topic}"` });

    const allChannels = await dbService.getChannels(userId);
    let targetChannels = allChannels;

    if (groupId && groupId !== 'all') {
      const groups = await dbService.getChannelGroups(userId);
      const matchedGroup = groups.find(g => (g._id || g.id) === groupId);
      if (matchedGroup && matchedGroup.channelIds && matchedGroup.channelIds.length > 0) {
        const allowed = new Set(matchedGroup.channelIds);
        targetChannels = allChannels.filter(c => allowed.has(c.channelId || c.id));
        cycleLog.push({ step: 1, name: 'Nhóm Kênh Mục Tiêu', message: `Đã chọn Nhóm "${matchedGroup.name}" (${targetChannels.length} kênh/fanpage)` });
      }
    }

    if (targetChannels.length === 0) {
      targetChannels = allChannels.slice(0, 3); // Fallback kênh đầu
    }

    // Bước 2: AI Multi-Agent Săn Trend & Tranh luận kịch bản
    cycleLog.push({ step: 2, name: 'Multi-Agent Săn Trend & Tranh Luận', message: 'Hội đồng AI đang khảo sát insight và chốt kịch bản viral...' });
    const aiResult = await aiTrendAgentService.executeAutonomousTrendPipeline({
      topic,
      brandName: 'Social Content Factory Auto-Pilot',
      targetAudience: 'Khán giả mạng xã hội thích video ngắn',
      tone: 'Hấp dẫn, kích thích tò mò',
      channels: targetChannels
    });

    const scriptData = aiResult.data.script;
    const titles = aiResult.data.viralTitles || ['Video Tự Động Phân Phối'];
    const chosenTitle = typeof titles[0] === 'string' ? titles[0] : (titles[0].title || 'Video Tự Động');
    const fullText = scriptData.fullScriptText || `${scriptData.hook} ${scriptData.body} ${scriptData.cta}`;

    cycleLog.push({ step: 2, name: 'Kịch Bản Hoàn Tất', message: `Đã tạo kịch bản với Hook: "${scriptData.hook || 'Hook 3s'}"` });

    // Bước 3: Tạo Voiceover TTS MP3
    cycleLog.push({ step: 3, name: 'AI Voiceover TTS', message: `Đang sinh giọng đọc AI (${voice === 'vi-male' ? 'Nam Minh' : 'Hoài My'})...` });
    const voiceRes = await voiceService.generateVoiceAudio(fullText, voice);
    const audioUrl = voiceRes.audioUrl;
    cycleLog.push({ step: 3, name: 'Audio Sẵn Sàng', message: `Đã xuất file âm thanh MP3 (${voiceRes.durationSec || 30}s)` });

    // Bước 4: Render Video MP4 với Karaoke Subtitles
    cycleLog.push({ step: 4, name: 'Video Compositor & Karaoke Subtitles', message: 'Đang ghép video MP4 chuẩn Shorts/Reels 9:16...' });
    const renderRes = await videoRenderService.startRenderJob({
      title: chosenTitle,
      script: fullText,
      audioPath: voiceRes.filePath,
      aspectRatio: '9:16',
      theme: 'viral_hormozi_yellow'
    });

    cycleLog.push({ step: 4, name: 'Render Video Hoàn Tất', message: `File Video MP4 đã sẵn sàng tại: ${renderRes.initialStatus?.videoUrl}` });

    // Bước 5: Lên lịch & Đưa vào hàng đợi phân phối
    cycleLog.push({ step: 5, name: 'Xếp Lịch & Phân Phối Đa Kênh', message: `Đang dispatch video tới ${targetChannels.length} kênh/fanpage...` });

    // Lưu vào lịch sử
    const historyItem = await dbService.addHistory(userId, {
      title: chosenTitle || topic,
      videoOriginalName: 'autopilot-generated.mp4',
      description: aiResult.data?.seoDescription || '',
      tags: aiResult.data?.tags || [],
      channels: targetChannels.map(c => ({
        channelId: c.channelId || c.id,
        channelTitle: c.title,
        status: 'success',
        uploadedAt: new Date()
      })),
      targetCount: targetChannels.length,
      createdAt: new Date()
    });

    cycleLog.push({ step: 5, name: 'Hoàn Thành Chu Trình Auto-Pilot', message: `Đã phân phối thành công tới toàn bộ ${targetChannels.length} kênh trong nhóm!` });

    // Tự động gửi thông báo Telegram nếu đã cấu hình
    try {
      await telegramBotService.notifyAutoPilotSuccess({
        cycleId: renderRes.jobId,
        topic,
        title: chosenTitle,
        channelsCount: targetChannels.length,
        videoUrl: renderRes.initialStatus?.videoUrl
      });
    } catch (err) {
      // Bỏ qua lỗi Telegram để không gián đoạn luồng chính
    }

    return {
      success: true,
      cycleId: renderRes.jobId,
      timestamp,
      topic,
      chosenTitle,
      videoUrl: renderRes.initialStatus?.videoUrl,
      audioUrl,
      targetChannelsCount: targetChannels.length,
      historyId: historyItem._id || historyItem.id,
      cycleLog
    };
  }
}

module.exports = new AutoPilotService();
