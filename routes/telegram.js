const express = require('express');
const router = express.Router();
const telegramBotService = require('../services/telegramBotService');
const { authenticateToken } = require('../middleware/auth');
const dbService = require('../services/dbService');

// 1. Lấy cấu hình Telegram Bot đã lưu từ MongoDB
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const config = await dbService.getUserTelegramConfig(req.user.id);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy cấu hình: ' + err.message });
  }
});

// 2. Lưu cấu hình Telegram Bot vào MongoDB
router.post('/config', authenticateToken, async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    await dbService.updateUserTelegramConfig(req.user.id, { botToken, chatId });
    res.json({ success: true, message: 'Đã lưu cấu hình Telegram Bot vào MongoDB Atlas thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lưu cấu hình: ' + err.message });
  }
});

// 3. Kiểm tra gửi tin nhắn thử nghiệm Telegram Bot
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    if (!botToken || !chatId) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Telegram Bot Token và Chat ID.' });
    }

    const testMessage = `
🤖 <b>KẾT NỐI TELEGRAM BOT THÀNH CÔNG!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
Hệ thống <b>Social Content Factory 2026</b> đã liên kết thành công với tài khoản Telegram của bạn.
Bạn sẽ nhận được thông báo tự động khi:
✅ Auto-Pilot hoàn tất đăng video
📈 Báo cáo tăng trưởng View & Subs
🚨 Cảnh báo kênh hoặc Token
━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ <i>${new Date().toLocaleString('vi-VN')}</i>
`;

    const result = await telegramBotService.sendMessage({
      botToken,
      chatId,
      message: testMessage
    });

    if (result.success) {
      res.json({ success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công đến Telegram!', data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message || 'Lỗi gửi tin nhắn Telegram' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + err.message });
  }
});

// 2. Gửi báo cáo Morning Brief thủ công hoặc qua Cron
router.post('/morning-brief', authenticateToken, async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    const growthAdvisorService = require('../services/growthAdvisorService');
    const reportData = await growthAdvisorService.generateGrowthReport(req.user.id);

    const result = await telegramBotService.notifyMorningGrowthBrief({
      botToken,
      chatId,
      kpis: reportData.stats,
      growthReport: reportData.report
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi gửi Morning Brief: ' + err.message });
  }
});

module.exports = router;
