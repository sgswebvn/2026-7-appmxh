const express = require('express');
const router = express.Router();
const browserAgentService = require('../services/browserAgentService');
const { authenticateToken } = require('../middleware/auth');

// 1. Quét xu hướng thời gian thực từ TikTok / YouTube
router.post('/scan-trends', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.body;
    const result = await browserAgentService.scrapeLiveTrendingKeywords(platform || 'TIKTOK');
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi quét trend Web Agent: ' + err.message });
  }
});

// 2. Chạy tác vụ đăng bài dự phòng qua giao diện web
router.post('/direct-post', authenticateToken, async (req, res) => {
  try {
    const { platform, title, videoUrl, cookies } = req.body;
    const result = await browserAgentService.executeDirectWebPost({
      platform: platform || 'FACEBOOK',
      title: title || 'Video Tự Động',
      videoUrl: videoUrl || '',
      cookies: cookies || ''
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi chạy Web Agent Direct Post: ' + err.message });
  }
});

module.exports = router;
