const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { getMongoStatus } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// 1. Kiểm tra trạng thái kết nối Database (MongoDB Atlas)
router.get('/health/db', (req, res) => {
  res.json({ success: true, db: getMongoStatus() });
});

// 2. Lấy lịch sử đăng video
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const history = await dbService.getHistory(req.user.id);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Lấy thông tin Quota API
router.get('/quota', (req, res) => {
  try {
    const quota = dbService.getQuotaUsage();
    res.json({ success: true, quota });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Danh mục chuẩn YouTube
router.get('/categories', (req, res) => {
  const categories = [
    { id: '22', title: 'People & Blogs (Mọi người & Blog)' },
    { id: '24', title: 'Entertainment (Giải trí)' },
    { id: '20', title: 'Gaming (Trò chơi điện tử)' },
    { id: '27', title: 'Education (Giáo dục)' },
    { id: '28', title: 'Science & Technology (Khoa học & Công nghệ)' },
    { id: '26', title: 'Howto & Style (Hướng dẫn & Phong cách)' },
    { id: '10', title: 'Music (Âm nhạc)' },
    { id: '1',  title: 'Film & Animation (Phim & Hoạt hình)' },
    { id: '23', title: 'Comedy (Hài kịch)' },
    { id: '25', title: 'News & Politics (Tin tức & Chính trị)' },
    { id: '17', title: 'Sports (Thể thao)' },
    { id: '19', title: 'Travel & Events (Du lịch & Sự kiện)' }
  ];
  res.json({ success: true, categories });
});

module.exports = router;
