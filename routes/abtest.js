const express = require('express');
const router = express.Router();
const abTestService = require('../services/abTestService');
const { authenticateToken } = require('../middleware/auth');

// 1. Tạo bài test A/B mới
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { testName, brandId, videoUrl, variants } = req.body;
    const test = await abTestService.createTest(req.user.id, { testName, brandId, videoUrl, variants });
    res.json({ success: true, message: 'Đã khởi tạo thử nghiệm A/B Tiêu đề & Hook thành công!', test });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 2. Lấy danh sách các bài test A/B
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.query;
    const tests = await abTestService.getTests(req.user.id, brandId);
    res.json({ success: true, tests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Tự động chọn biến thể chiến thắng (Winner)
router.post('/:id/select-winner', authenticateToken, async (req, res) => {
  try {
    const result = await abTestService.selectWinner(req.user.id, req.params.id);
    res.json({
      success: true,
      message: `Đã tự động xác định biến thể chiến thắng: Variant ${result.winner.variantId} (CTR: ${result.winner.ctr}%)`,
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
