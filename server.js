require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { connectDB, getMongoStatus } = require('./config/db');
const dbService = require('./services/dbService');
const youtubeService = require('./services/youtubeService');
const geminiService = require('./services/geminiService');
const { authenticateToken, requireAdmin, optionalAuth, JWT_SECRET } = require('./middleware/auth');
const {
  ipBanChecker,
  globalDdosLimiter,
  authBruteForceLimiter,
  aiSpamLimiter,
  uploadAbuseLimiter,
  syncChannelLimiter,
  blockMaliciousBots,
  advancedSanitizeInput
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo thư mục uploads tạm
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Cấu hình Multer Upload chịu tải cao (Hỗ trợ file video tới 5GB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 } // Hỗ trợ video tối đa 5GB
});

// ==================== LỚP BẢO MẬT & NÉN TỐI ƯU HIỆU NĂNG ====================

// 1. Nén phản hồi HTTP Gzip/Brotli giúp giảm 70% băng thông tải trang
app.use(compression({
  threshold: 1024 // Chỉ nén payload > 1KB
}));

// 2. Bảo vệ HTTP Headers toàn diện
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 3. Kiểm tra danh sách IP bị cấm do spam liên tục
app.use(ipBanChecker);

// 4. Chặn các công cụ quét lỗ hổng và bot độc hại
app.use(blockMaliciousBots);

// 5. Tường lửa chống DDoS / Flood request
app.use(globalDdosLimiter);

// 6. CORS & Parser
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 7. Bộ lọc dữ liệu đầu vào chống NoSQL & XSS Injection
app.use(advancedSanitizeInput);

// 8. Tệp tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Routes trang giao diện
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ==================== AUTHENTICATION APIS (BẢO VỆ CHỐNG BRUTE-FORCE) ====================

// 1. Đăng ký tài khoản
app.post('/api/auth/register', authBruteForceLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Email và Mật khẩu.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    const existingUser = await dbService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email này đã được đăng ký. Vui lòng đăng nhập.' });
    }

    const user = await dbService.createUser({ email, password, name });
    const userId = user._id ? user._id.toString() : user.id;

    const token = jwt.sign({ id: userId, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        isTestAccount: false,
        geminiApiKey: user.geminiApiKey || ''
      }
    });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng ký: ' + err.message });
  }
});

