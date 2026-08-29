const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');

// 1. Lấy danh sách lịch ma trận Content Planner
router.get('/', authenticateToken, async (req, res) => {
  try {
    const brandId = req.query.brandId || null;
    const plans = await dbService.getContentPlans(req.user.id, brandId);
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy lịch Content Planner: ' + err.message });
  }
});

// 2. Thêm slot lịch đăng mới vào ma trận
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { brandId, dayOfWeek, timeSlot, topicTheme, targetPlatforms } = req.body;
    if (!dayOfWeek || !timeSlot || !topicTheme) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ Thứ, Khung giờ và Chủ đề bài đăng.' });
    }

    const plan = await dbService.saveContentPlan(req.user.id, {
      brandId: brandId || '',
      dayOfWeek,
      timeSlot,
      topicTheme,
      targetPlatforms: targetPlatforms || ['YOUTUBE', 'FACEBOOK', 'TIKTOK']
    });

    res.json({ success: true, message: 'Đã thêm lịch ma trận thành công!', plan });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lưu lịch Content Planner: ' + err.message });
  }
});

// 3. Xóa slot lịch đăng
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await dbService.deleteContentPlan(req.user.id, req.params.id);
    res.json({ success: true, message: 'Đã xóa slot lịch đăng.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xóa lịch: ' + err.message });
  }
});

module.exports = router;
