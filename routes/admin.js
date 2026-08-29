const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 1. Lấy danh sách tất cả tài khoản Test
router.get('/test-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const testUsers = await dbService.getTestUsers();
    res.json({ success: true, users: testUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách tài khoản test: ' + err.message });
  }
});

// 2. Admin cấp tài khoản Test mới cho khách hàng (Tự động khóa sau 10 phút sử dụng)
router.post('/create-test-user', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, durationMinutes } = req.body;
    const duration = Number(durationMinutes) || 10;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Email và Mật khẩu cấp cho khách hàng.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const existingUser = await dbService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: `Email ${email} đã tồn tại trong hệ thống.` });
    }

    const newUser = await dbService.createTestUser({
      email,
      password,
      name: name || 'Khách hàng dùng thử',
      durationMinutes: duration,
      createdBy: req.user.email
    });

    res.json({
      success: true,
      message: `Đã tạo tài khoản test thành công (Hạn mức: ${duration} phút).`,
      user: {
        id: newUser._id ? newUser._id.toString() : newUser.id,
        email: newUser.email,
        name: newUser.name,
        plainPassword: password,
        durationMinutes: duration,
        expiresAt: newUser.expiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tạo tài khoản test: ' + err.message });
  }
});

// 3. Admin gia hạn thời gian cho tài khoản Test (+10p, +30p,...)
router.post('/extend-test-user/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { minutes } = req.body;
    const additionalMinutes = Number(minutes) || 10;
    const updatedUser = await dbService.extendTestUser(req.params.id, additionalMinutes);

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để gia hạn.' });
    }

    res.json({
      success: true,
      message: `Đã gia hạn thêm ${additionalMinutes} phút và mở khóa tài khoản thành công!`,
      expiresAt: updatedUser.expiresAt
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi gia hạn tài khoản: ' + err.message });
  }
});

// 4. Admin khóa / mở khóa thủ công tài khoản
router.post('/toggle-lock-user/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updatedUser = await dbService.toggleLockUser(req.params.id);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    res.json({
      success: true,
      isLocked: updatedUser.isLocked,
      message: updatedUser.isLocked ? 'Đã khóa tài khoản thành công.' : 'Đã mở khóa tài khoản thành công.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi thao tác khóa tài khoản: ' + err.message });
  }
});

// 5. Admin xóa tài khoản Test
router.delete('/test-users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbService.deleteTestUser(req.params.id);
    res.json({ success: true, message: 'Đã xóa tài khoản test thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xóa tài khoản test: ' + err.message });
  }
});

module.exports = router;
