const express = require('express');
const router = express.Router();
const videoClipperService = require('../services/videoClipperService');
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');

// 1. Phân tích video dài và trích xuất danh sách clip Shorts
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { videoUrl, videoTitle, transcriptText, targetPlatform, brandId } = req.body;
    if (!videoUrl && !videoTitle && !transcriptText) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp link video hoặc tiêu đề video dài.' });
    }

    const result = await videoClipperService.analyzeAndExtractClips({
      videoUrl,
      videoTitle,
      transcriptText,
      targetPlatform
    });

    // Tự động lưu từng Clip vào MongoDB Atlas của người dùng
    if (result.success && result.clips) {
      for (const clip of result.clips) {
        try {
          await dbService.createContentProject(req.user.id, {
            brandId: brandId || '',
            title: clip.clipTitle,
            topic: videoTitle || videoUrl || 'Long-to-Shorts Clipper',
            contentType: 'SHORT',
            status: 'SCRIPT_GENERATED',
            scriptData: {
              hook: clip.hookText,
              callToAction: 'Đăng ký kênh để xem thêm nội dung hay!'
            },
            seoMetadata: {
              description: `${clip.hookText}\n\n${clip.keySummary || ''}`,
              tags: clip.suggestedTags || []
            }
          });
        } catch (e) {}
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi phân tích video clipper: ' + err.message });
  }
});

module.exports = router;
