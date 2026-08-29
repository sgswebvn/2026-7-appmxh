const express = require('express');
const router = express.Router();
const brollDownloadService = require('../services/brollDownloadService');
const { authenticateToken } = require('../middleware/auth');

// 1. Phân tích kịch bản và tự động ghép B-Roll Footage cảnh quay thật
router.post('/match', authenticateToken, (req, res) => {
  try {
    const { scriptText, preferredTheme } = req.body;
    if (!scriptText || scriptText.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp nội dung kịch bản để ghép B-Roll.' });
    }

    const matches = brollDownloadService.matchBrollForScript(scriptText, preferredTheme);
    res.json({
      success: true,
      message: 'Đã tự động trích xuất và ghép B-Roll Footage cảnh quay thật!',
      matches,
      totalClips: matches.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi ghép B-Roll: ' + err.message });
  }
});

// 2. Lấy danh sách danh mục B-Roll
router.get('/categories', authenticateToken, (req, res) => {
  res.json({ success: true, categories: brollDownloadService.getAvailableCategories() });
});

module.exports = router;
