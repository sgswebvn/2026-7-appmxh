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

const aiTrendAgentService = require('../services/aiTrendAgentService');

// 2. Nghiên cứu Trend Tự Động & Multi-Agent Debate Loop (Chỉ cần 1 từ khóa gốc)
router.post('/deep-research', authenticateToken, aiSpamLimiter, async (req, res) => {
  try {
    const { topic, targetAudience, tone, brandName } = req.body;
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập từ khóa hoặc chủ đề gốc.' });
    }

    const channels = await dbService.getChannels(req.user.id);
    const result = await aiTrendAgentService.executeAutonomousTrendPipeline({
      topic: topic.trim(),
      targetAudience,
      tone,
      brandName,
      channels
    });

    // Lưu vào bản nháp
    if (result.data) {
      const formattedTitles = (result.data.viralTitles || []).map(t => {
        if (typeof t === 'string') {
          return { title: t, hookType: 'Viral High-CTR', clickScore: 95 };
        }
        return { title: t.title || '', hookType: t.hookType || 'Viral', clickScore: t.clickScore || 90 };
      });

      await dbService.saveGeminiDraft(req.user.id, {
        topic: `[Auto-Research] ${topic}`,
        targetAudience,
        generatedTitles: formattedTitles,
        generatedDescription: result.data.seoDescription,
        generatedTags: result.data.tags,
        scriptData: result.data.script
      });
    }

    res.json(result);
  } catch (err) {
    console.error('AI Deep Research Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi nghiên cứu AI: ' + err.message });
  }
});

// 3. Lấy danh sách các bản nháp AI đã tạo
router.get('/drafts', authenticateToken, async (req, res) => {
  try {
    const drafts = await dbService.getGeminiDrafts(req.user.id);
    res.json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const brandPersonaService = require('../services/brandPersonaService');

// 4. Lấy danh sách Brand Personas (Nhân vật đại diện & Phong cách thương hiệu)
router.get('/personas', authenticateToken, (req, res) => {
  res.json({
    success: true,
    personas: brandPersonaService.getPersonas()
  });
});

// 5. Tự động sinh 3-5 Phân Cảnh Hình Ảnh Điện Ảnh Đồng Bộ Nhân Vật từ Kịch Bản
router.post('/scenes-generate', authenticateToken, (req, res) => {
  try {
    const { scriptData, personaId, aspectRatio } = req.body;
    const scenePackage = brandPersonaService.generateScenesFromScript(scriptData || {}, personaId || 'alex-tech', aspectRatio || '9:16');
    res.json({
      success: true,
      data: scenePackage
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi sinh phân cảnh: ' + err.message });
  }
});

const videoCriticService = require('../services/videoCriticService');
const videoResearchAgent = require('../services/videoResearchAgent');

// 6. Tự động chấm điểm 10 tiêu chí cho Video Draft (Quality Critic)
router.post('/evaluate-draft', authenticateToken, (req, res) => {
  try {
    const result = videoCriticService.evaluateVideoDraft(req.body);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi đánh giá chất lượng video: ' + err.message });
  }
});

// 7. Chạy Vòng Lặp Tự Cải Tiến Video (Generate -> Critique -> Improve -> Score Loop)
router.post('/self-improve-loop', authenticateToken, async (req, res) => {
  try {
    const result = await videoCriticService.runSelfImprovementLoop(req.body, 2);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi chạy vòng lặp tự cải tiến: ' + err.message });
  }
});

// 8. Lấy Knowledge Base và Failure Memory tóm tắt
router.get('/knowledge', authenticateToken, async (req, res) => {
  try {
    const summary = await videoResearchAgent.getKnowledgeSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải cơ sở tri thức: ' + err.message });
  }
});

// 9. Ghi nhận Failure Memory và sinh quy tắc mới
router.post('/failure-memory', authenticateToken, async (req, res) => {
  try {
    const record = await videoResearchAgent.logFailure(req.body);
    res.json({
      success: true,
      message: 'Đã lưu bài học thất bại và cập nhật quy tắc sản xuất mới!',
      record
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi ghi nhận Failure Memory: ' + err.message });
  }
});

module.exports = router;
