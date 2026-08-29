const express = require('express');
const router = express.Router();
const videoClipperService = require('../services/videoClipperService');
const { authenticateToken } = require('../middleware/auth');

// 1. Phân tích video dài và trích xuất danh sách clip Shorts
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { videoUrl, videoTitle, transcriptText, targetPlatform } = req.body;
    if (!videoUrl && !videoTitle && !transcriptText) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp link video hoặc tiêu đề video dài.' });
    }

    const result = await videoClipperService.analyzeAndExtractClips({
      videoUrl,
      videoTitle,
      transcriptText,
      targetPlatform
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi phân tích video clipper: ' + err.message });
  }
});

module.exports = router;
