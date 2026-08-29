const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');

// 1. Lấy danh sách Brand của User
router.get('/', authenticateToken, async (req, res) => {
  try {
    const brands = await dbService.getBrands(req.user.id);
    res.json({ success: true, brands });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách Brand: ' + err.message });
  }
});

// 2. Tạo Brand mới
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, targetAudience, toneOfVoice, primaryColor } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên Brand / Thương hiệu.' });
    }

    const brand = await dbService.createBrand(req.user.id, {
      name: name.trim(),
      description: description || '',
      targetAudience: targetAudience || 'Khán giả đại chúng',
      toneOfVoice: toneOfVoice || 'Hấp dẫn, kích thích tò mò',
      primaryColor: primaryColor || '#e11d48'
    });

    res.json({ success: true, message: 'Đã tạo Brand thành công!', brand });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tạo Brand: ' + err.message });
  }
});

// 3. Cập nhật Brand
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, targetAudience, toneOfVoice, primaryColor, socialChannels } = req.body;
    const updated = await dbService.updateBrand(req.user.id, req.params.id, {
      name,
      description,
      targetAudience,
      toneOfVoice,
      primaryColor,
      socialChannels
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Brand để cập nhật.' });
    }

    res.json({ success: true, message: 'Đã cập nhật Brand thành công!', brand: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi cập nhật Brand: ' + err.message });
  }
});

// 4. Xóa Brand
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await dbService.deleteBrand(req.user.id, req.params.id);
    res.json({ success: true, message: 'Đã xóa Brand thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xóa Brand: ' + err.message });
  }
});

module.exports = router;
