require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { connectDB } = require('./config/db');
const dbService = require('./services/dbService');
const autoFixService = require('./services/autoFixService');

// Import Middleware Bảo Mật
const {
  ipBanChecker,
  globalDdosLimiter,
  blockMaliciousBots,
  advancedSanitizeInput
} = require('./middleware/security');

// Import Modular Routers
const authRoutes = require('./routes/auth');
const brandRoutes = require('./routes/brands');
const channelRoutes = require('./routes/channels');
const uploadRoutes = require('./routes/upload');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const contentRoutes = require('./routes/content');
const plannerRoutes = require('./routes/planner');
const socialRoutes = require('./routes/social');
const voiceRoutes = require('./routes/voice');
const videoRoutes = require('./routes/video');
const telegramRoutes = require('./routes/telegram');
const browserRoutes = require('./routes/browser');
const clipperRoutes = require('./routes/clipper');
const capcutRoutes = require('./routes/capcut');
const generalRoutes = require('./routes/general');

const app = express();
const PORT = process.env.PORT || 3000;

// Thư mục uploads tạm
const UPLOADS_DIR = process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Bỏ qua lỗi read-only filesystem trên serverless
}

// ==================== MIDDLEWARE & LỚP BẢO MẬT ====================

// 1. Tự động kết nối DB khi chạy Serverless trên Vercel
let isDbInitialized = false;
app.use(async (req, res, next) => {
  if (!isDbInitialized && process.env.MONGODB_URI) {
    try {
      await connectDB();
      await dbService.initDefaultAdmin();
      isDbInitialized = true;
    } catch (err) {
      console.warn('DB Init Serverless Error:', err.message);
    }
  }
  next();
});

// 2. Nén phản hồi HTTP Gzip/Brotli
app.use(compression({ threshold: 1024 }));

// 3. Bảo vệ HTTP Headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 4. Kiểm tra danh sách IP bị cấm do spam liên tục
app.use(ipBanChecker);

// 5. Chặn công cụ quét lỗ hổng và bot độc hại
app.use(blockMaliciousBots);

// 6. Tường lửa chống DDoS / Flood request
app.use(globalDdosLimiter);

// 7. CORS & Body Parsers
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 8. Bộ lọc chống NoSQL & XSS Injection
app.use(advancedSanitizeInput);

const PUBLIC_DIR = fs.existsSync(path.join(process.cwd(), 'public'))
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

// ==================== ĐỊNH TUYẾN MÔ-ĐUN (MODULAR ROUTES) ====================

app.use('/api/auth', authRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/browser', browserRoutes);
app.use('/api/clipper', clipperRoutes);
app.use('/api/capcut', capcutRoutes);
app.use('/api', generalRoutes);

// Trang giao diện chính
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
    if (err && !res.headersSent) res.status(200).send('<h1>Social Content Factory API Active</h1>');
  });
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'), (err) => {
    if (err && !res.headersSent) res.redirect('/');
  });
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'privacy.html'), (err) => {
    if (err && !res.headersSent) res.status(404).send('Privacy policy not found');
  });
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'terms.html'), (err) => {
    if (err && !res.headersSent) res.status(404).send('Terms of service not found');
  });
});

app.get('/:filename.txt', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, `${req.params.filename}.txt`);
  if (fs.existsSync(filePath)) {
    res.type('text/plain').sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/register', (req, res) => {
  res.redirect('/login');
});

// ==================== KHỞI CHẠY MÁY CHỦ ====================

function startServer() {
  const server = app.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(`🛡️ YouTube Multi-Publisher v3.0 (Background Queue & Modular Active)`);
    console.log(`🚀 Đang chạy tại: http://localhost:${PORT}`);
    console.log(`👑 Tài khoản Admin: admin@admin.com / admin123`);
    console.log(`====================================================`);

    // Kết nối MongoDB và khởi tạo Admin
    try {
      await connectDB();
      await dbService.initDefaultAdmin();
    } catch (e) {
      console.warn('Lỗi kết nối DB ban đầu:', e.message);
    }

    // Khởi động tiến trình dọn dẹp file tạm rác theo chu kỳ
    if (!process.env.VERCEL) {
      autoFixService.startPeriodicTempClean(UPLOADS_DIR, 60);
    }
  });

  process.on('SIGTERM', () => {
    console.log('Đang đóng máy chủ an toàn...');
    server.close(() => process.exit(0));
  });

  return server;
}

if (process.env.VERCEL) {
  connectDB().then(() => dbService.initDefaultAdmin());
} else {
  startServer();
}

module.exports = app;
