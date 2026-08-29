const express = require('express');
const router = express.Router();
const aiPoolService = require('../services/aiPoolService');
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');
const { aiSpamLimiter } = require('../middleware/security');

// 1. Phân tích nội dung và sinh gói Script / Tiêu đề / Mô tả / Tags qua Multi-AI Failover Pool
router.post('/analyze', authenticateToken, aiSpamLimiter, async (req, res) => {
  try {
    const { topic, targetAudience, tone, brandName, apiKey } = req.body;
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập chủ đề video.' });
    }

    const channels = await dbService.getChannels(req.user.id);
    const userApiKey = apiKey || req.user.geminiApiKey;

    const result = await aiPoolService.generateContentWithFailover({
      topic,
      targetAudience: targetAudience || 'Khán giả đại chúng',
      tone: tone || 'Hấp dẫn, kích thích tò mò',
      channels,
      brandName: brandName || 'Social Content Factory',
      customApiKey: userApiKey
    });

    await dbService.saveGeminiDraft(req.user.id, {
      topic,
      targetAudience,
      generatedTitles: result.data.viralTitles,
      generatedDescription: result.data.seoDescription,
      generatedTags: result.data.tags,
      channelVariants: result.data.channelVariants,
      scriptData: result.data.script || null
    });

    res.json({
      success: true,
      isAiGenerated: result.isAiGenerated,
      provider: result.provider,
      data: result.data
    });
  } catch (err) {
    console.error('AI Pool Analyze Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi phân tích AI: ' + err.message });
  }
});

// 2. Lấy danh sách các bản nháp AI đã tạo
router.get('/drafts', authenticateToken, async (req, res) => {
  try {
    const drafts = await dbService.getGeminiDrafts(req.user.id);
    res.json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
