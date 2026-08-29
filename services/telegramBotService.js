/**
 * ============================================================================
 * TELEGRAM NOTIFICATION BOT SERVICE (PHASE 5 - MODULE 1)
 * ============================================================================
 * - Gửi thông báo tức thì đến Telegram cá nhân hoặc Group khi:
 *   1. Auto-Pilot hoàn tất xuất bản video hàng loạt lên các nhóm kênh.
 *   2. Cảnh báo lỗi xác thực hoặc hết hạn Token mạng xã hội.
 *   3. Bản tin tăng trưởng AI Growth Morning Brief lúc 08:00 sáng.
 */

const https = require('https');
const dbService = require('./dbService');

class TelegramBotService {
  constructor() {
    this.defaultBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.defaultChatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  // 1. Gửi tin nhắn đến Telegram (Hỗ trợ HTML formatting & Inline Buttons)
  async sendMessage({ botToken, chatId, message, parseMode = 'HTML', replyMarkup = null }) {
    const token = botToken || this.defaultBotToken;
    const targetChat = chatId || this.defaultChatId;

    if (!token || !targetChat) {
      return {
        success: false,
        message: 'Chưa cấu hình Telegram Bot Token hoặc Chat ID.'
      };
    }

    const payload = {
      chat_id: targetChat,
      text: message,
      parse_mode: parseMode
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const postData = JSON.stringify(payload);

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => { responseBody += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            if (data.ok) {
              resolve({ success: true, messageId: data.result?.message_id, data: data.result });
            } else {
              resolve({ success: false, message: data.description || 'Lỗi từ Telegram API', error: data });
            }
          } catch (e) {
            resolve({ success: false, message: 'Lỗi parse phản hồi Telegram API', raw: responseBody });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, message: 'Lỗi kết nối Telegram: ' + err.message });
      });

      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ success: false, message: 'Telegram API timeout (quá 8s)' });
      });

      req.write(postData);
      req.end();
    });
  }

  // 2. Gửi thông báo hoàn thành chu trình Auto-Pilot
  async notifyAutoPilotSuccess({ botToken, chatId, cycleId, topic, title, channelsCount, videoUrl }) {
    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const msg = `
🚀 <b>SOCIAL CONTENT FACTORY — AUTO-PILOT THÀNH CÔNG!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Chủ đề:</b> <i>${topic}</i>
🎬 <b>Tiêu đề:</b> <b>${title}</b>
📊 <b>Kênh nhận:</b> ${channelsCount} kênh & fanpage
⏰ <b>Thời gian:</b> ${timeStr}
🆔 <b>Cycle ID:</b> <code>${cycleId?.substring(0, 8) || 'N/A'}</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ <i>Video Shorts/Reels kèm phụ đề Karaoke đã được đưa vào luồng phát thành công!</i>
`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🌐 Mở Dashboard', url: 'https://2026-7-appmxh.vercel.app/#history-tab' }
        ]
      ]
    };

    return this.sendMessage({ botToken, chatId, message: msg, replyMarkup });
  }

  // 3. Gửi bản tin tăng trưởng buổi sáng (Morning AI Growth Brief)
  async notifyMorningGrowthBrief({ botToken, chatId, kpis, growthReport }) {
    const timeStr = new Date().toLocaleDateString('vi-VN');
    const msg = `
☀️ <b>BẢN TIN CHIẾN LƯỢC TĂNG TRƯỞNG SÁNG (${timeStr})</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 <b>Điểm Tăng Trưởng:</b> <b>${growthReport.performanceScore || 85}/100</b>
🎯 <b>Đánh giá:</b> <i>${growthReport.summaryHeadline || 'Hệ thống đang hoạt động tối ưu!'}</i>

📊 <b>SỐ LIỆU ĐA KÊNH:</b>
• Tổng Kênh: <b>${kpis.totalChannels || 0}</b>
• Tổng Lượt Xem: <b>${(kpis.totalViews || 0).toLocaleString()}</b>
• Tổng Đăng Ký: <b>${(kpis.totalSubscribers || 0).toLocaleString()}</b>

⏰ <b>KHUNG GIỜ VÀNG HÔM NAY:</b>
${(growthReport.goldenPostingHours || []).map(h => `⚡ <code>${h.slot}</code>: ${h.reason}`).join('\n')}

💡 <b>GỢI Ý CHỦ ĐỀ VIRAL:</b>
${(growthReport.recommendedTopicsNext || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 <i>Cố vấn chiến lược bởi Social Content Factory Multi-AI Engine.</i>
`;

    return this.sendMessage({ botToken, chatId, message: msg });
  }
}

module.exports = new TelegramBotService();
