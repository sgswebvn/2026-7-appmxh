const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');

// 1. Lấy danh sách Content Projects của Brand
router.get('/', authenticateToken, async (req, res) => {
  try {
    const brandId = req.query.brandId || null;
    const projects = await dbService.getContentProjects(req.user.id, brandId);
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách dự án content: ' + err.message });
  }
});

// 2. Tạo Content Project mới (Idea / Script)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { brandId, title, topic, contentType, status, scriptData, seoMetadata } = req.body;
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tiêu đề bài viết / kịch bản.' });
    }

    const project = await dbService.createContentProject(req.user.id, {
      brandId: brandId || '',
      title: title.trim(),
      topic: topic || '',
      contentType: contentType || 'SHORT',
      status: status || 'IDEA',
      scriptData,
      seoMetadata
    });

    res.json({ success: true, message: 'Đã lưu vào Kho Nội Dung (Content Library)!', project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tạo dự án content: ' + err.message });
  }
});

// 3. Cập nhật Content Project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await dbService.updateContentProject(req.user.id, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nội dung để cập nhật.' });
    }
    res.json({ success: true, message: 'Đã cập nhật nội dung thành công!', project: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật content: ' + err.message });
  }
});

// 4. Xóa Content Project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await dbService.deleteContentProject(req.user.id, req.params.id);
    res.json({ success: true, message: 'Đã xóa nội dung khỏi thư viện.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xóa content: ' + err.message });
  }
});

module.exports = router;
