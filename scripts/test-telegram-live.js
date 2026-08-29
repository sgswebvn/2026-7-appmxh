require('dotenv').config();
const telegramBotService = require('../services/telegramBotService');

async function testSend() {
  console.log('--- ĐANG GỬI TIN NHẮN TỚI TELEGRAM ---');
  console.log('Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? 'Đã tìm thấy Token' : 'Thiếu Token');
  console.log('Chat ID:', process.env.TELEGRAM_CHAT_ID);

  const message = `
🚀 <b>SOCIAL CONTENT FACTORY — KẾT NỐI TELEGRAM THÀNH CÔNG!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Hệ thống tự động hóa nội dung đa kênh đã liên kết thành công với tài khoản Telegram của bạn!

📊 <b>Trạng thái hệ thống:</b> 100% Hoạt động (All Systems Operational)
🤖 <b>Multi-AI Pool:</b> Active (Groq + Gemini + OpenRouter)
🎬 <b>Auto-Pilot Engine:</b> Sẵn sàng vận hành 1-click
📈 <b>AI Growth Advisor:</b> Đã kích hoạt
━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ <i>${new Date().toLocaleString('vi-VN')}</i>
`;

  const res = await telegramBotService.sendMessage({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    message
  });

  console.log('Kết quả trả về từ Telegram API:');
  console.log(JSON.stringify(res, null, 2));
}

testSend();
