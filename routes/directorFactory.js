const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const factoryService = require('../services/videoDirectorFactory');
const storyPlanService = require('../services/storyPlanService');

// ==================== STORYPLAN CANONICAL ENDPOINTS (PHASE 3A) ====================

// 1. Sinh StoryPlan qua LLM
router.post('/story-plan/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, style, durationTarget, apiKey } = req.body;
    const effectiveKey = apiKey || req.user?.geminiApiKey || process.env.GEMINI_API_KEY;

    const plan = await storyPlanService.generateStoryPlan({
      topic,
      style: style || 'conversational cinematic vertical short',
      durationTarget: parseInt(durationTarget) || 30,
      apiKey: effectiveKey
    });

    res.json({
      success: true,
      data: plan
    });
  } catch (err) {
    const statusCode = err.code === 'INVALID_TOPIC' ? 400 : (err.code === 'GENERATION_UNAVAILABLE' ? 503 : 500);
    res.status(statusCode).json({
      success: false,
      code: err.code || 'GENERATION_FAILED',
      message: err.message,
      validation: err.validation || null
    });
  }
});

// 2. Lấy danh sách StoryPlans
router.get('/story-plan/list', authenticateToken, (req, res) => {
  try {
    const plans = storyPlanService.getAllStories();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Lấy chi tiết 1 StoryPlan
router.get('/story-plan/:storyId', authenticateToken, (req, res) => {
  try {
    const plan = storyPlanService.getStory(req.params.storyId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'StoryPlan không tồn tại.' });
    }
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Cập nhật Character trong StoryPlan
router.put('/story-plan/:storyId/character/:charId', authenticateToken, (req, res) => {
  try {
    const { storyId, charId } = req.params;
    const patch = req.body;
    const updated = storyPlanService.updateCharacter(storyId, charId, patch);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'StoryPlan hoặc Character không tồn tại.' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Thêm Character mới vào StoryPlan
router.post('/story-plan/:storyId/character', authenticateToken, (req, res) => {
  try {
    const { storyId } = req.params;
    const character = req.body;
    const updated = storyPlanService.createCharacter(storyId, character);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'StoryPlan không tồn tại.' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Thêm Relationship vào StoryPlan
router.post('/story-plan/:storyId/relationship', authenticateToken, (req, res) => {
  try {
    const { storyId } = req.params;
    const relationship = req.body;
    const updated = storyPlanService.createRelationship(storyId, relationship);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'StoryPlan không tồn tại.' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Xác thực tính toàn vẹn của StoryPlan
router.post('/story-plan/validate', authenticateToken, (req, res) => {
  try {
    const validation = storyPlanService.validate(req.body);
    res.json({
      success: true,
      valid: validation.valid,
      issues: validation.issues
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== EXISTING FACTORY ENDPOINTS ====================

// Tạo và Khởi chạy Dự Án Autonomous Video Factory
router.post('/project/create', authenticateToken, async (req, res) => {
  try {
    const { topic, mode, qualityThreshold, maxAttempts } = req.body;
    const project = await factoryService.createAndRunAutonomousProject(
      topic || 'Chủ đề video',
      mode || 'CONVERSATION',
      parseInt(qualityThreshold) || 85,
      parseInt(maxAttempts) || 6
    );

    res.json({
      success: true,
      data: project
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khởi chạy Factory Project: ' + err.message });
  }
});

// Sửa lỗi từng phân đoạn (Partial Regeneration)
router.post('/project/partial-fix', authenticateToken, async (req, res) => {
  try {
    const { projectId, targetType, targetId, instructions } = req.body;
    const result = await factoryService.partialRegenerateComponent(projectId, {
      targetType: targetType || 'SHOT',
      targetId: targetId || '1',
      instructions: instructions || ''
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi sửa phân đoạn: ' + err.message });
  }
});

// Lấy thông tin chi tiết dự án và danh sách phiên bản
router.get('/project/:id', authenticateToken, (req, res) => {
  try {
    const project = factoryService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dự án' });
    }
    res.json({
      success: true,
      data: project
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải dự án: ' + err.message });
  }
});

// Lấy toàn bộ Cơ sở Dữ liệu Tri thức (Memory Database)
router.get('/memory', authenticateToken, (req, res) => {
  try {
    const memory = factoryService.getMemoryDatabase();
    res.json({
      success: true,
      data: memory
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải Memory Database: ' + err.message });
  }
});

module.exports = router;
