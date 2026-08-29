const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const queueService = require('../services/queueService');
const { authenticateToken } = require('../middleware/auth');
const { uploadAbuseLimiter } = require('../middleware/security');

// Cấu hình thư mục uploads tạm
const UPLOADS_DIR = process.env.VERCEL ? path.join(os.tmpdir(), 'ytb_uploads') : path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {}

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

// 1. Tiếp nhận phân phối Video (Đưa vào Hàng đợi Tải lên Nền - Background Queue)
router.post('/', authenticateToken, uploadAbuseLimiter, upload.fields([
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

  try {
    // Khởi tạo Background Job
    const job = queueService.createUploadJob({
      userId: req.user.id,
      videoFile,
      thumbnailFile,
      selectedChannelIds,
      baseMetadata,
      channelOverrides
    });

    res.json({
      success: true,
      message: `Đã đưa tiến trình tải lên ${selectedChannelIds.length} kênh vào hàng đợi xử lý nền.`,
      jobId: job.id,
      totalChannels: selectedChannelIds.length
    });
  } catch (err) {
    console.error('Queue Dispatch Error:', err);
    if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
    if (thumbnailFile && fs.existsSync(thumbnailFile.path)) fs.unlinkSync(thumbnailFile.path);
    res.status(500).json({ success: false, message: 'Lỗi đưa vào hàng đợi: ' + err.message });
  }
});

// 2. Tra cứu tiến độ Job thời gian thực (Polling endpoint)
router.get('/job/:jobId', authenticateToken, (req, res) => {
  const jobStatus = queueService.getJobStatus(req.params.jobId);
  if (!jobStatus) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tiến trình tải lên này.' });
  }
  res.json({ success: true, job: jobStatus });
});

module.exports = router;
