const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const factoryService = require('../services/videoDirectorFactory');

// 1. Tạo và Khởi chạy Dự Án Autonomous Video Factory
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

// 2. Sửa lỗi từng phân đoạn (Partial Regeneration)
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

// 3. Lấy thông tin chi tiết dự án và danh sách phiên bản
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

// 4. Lấy toàn bộ Cơ sở Dữ liệu Tri thức (Memory Database)
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
