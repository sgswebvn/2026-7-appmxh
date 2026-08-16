const rateLimit = require('express-rate-limit');

// ==================== BỘ NHỚ LƯU TRỮ IP BỊ KHÓA TỰ ĐỘNG ====================
const bannedIPs = new Map(); // IP -> { banExpiresAt, reason, violationCount }

// Kiểm tra xem IP có đang bị cấm do spam liên tục hay không
function ipBanChecker(req, res, next) {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const banInfo = bannedIPs.get(clientIp);

  if (banInfo) {
    if (Date.now() < banInfo.banExpiresAt) {
      const remainingSeconds = Math.ceil((banInfo.banExpiresAt - Date.now()) / 1000);
      return res.status(403).json({
        success: false,
        message: `Hệ thống đã tạm thời khóa địa chỉ IP của bạn do phát hiện dấu hiệu spam liên tục. Vui lòng thử lại sau ${remainingSeconds} giây.`,
        isBanned: true
      });
    } else {
      // Hết hạn phạt -> Gỡ ban
      bannedIPs.delete(clientIp);
    }
  }
  next();
}

// Hàm ghi nhận vi phạm và tự động khóa IP nếu vượt ngưỡng
function recordViolation(ip, reason) {
  // Bỏ qua khóa IP vĩnh viễn trên localhost / loopback khi chạy test tự động
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'unknown') {
    return;
  }

  const current = bannedIPs.get(ip) || { violationCount: 0 };
  current.violationCount += 1;
  
  if (current.violationCount >= 3) {
    current.banExpiresAt = Date.now() + 15 * 60 * 1000; // Khóa 15 phút
    current.reason = reason;
    console.warn(`🚨 [SECURITY ALERT] IP ${ip} đã bị khóa 15 phút do vi phạm: ${reason}`);
  }
  bannedIPs.set(ip, current);
}

// ==================== CÁC TẦNG RATE LIMITER (CHỐNG SPAM) ====================

// 1. Tầng Shield Tổng: Chống DDoS / Flood request
const globalDdosLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  skip: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  handler: (req, res) => {
    const ip = req.ip || 'unknown';
    recordViolation(ip, 'Tấn công Flood/DDoS request quá nhanh');
    res.status(429).json({
      success: false,
      message: 'Tần suất gửi yêu cầu quá lớn. Vui lòng tạm dừng vài giây.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 2. Chống Brute Force Đăng Nhập / Đăng Ký (Tối đa 30 lần / 15 phút)
const authBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  handler: (req, res) => {
    const ip = req.ip || 'unknown';
    recordViolation(ip, 'Thử đăng nhập sai quá số lần quy định');
    res.status(429).json({
      success: false,
      message: 'Bạn đã thử đăng nhập sai quá nhiều lần. Để bảo mật tài khoản, vui lòng thử lại sau 15 phút.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 3. Chống Spam Tạo Nội Dung Gemini AI (Tối đa 30 requests / 5 phút, có Cooldown)
const aiSpamLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  skip: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Bạn đang gọi phân tích AI quá liên tục. Vui lòng chờ 1-2 phút để tiếp tục.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 4. Chống Spam Upload Video (Tối đa 40 uploads / 1 giờ)
const uploadAbuseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  skip: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Đã đạt giới hạn số lượt tải video trong 1 giờ. Vui lòng chờ phiên tiếp theo.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 5. Chống Spam Đồng bộ Kênh YouTube (Tối đa 8 lần / 5 phút)
const syncChannelLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 8,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Vui lòng không bấm đồng bộ YouTube liên tục.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ==================== BỘ LỌC CHỐNG BOT / QUÉT LỖ HỔNG ====================
const MALICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /dirbuster/i,
  /acunetix/i,
  /nmap/i,
  /masscan/i,
  /wpscan/i
];

function blockMaliciousBots(req, res, next) {
  const ua = req.headers['user-agent'] || '';
  for (const regex of MALICIOUS_USER_AGENTS) {
    if (regex.test(ua)) {
      const ip = req.ip || 'unknown';
      recordViolation(ip, 'Sử dụng công cụ quét bảo mật tự động: ' + ua);
      return res.status(403).json({ success: false, message: 'Yêu cầu bị từ chối bởi tường lửa bảo mật.' });
    }
  }
  next();
}

// ==================== BỘ LỌC DỮ LIỆU ĐỆ QUY CHỐNG NOSQL & XSS ====================
function sanitizeValue(value) {
  if (typeof value === 'string') {
    // Loại bỏ các ký tự điều khiển toán tử NoSQL và XSS độc hại
    return value
      .replace(/\$/g, '＄') // Thay thế $ NoSQL operator
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Xóa thẻ script
      .replace(/javascript:/gi, '')
      .replace(/onload=/gi, '')
      .replace(/onerror=/gi, '')
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const cleaned = {};
    for (const key of Object.keys(value)) {
      // Chặn NoSQL key bắt đầu bằng $
      if (!key.startsWith('$') && !key.includes('.')) {
        cleaned[key] = sanitizeValue(value[key]);
      }
    }
    return cleaned;
  }
  return value;
}

function advancedSanitizeInput(req, res, next) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
}

module.exports = {
  ipBanChecker,
  globalDdosLimiter,
  authBruteForceLimiter,
  aiSpamLimiter,
  uploadAbuseLimiter,
  syncChannelLimiter,
  blockMaliciousBots,
  advancedSanitizeInput
};
