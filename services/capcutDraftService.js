/**
 * ============================================================================
 * CAPCUT DRAFT EXPORTER SERVICE (PHASE 6 - FEATURE 3)
 * ============================================================================
 * - Lấy cảm hứng từ CapCut-Mate & Video-Autopilot-Kit.
 * - Xuất kịch bản, âm thanh và phụ đề thành file dự án CapCut PC (draft_content.json)
 *   cho phép mở và dựng phim chuyên nghiệp trong 1 giây.
 */

const { v4: uuidv4 } = require('uuid');

class CapCutDraftService {
  // 1. Tạo cấu trúc Dự Án CapCut Chuẩn (Standard CapCut PC Draft)
  generateCapCutDraft({ title, scriptText, audioUrl, durationSec = 30, aspectRatio = '9:16' }) {
    const draftId = uuidv4();
    const isVertical = aspectRatio === '9:16';
    const canvasWidth = isVertical ? 1080 : 1920;
    const canvasHeight = isVertical ? 1920 : 1080;
    const durationMicroseconds = durationSec * 1000000;

    // Phân tích phụ đề theo từng câu
    const sentences = (scriptText || '')
      .split(/[.\n?!]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const secPerSentence = durationSec / (sentences.length || 1);
    const textSegments = [];

    sentences.forEach((sentence, idx) => {
      const startUs = Math.round(idx * secPerSentence * 1000000);
      const durationUs = Math.round(secPerSentence * 1000000);

      textSegments.push({
        id: uuidv4(),
        text: sentence,
        target_timerange: {
          start: startUs,
          duration: durationUs
        },
        font_size: 14.0,
        font_color: '#FFFF00', // Chữ vàng Hormozi nổi bật
        font_family: 'Montserrat'
      });
    });

    // Cấu trúc draft_content.json chuẩn của CapCut Desktop
    const draftContent = {
      id: draftId,
      draft_name: title || 'Social Content Factory Project',
      canvas_config: {
        width: canvasWidth,
        height: canvasHeight,
        ratio: isVertical ? '9:16' : '16:9'
      },
      duration: durationMicroseconds,
      fps: 30.0,
      tracks: [
        // Track 1: Video Motion Background
        {
          id: uuidv4(),
          type: 'video',
          segments: [
            {
              id: uuidv4(),
              source_timerange: { start: 0, duration: durationMicroseconds },
              target_timerange: { start: 0, duration: durationMicroseconds },
              render_index: 0
            }
          ]
        },
        // Track 2: Audio Voiceover TTS
        {
          id: uuidv4(),
          type: 'audio',
          segments: [
            {
              id: uuidv4(),
              audio_url: audioUrl || '',
              source_timerange: { start: 0, duration: durationMicroseconds },
              target_timerange: { start: 0, duration: durationMicroseconds },
              volume: 1.0
            }
          ]
        },
        // Track 3: Karaoke Subtitles
        {
          id: uuidv4(),
          type: 'text',
          segments: textSegments
        }
      ]
    };

    // Cấu trúc draft_meta_info.json
    const draftMetaInfo = {
      draft_id: draftId,
      draft_name: title || 'Social Content Factory Project',
      draft_create_time: Date.now(),
      draft_materials: [],
      draft_timeline_materials_size_: 0
    };

    return {
      success: true,
      draftId,
      title,
      aspectRatio,
      totalDurationSec: durationSec,
      totalSubtitles: textSegments.length,
      draftContent,
      draftMetaInfo
    };
  }
}

module.exports = new CapCutDraftService();
