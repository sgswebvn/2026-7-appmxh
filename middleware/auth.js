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

    req.user = {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      name: user.name,
      geminiApiKey: user.geminiApiKey || ''
    };

    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
    });
  }
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
        req.user = {
          id: user._id ? user._id.toString() : user.id,
          email: user.email,
          name: user.name,
          geminiApiKey: user.geminiApiKey || ''
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
  optionalAuth,
  JWT_SECRET
};