// 2. Đăng nhập tài khoản (Kiểm tra khóa và thời hạn 10 phút)
app.post('/api/auth/login', authBruteForceLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Email và Mật khẩu.' });
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

// 3. Đăng nhập nhanh tài khoản Test (1-Click)
app.post('/api/auth/quick-test', async (req, res) => {
  try {
    const testEmail = 'admin@test.com';
    let user = await dbService.findUserByEmail(testEmail);
    if (!user) {
      user = await dbService.createUser({
        email: testEmail,
        password: 'password123',
        name: 'Demo Creator',
        geminiApiKey: ''
      });
    }

    const lockStatus = dbService.checkUserLockAndExpiry(user);
    const userId = user._id ? user._id.toString() : user.id;
    const token = jwt.sign({ id: userId, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Đăng nhập tài khoản Test thành công!',
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
    res.status(500).json({ success: false, message: 'Lỗi đăng nhập nhanh: ' + err.message });
  }
});

// 4. Lấy thông tin User hiện tại
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// 5. Cập nhật Gemini API Key cho User
app.put('/api/auth/gemini-key', authenticateToken, async (req, res) => {
  try {
    const { geminiApiKey } = req.body;
    await dbService.updateUserGeminiKey(req.user.id, geminiApiKey || '');
    res.json({ success: true, message: 'Đã lưu Gemini API Key thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== ADMIN MANAGEMENT APIS ====================

// Lấy danh sách tất cả tài khoản Test
app.get('/api/admin/test-users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const testUsers = await dbService.getTestUsers();
    res.json({ success: true, users: testUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách tài khoản test: ' + err.message });
  }
});

// Admin tạo tài khoản Test mới (Tự động khóa sau 10 phút sử dụng hoặc thời gian tùy chọn)
app.post('/api/admin/create-test-user', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { email, password, name, durationMinutes } = req.body;
    durationMinutes = Number(durationMinutes) || 10;

    // Nếu không nhập email/password, tự động sinh ngẫu nhiên
    if (!email || email.trim() === '') {
      const randStr = Math.random().toString(36).substring(2, 7);
      email = `test_${randStr}@demo.local`;
    }

    if (!password || password.trim() === '') {
      const randPass = Math.floor(100000 + Math.random() * 900000);
      password = `pass${randPass}`;
    }

    const existingUser = await dbService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: `Email ${email} đã tồn tại trong hệ thống.` });
    }

    const newUser = await dbService.createTestUser({
      email,
      password,
      name: name || `Test User (${durationMinutes}m)`,
      durationMinutes,
      createdBy: req.user.email
    });

    res.json({
      success: true,
      message: `Đã tạo tài khoản test thành công (Hạn mức: ${durationMinutes} phút).`,
      user: {
        id: newUser._id ? newUser._id.toString() : newUser.id,
        email: newUser.email,
        name: newUser.name,
        plainPassword: password,
        durationMinutes: durationMinutes,
        expiresAt: newUser.expiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tạo tài khoản test: ' + err.message });
  }
});

// Admin gia hạn thời gian cho tài khoản Test (+10p, +30p,...)
app.post('/api/admin/extend-test-user/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// Admin khóa / mở khóa thủ công tài khoản
app.post('/api/admin/toggle-lock-user/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// Admin xóa tài khoản Test
app.delete('/api/admin/test-users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await dbService.deleteTestUser(req.params.id);
    res.json({ success: true, message: 'Đã xóa tài khoản test thành công.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi xóa tài khoản test: ' + err.message });
  }
});

// 6. Kiểm tra trạng thái kết nối Database (MongoDB Atlas)
app.get('/api/health/db', (req, res) => {
  res.json({ success: true, db: getMongoStatus() });
});

// ==================== YOUTUBE OAUTH & CHANNEL APIS ====================

// 7. Lấy URL cấp quyền Google OAuth
app.get('/api/auth/url', optionalAuth, (req, res) => {
  try {
    const userId = req.user ? req.user.id : (req.query.userId || 'default_user');
    const authUrl = youtubeService.getAuthUrl(userId);
    res.json({ success: true, authUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Xử lý Callback Google OAuth
app.get('/api/auth/callback/google', async (req, res) => {
  const { code, state, error } = req.query;
  const userId = state || 'default_user';

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
    const channelData = await youtubeService.handleOAuthCallback(code, userId);

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

// 9. Lấy danh sách kênh của User
app.get('/api/channels', authenticateToken, async (req, res) => {
  try {
    const channels = await dbService.getChannels(req.user.id);
    const safeChannels = channels.map(c => ({
      id: c.channelId || c.id,
      title: c.title,
      customUrl: c.customUrl,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      subscriberCount: c.subscriberCount || 0,
      videoCount: c.videoCount || 0,
      email: c.email,
      channelUrl: c.customUrl ? `https://youtube.com/${c.customUrl.startsWith('@') ? c.customUrl : '@' + c.customUrl}` : `https://youtube.com/channel/${c.channelId || c.id}`,
      createdAt: c.createdAt
    }));
    res.json({ success: true, channels: safeChannels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. Xóa một kênh
app.delete('/api/channels/:id', authenticateToken, async (req, res) => {
  try {
    await dbService.deleteChannel(req.user.id, req.params.id);
    res.json({ success: true, message: 'Đã gỡ kênh khỏi hệ thống.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10.1 Đồng bộ số liệu kênh từ YouTube (Bảo vệ chống spam)
app.post('/api/channels/sync', authenticateToken, syncChannelLimiter, async (req, res) => {
  try {
    const channels = await dbService.getChannels(req.user.id);
    for (const ch of channels) {
      await youtubeService.syncChannelStatsFromYouTube(req.user.id, ch.channelId || ch.id);
    }
    const updatedChannels = await dbService.getChannels(req.user.id);
    const safeChannels = updatedChannels.map(c => ({
      id: c.channelId || c.id,
      title: c.title,
      customUrl: c.customUrl,
      description: c.description,
      thumbnailUrl: c.thumbnailUrl,
      subscriberCount: c.subscriberCount || 0,
      videoCount: c.videoCount || 0,
      email: c.email,
      channelUrl: c.customUrl ? `https://youtube.com/${c.customUrl.startsWith('@') ? c.customUrl : '@' + c.customUrl}` : `https://youtube.com/channel/${c.channelId || c.id}`,
      createdAt: c.createdAt
    }));
    res.json({ success: true, message: 'Đã đồng bộ số liệu mới nhất từ YouTube!', channels: safeChannels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== GEMINI AI STUDIO APIS (CHỐNG SPAM AI) ====================

// 11. Phân tích nội dung và sinh gói Tiêu đề / Mô tả / Tags bằng Gemini AI 2.5 Flash
app.post('/api/ai/analyze', authenticateToken, aiSpamLimiter, async (req, res) => {
  try {
    const { topic, targetAudience, tone, apiKey } = req.body;
    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập chủ đề video.' });
    }

    const channels = await dbService.getChannels(req.user.id);
    const userApiKey = apiKey || req.user.geminiApiKey;

    const result = await geminiService.analyzeAndGenerateContent({
      topic,
      targetAudience: targetAudience || 'Khán giả đại chúng',
      tone: tone || 'Hấp dẫn, kích thích tò mò',
      channels,
      apiKey: userApiKey
    });

    await dbService.saveGeminiDraft(req.user.id, {
      topic,
      targetAudience,
      generatedTitles: result.data.viralTitles,
      generatedDescription: result.data.seoDescription,
      generatedTags: result.data.tags,
      channelVariants: result.data.channelVariants
    });

    res.json({
      success: true,
      isAiGenerated: result.isAiGenerated,
      data: result.data
    });
  } catch (err) {
    console.error('Gemini Analyze Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi phân tích AI: ' + err.message });
  }
});

// 12. Lấy danh sách các bản nháp AI đã tạo
app.get('/api/ai/drafts', authenticateToken, async (req, res) => {
  try {
    const drafts = await dbService.getGeminiDrafts(req.user.id);
    res.json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== VIDEO UPLOAD & DISTRIBUTION API ====================

// 13. Phân phối Video đến nhiều kênh cùng lúc (Chống Spam Upload)
app.post('/api/upload', authenticateToken, uploadAbuseLimiter, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  const videoFile = req.files && req.files['video'] ? req.files['video'][0] : null;
  const thumbnailFile = req.files && req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

  if (!videoFile) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn file video.' });
  }

  let selectedChannelIds = [];
  try {
    selectedChannelIds = typeof req.body.selectedChannels === 'string'
      ? JSON.parse(req.body.selectedChannels)
      : req.body.selectedChannels;
  } catch (e) {
    selectedChannelIds = [req.body.selectedChannels].filter(Boolean);
  }

  if (!selectedChannelIds || selectedChannelIds.length === 0) {
    if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
    if (thumbnailFile && fs.existsSync(thumbnailFile.path)) fs.unlinkSync(thumbnailFile.path);
    return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 kênh để đăng.' });
  }

  let channelOverrides = {};
  try {
    if (req.body.channelOverrides) {
      channelOverrides = typeof req.body.channelOverrides === 'string'
        ? JSON.parse(req.body.channelOverrides)
        : req.body.channelOverrides;
    }
  } catch (e) {}

  const baseMetadata = {
    title: req.body.title || videoFile.originalname,
    description: req.body.description || '',
    tags: req.body.tags || '',
    categoryId: req.body.categoryId || '22',
    privacyStatus: req.body.privacyStatus || 'public',
    madeForKids: req.body.madeForKids === 'true' || req.body.madeForKids === true,
    publishAt: req.body.publishAt || null
  };

  const uploadResults = [];
  const historyRecord = {
    title: baseMetadata.title,
    videoOriginalName: videoFile.originalname,
    fileSize: videoFile.size,
    privacyStatus: baseMetadata.privacyStatus,
    targetCount: selectedChannelIds.length,
    channels: []
  };

  try {
    for (const channelId of selectedChannelIds) {
      const channel = await dbService.getChannelById(req.user.id, channelId);
      const channelTitle = channel ? channel.title : channelId;

      const override = channelOverrides[channelId] || {};
      const channelSpecificMetadata = {
        ...baseMetadata,
        title: override.title ? override.title : baseMetadata.title,
        description: override.description ? override.description : baseMetadata.description,
        tags: override.tags ? override.tags : baseMetadata.tags
      };

      try {
        console.log(`[Upload] Đang upload lên kênh: ${channelTitle}`);
        const result = await youtubeService.uploadVideoToChannel(
          req.user.id,
          channelId,
          videoFile.path,
          channelSpecificMetadata,
          thumbnailFile ? thumbnailFile.path : null
        );

        uploadResults.push({
          channelId,
          channelTitle,
          success: true,
          videoId: result.videoId,
          videoUrl: result.videoUrl,
          thumbnailUploaded: result.thumbnailUploaded
        });

        historyRecord.channels.push({
          channelId,
          channelTitle,
          status: 'success',
          videoId: result.videoId,
          videoUrl: result.videoUrl,
          title: channelSpecificMetadata.title,
          uploadedAt: new Date()
        });
      } catch (channelErr) {
        console.error(`[Upload Error] Thất bại trên kênh ${channelTitle}:`, channelErr.message);
        uploadResults.push({
          channelId,
          channelTitle,
          success: false,
          error: channelErr.message
        });

        historyRecord.channels.push({
          channelId,
          channelTitle,
          status: 'failed',
          error: channelErr.message,
          title: channelSpecificMetadata.title,
          uploadedAt: new Date()
        });
      }
    }

    await dbService.addHistory(req.user.id, historyRecord);

    res.json({
      success: true,
      message: `Đã hoàn tất xử lý cho ${selectedChannelIds.length} kênh.`,
      results: uploadResults
    });
  } catch (globalErr) {
    console.error('Global Upload Error:', globalErr);
    res.status(500).json({ success: false, message: globalErr.message });
  } finally {
    try {
      if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
      if (thumbnailFile && fs.existsSync(thumbnailFile.path)) fs.unlinkSync(thumbnailFile.path);
    } catch (cleanErr) {}
  }
});

// ==================== GENERAL INFO APIS ====================

// 14. Lấy lịch sử đăng video
app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const history = await dbService.getHistory(req.user.id);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 15. Lấy thông tin Quota API
app.get('/api/quota', (req, res) => {
  try {
    const quota = dbService.getQuotaUsage();
    res.json({ success: true, quota });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 16. Danh mục chuẩn YouTube
app.get('/api/categories', (req, res) => {
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

const autoFixService = require('./services/autoFixService');

// Khởi chạy Server và kết nối Database
async function startServer() {
  await connectDB();
  await dbService.initDefaultAdmin();

  // Khởi động tiến trình tự động dọn dẹp file tạm rác theo chu kỳ (môi trường server)
  if (!process.env.VERCEL) {
    autoFixService.startPeriodicTempClean(UPLOADS_DIR, 60);
  }

  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🛡️ YouTube Multi-Publisher v2.5 (Self-Healing & Anti-Spam Active)`);
    console.log(`🚀 Đang chạy tại: http://localhost:${PORT}`);
    console.log(`👑 Tài khoản Admin: admin@admin.com / admin123`);
    console.log(`====================================================`);
  });

  // Graceful Shutdown để bảo toàn dữ liệu khi khởi động lại máy chủ
  process.on('SIGTERM', () => {
    console.log('Đang đóng máy chủ an toàn...');
    server.close(() => process.exit(0));
  });

  return server;
}

// Chạy trực tiếp nếu là file chính, hoặc tự động kết nối DB khi chạy Serverless trên Vercel
if (process.env.VERCEL) {
  connectDB().then(() => dbService.initDefaultAdmin());
} else {
  startServer();
}

module.exports = app;
