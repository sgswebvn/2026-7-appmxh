const express = require('express');
const router = express.Router();
const capcutDraftService = require('../services/capcutDraftService');
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');

// 1. Xuất file dự án CapCut Draft JSON và lưu vào MongoDB
router.post('/export', authenticateToken, async (req, res) => {
  try {
    const { title, scriptText, audioUrl, durationSec, aspectRatio, brandId } = req.body;
    const result = capcutDraftService.generateCapCutDraft({
      title: title || 'Social Content Factory Video',
      scriptText: scriptText || '',
      audioUrl: audioUrl || '',
      durationSec: Number(durationSec) || 30,
      aspectRatio: aspectRatio || '9:16'
    });

    // Tự động lưu dự án CapCut vào MongoDB Atlas
    if (result.success) {
      try {
        await dbService.createContentProject(req.user.id, {
          brandId: brandId || '',
          title: title || 'Dự án CapCut Video',
          topic: 'CapCut Desktop Project',
          contentType: aspectRatio === '9:16' ? 'SHORT' : 'LONG_FORM',
          status: 'MEDIA_READY',
          scriptData: {
            hook: scriptText?.substring(0, 100),
            callToAction: 'Mở và chỉnh sửa trong CapCut Desktop'
          },
          seoMetadata: {
            description: `Dự án video dựng sẵn CapCut Desktop (ID: ${result.draftId})`,
            tags: ['#CapCut', '#VideoEdit', '#Shorts']
          }
        });
      } catch (e) {}
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xuất CapCut Draft: ' + err.message });
  }
});

module.exports = router;
