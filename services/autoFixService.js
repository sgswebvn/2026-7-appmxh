const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// ==================== BỘ TỰ ĐỘNG CHẨN ĐOÁN & SỬA LỖI (SELF-HEALING ENGINE) ====================

class AutoFixEngine {
  constructor() {
    this.retryCounters = new Map();
    this.circuitBreakers = new Map();
  }

  // 1. Tự động sửa lỗi Tiêu đề & Metadata trước khi gửi lên YouTube
  autoFixVideoMetadata(metadata) {
    const fixed = { ...metadata };

    // YouTube quy định Tiêu đề tối đa 100 ký tự
    if (fixed.title && fixed.title.length > 100) {
      console.warn(`[AutoFix] Tiêu đề quá dài (${fixed.title.length} ký tự). Tự động cắt gọn xuống 97 ký tự.`);
      fixed.title = fixed.title.substring(0, 97) + '...';
    }

    // YouTube quy định toàn bộ Tags tối đa 500 ký tự
    if (fixed.tags) {
      let tagArray = Array.isArray(fixed.tags) ? fixed.tags : fixed.tags.split(',').map(t => t.trim()).filter(Boolean);
      let totalLength = 0;
      const validTags = [];
      for (const tag of tagArray) {
        if (totalLength + tag.length + 1 <= 490) {
          validTags.push(tag);
          totalLength += tag.length + 1;
        }
      }
      fixed.tags = validTags;
    }

    // Tự động gán danh mục mặc định nếu rỗng
    if (!fixed.categoryId) {
      fixed.categoryId = '22'; // People & Blogs
    }

    return fixed;
  }

  // 2. Tự động làm sạch file rác mồ côi khi xảy ra lỗi upload
  autoCleanOrphanFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[AutoFix] Đã tự động dọn dẹp file tạm: ${filePath}`);
      } catch (err) {
        console.warn(`[AutoFix] Không thể xóa file tạm ${filePath}:`, err.message);
      }
    }
  }

  // 3. Tự động kiểm tra và phục hồi kết nối MongoDB Atlas
  async autoRecoverMongoConnection(connectDBFunc) {
    if (mongoose.connection.readyState !== 1) {
      console.warn('[AutoFix] Phát hiện mất kết nối MongoDB Atlas. Đang kích hoạt tiến trình tự phục hồi...');
      try {
        await connectDBFunc();
        console.log('[AutoFix] Đã phục hồi kết nối MongoDB Atlas thành công!');
        return true;
      } catch (err) {
        console.error('[AutoFix] Chưa thể kết nối lại Atlas, chuyển sang bộ đệm Resilience Local.');
        return false;
      }
    }
    return true;
  }

  // 4. Cơ chế Tự Động Thử Lại (Exponential Backoff Retry) cho các lỗi mạng
  async executeWithAutoRetry(fn, maxRetries = 3, initialDelayMs = 1000, operationName = 'Task') {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        const isNetworkError = error.code === 'ECONNRESET' || 
                               error.code === 'ETIMEDOUT' || 
                               error.code === 'ENOTFOUND' ||
                               (error.response && [500, 502, 503, 504].includes(error.response.status));

        if (!isNetworkError || attempt >= maxRetries) {
          throw error;
        }

        console.warn(`[AutoFix] ${operationName} gặp lỗi mạng (${error.message}). Đang tự động thử lại lần ${attempt}/${maxRetries} sau ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Tăng thời gian chờ theo hàm mũ
      }
    }
  }

  // 5. Tự động quét và dọn dẹp thư mục Uploads theo chu kỳ
  startPeriodicTempClean(uploadsDir, maxAgeMinutes = 60) {
    setInterval(() => {
      if (!fs.existsSync(uploadsDir)) return;
      fs.readdir(uploadsDir, (err, files) => {
        if (err) return;
        const now = Date.now();
        files.forEach(file => {
          const filePath = path.join(uploadsDir, file);
          fs.stat(filePath, (statErr, stats) => {
            if (!statErr) {
              const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);
              if (ageMinutes > maxAgeMinutes) {
                fs.unlink(filePath, () => {
                  console.log(`[AutoFix] Tự động giải phóng dung lượng đĩa: Đã xóa file tạm cũ ${file}`);
                });
              }
            }
          });
        });
      });
    }, 15 * 60 * 1000); // Chạy định kỳ mỗi 15 phút
  }
}

module.exports = new AutoFixEngine();
