const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const videoRenderService = require('../services/videoRenderService');
const { authenticateToken } = require('../middleware/auth');

// 1. Lấy danh sách mẫu video (Templates)
router.get('/templates', authenticateToken, (req, res) => {
  res.json({
    success: true,
    templates: [
      { id: 'shorts_modern_dark', name: 'Shorts / TikTok Graphite Minimal', ratio: '9:16', resolution: '1080x1920', theme: 'dark_modern' },
      { id: 'shorts_neon_glow', name: 'Shorts / Reels Neon Cyberpunk', ratio: '9:16', resolution: '1080x1920', theme: 'neon_glow' },
      { id: 'landscape_podcast', name: 'Video Ngang Podcast / Tin Tức', ratio: '16:9', resolution: '1920x1080', theme: 'studio_news' }
    ]
  });
});

// 2. Khởi tạo Render Video
router.post('/render', authenticateToken, async (req, res) => {
  try {
    const { title, script, scriptText, audioPath, audioUrl, aspectRatio, theme } = req.body;
    const finalScript = script || scriptText || 'Nội dung video tự động';
    const rawAudio = audioUrl || audioPath;

    let fullAudioPath = rawAudio;
    if (rawAudio && rawAudio.startsWith('/uploads/')) {
      fullAudioPath = path.join(__dirname, '..', rawAudio);
    }

    const result = await videoRenderService.startRenderJob({
      title: title || 'Video Tự Động',
      script: finalScript,
      audioPath: fullAudioPath,
      aspectRatio: aspectRatio || '9:16',
      theme: theme || 'dark_modern'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khởi tạo Render: ' + err.message });
  }
});

// 3. Kiểm tra tiến độ Render
router.get('/status/:jobId', authenticateToken, (req, res) => {
  const job = videoRenderService.getJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tiến trình render này.' });
  }
  res.json({ success: true, status: job, job });
});

module.exports = router;
