const jwt = require('jsonwebtoken');
const dbService = require('../services/dbService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_2026';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để tiếp tục (Thiếu Auth Token).'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbService.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc phiên đăng nhập đã hết hạn.'
      });
    }

    // Kiểm tra tài khoản có bị khóa hoặc hết hạn dùng thử (10 phút)
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

    req.user = {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      name: user.name,
      geminiApiKey: user.geminiApiKey || '',
      role: user.role || 'user',
      isTestAccount: Boolean(user.isTestAccount),
      expiresAt: user.expiresAt || null,
      isLocked: Boolean(user.isLocked),
      remainingSeconds: lockStatus.remainingSeconds
    };

    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
    });
  }
}

// Middleware chỉ cho phép Quản trị viên (Admin)
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Quyền truy cập bị từ chối. Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.'
    });
  }
  next();
}

// Optional Auth (cho phép lấy thông tin nếu có token, không bắt buộc)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await dbService.findUserById(decoded.id);
      if (user) {
        const lockStatus = dbService.checkUserLockAndExpiry(user);
        req.user = {
          id: user._id ? user._id.toString() : user.id,
          email: user.email,
          name: user.name,
          geminiApiKey: user.geminiApiKey || '',
          role: user.role || 'user',
          isTestAccount: Boolean(user.isTestAccount),
          expiresAt: user.expiresAt || null,
          isLocked: Boolean(user.isLocked),
          remainingSeconds: lockStatus.remainingSeconds
        };
      }
    } catch (e) {
      // Ignored for optional
    }
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  JWT_SECRET
};
