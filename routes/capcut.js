const express = require('express');
const router = express.Router();
const capcutDraftService = require('../services/capcutDraftService');
const { authenticateToken } = require('../middleware/auth');

// 1. Xuất file dự án CapCut Draft JSON
router.post('/export', authenticateToken, async (req, res) => {
  try {
    const { title, scriptText, audioUrl, durationSec, aspectRatio } = req.body;
    const result = capcutDraftService.generateCapCutDraft({
      title: title || 'Social Content Factory Video',
      scriptText: scriptText || '',
      audioUrl: audioUrl || '',
      durationSec: Number(durationSec) || 30,
      aspectRatio: aspectRatio || '9:16'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xuất CapCut Draft: ' + err.message });
  }
});

module.exports = router;
