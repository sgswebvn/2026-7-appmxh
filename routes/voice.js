const express = require('express');
const router = express.Router();
const voiceService = require('../services/voiceService');
const { authenticateToken } = require('../middleware/auth');

// 1. Lấy danh sách giọng đọc
router.get('/voices', (req, res) => {
  res.json({ success: true, voices: voiceService.getAvailableVoices() });
});

// 2. Chuyển kịch bản thành giọng đọc MP3
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { text, voiceKey, speed } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp nội dung kịch bản để tạo giọng đọc.' });
    }

    const result = await voiceService.synthesizeSpeech(text, voiceKey || 'vi-female', speed);
    res.json({ success: true, message: 'Tạo giọng đọc thành công!', data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi sinh giọng đọc AI: ' + err.message });
  }
});

module.exports = router;
