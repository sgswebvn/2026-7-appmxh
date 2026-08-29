const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const dbService = require('../services/dbService');
const youtubeService = require('../services/youtubeService');
const { authenticateToken, optionalAuth, JWT_SECRET } = require('../middleware/auth');
const { authBruteForceLimiter } = require('../middleware/security');

// 1. Đăng ký tài khoản (Đã khóa công khai - Chỉ Admin cấp tài khoản)
router.post('/register', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Hệ thống đã khóa đăng ký tự do. Vui lòng liên hệ Quản trị viên (Admin) để được cấp tài khoản sử dụng.'
  });
});

// 2. Đăng nhập tài khoản
router.post('/login', authBruteForceLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Email và Mật khẩu hợp lệ.' });
    }

    const user = await dbService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    // Kiểm tra khóa hoặc hết hạn dùng thử
    const lockStatus = dbService.checkUserLockAndExpiry(user);
    if (!lockStatus.canAccess) {
      return res.status(403).json({
        success: false,
        isExpired: lockStatus.isExpired,
        isLocked: lockStatus.isLocked,
        message: lockStatus.isExpired
          ? 'Tài khoản dùng thử đã hết hạn 10 phút sử dụng. Vui lòng liên hệ Quản trị viên (Admin) để được gia hạn.'
          : 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên (Admin).'
      });
    }

    const userId = user._id ? user._id.toString() : user.id;
    const token = jwt.sign({ id: userId, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        isTestAccount: Boolean(user.isTestAccount),
        expiresAt: user.expiresAt || null,
        isLocked: Boolean(user.isLocked),
        remainingSeconds: lockStatus.remainingSeconds,
        geminiApiKey: user.geminiApiKey || ''
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập: ' + err.message });
  }
});

// 3. Lấy thông tin User hiện tại
router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// 4. Cập nhật Gemini API Key cho User
router.put('/gemini-key', authenticateToken, async (req, res) => {
  try {
    const { geminiApiKey } = req.body;
    await dbService.updateUserGeminiKey(req.user.id, geminiApiKey || '');
    res.json({ success: true, message: 'Đã lưu Gemini API Key thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Lấy URL cấp quyền Google OAuth
router.get('/url', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : (req.query.userId || 'default_user');
    
    // Tự động nhận diện domain hiện tại (Vercel HTTPS hoặc Localhost)
    const host = req.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
    const dynamicRedirectUri = `${protocol}://${host}/api/auth/callback/google`;
    
    let redirectUri = dynamicRedirectUri;
    if (process.env.GOOGLE_REDIRECT_URI && !process.env.GOOGLE_REDIRECT_URI.includes('localhost')) {
      redirectUri = process.env.GOOGLE_REDIRECT_URI;
    }

    const authUrl = youtubeService.getAuthUrl(userId, redirectUri);
    res.json({ success: true, authUrl, redirectUri });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Xử lý Callback Google OAuth
router.get('/callback/google', async (req, res) => {
  const { code, state, error } = req.query;
  const userId = state || 'default_user';

  const host = req.get('host') || 'localhost:3000';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const protocol = req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
  const dynamicRedirectUri = `${protocol}://${host}/api/auth/callback/google`;
  
  let redirectUri = dynamicRedirectUri;
  if (process.env.GOOGLE_REDIRECT_URI && !process.env.GOOGLE_REDIRECT_URI.includes('localhost')) {
    redirectUri = process.env.GOOGLE_REDIRECT_URI;
  }

  if (error) {
    return res.send(`
      <html>
        <body style="background:#0b0d13;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
          <h2>Đăng nhập không thành công: ${error}</h2>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('Không nhận được mã ủy quyền từ Google.');
  }

  try {
    const channelData = await youtubeService.handleOAuthCallback(code, userId, redirectUri);

    res.send(`
      <html>
        <head>
          <title>Liên kết Kênh thành công</title>
          <style>
            body {
              background: #0b0d13;
              color: #f8fafc;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            .card {
              background: #121620;
              padding: 28px 36px;
              border-radius: 12px;
              border: 1px solid #202636;
            }
            .avatar {
              width: 64px;
              height: 64px;
              border-radius: 50%;
              border: 2px solid #dc2626;
              margin-bottom: 12px;
            }
            h2 { color: #ffffff; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            ${channelData.thumbnailUrl ? `<img src="${channelData.thumbnailUrl}" class="avatar" alt="Avatar"/>` : ''}
            <h2>Đã liên kết kênh YouTube thành công!</h2>
            <p><strong>${channelData.title}</strong> (${channelData.email || 'Google Account'})</p>
            <p style="color: #94a3b8; font-size: 13px;">Cửa sổ này sẽ tự động đóng sau 2 giây...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS', channel: ${JSON.stringify(channelData)} }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.status(500).send(`
      <html>
        <body style="background:#0b0d13;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
          <h2>Lỗi xác thực kênh: ${err.message}</h2>
        </body>
      </html>
    `);
  }
});

module.exports = router;
