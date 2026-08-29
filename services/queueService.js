const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const youtubeService = require('./youtubeService');
const dbService = require('./dbService');
const autoFixService = require('./autoFixService');

/**
 * HỆ THỐNG QUẢN LÝ HÀNG ĐỢI TẢI LÊN NỀN (BACKGROUND UPLOAD QUEUE ENGINE)
 * - Xử lý tải lên video dung lượng lớn (>2GB) trên hàng loạt kênh cùng lúc mà không làm nghẽn I/O.
 * - Kiểm soát giới hạn concurrency (tối đa 2 kênh xử lý đồng thời để tối ưu CPU & Băng thông mạng).
 * - Theo dõi tiến trình thời gian thực theo Job ID (Status, Percent, Progress từng kênh).
 * - Tự động dọn dẹp file video/thumbnail tạm khi tất cả kênh hoàn tất.
 */
class UploadQueueService {
  constructor() {
    this.jobs = new Map(); // jobId -> Job Object
    this.maxConcurrentPerJob = 2; // Giới hạn 2 kênh upload song song mỗi job để tránh nghẽn I/O đĩa
    this.activeWorkers = 0;
    this.maxGlobalWorkers = 4;
  }

  // Khởi tạo một Job Tải Lên mới
  createUploadJob({ userId, videoFile, thumbnailFile, selectedChannelIds, baseMetadata, channelOverrides }) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      userId,
      status: 'pending', // pending, processing, completed, failed
      createdAt: new Date(),
      totalChannels: selectedChannelIds.length,
      completedChannels: 0,
      failedChannels: 0,
      overallProgress: 0,
      videoFile: {
        path: videoFile.path,
        originalname: videoFile.originalname,
        size: videoFile.size
      },
      thumbnailFile: thumbnailFile ? {
        path: thumbnailFile.path,
        originalname: thumbnailFile.originalname
      } : null,
      selectedChannelIds,
      baseMetadata,
      channelOverrides: channelOverrides || {},
      channelsProgress: {}, // channelId -> { status, progress, videoId, videoUrl, error }
      results: [],
      error: null
    };

    // Khởi tạo trạng thái ban đầu cho từng kênh
    selectedChannelIds.forEach(channelId => {
      job.channelsProgress[channelId] = {
        channelId,
        channelTitle: 'Đang xử lý...',
        status: 'queued', // queued, uploading, success, failed
        progress: 0,
        videoId: null,
        videoUrl: null,
        error: null
      };
    });

    this.jobs.set(jobId, job);

    // Kích hoạt tiến trình xử lý nền không chặn luồng chính
    setImmediate(() => this.processJob(jobId));

    return job;
  }

  // Lấy thông tin trạng thái Job
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      id: job.id,
      status: job.status,
      totalChannels: job.totalChannels,
      completedChannels: job.completedChannels,
      failedChannels: job.failedChannels,
      overallProgress: job.overallProgress,
      channelsProgress: Object.values(job.channelsProgress),
      results: job.results,
      error: job.error,
      createdAt: job.createdAt
    };
  }

  // Tiến trình thực thi tải lên từng kênh trong hàng đợi
  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'processing' || job.status === 'completed') return;

    job.status = 'processing';
    console.log(`🚀 [Background Queue] Bắt đầu xử lý Job ID: ${jobId} (${job.totalChannels} kênh)`);

    const historyRecord = {
      title: job.baseMetadata.title,
      videoOriginalName: job.videoFile.originalname,
      fileSize: job.videoFile.size,
      privacyStatus: job.baseMetadata.privacyStatus,
      targetCount: job.totalChannels,
      channels: []
    };

    const channelList = [...job.selectedChannelIds];

    // Xử lý các kênh theo đợt (Batch/Concurrency Limit) để bảo vệ tài nguyên máy chủ
    const processChannel = async (channelId) => {
      const channelProgress = job.channelsProgress[channelId];
      channelProgress.status = 'uploading';
      channelProgress.progress = 10;
      this.updateOverallProgress(job);

      let channelTitle = channelId;
      try {
        const channel = await dbService.getChannelById(job.userId, channelId);
        if (channel) {
          channelTitle = channel.title;
          channelProgress.channelTitle = channel.title;
        }

        const override = job.channelOverrides[channelId] || {};
        const channelSpecificMetadata = {
          ...job.baseMetadata,
          title: override.title ? override.title : job.baseMetadata.title,
          description: override.description ? override.description : job.baseMetadata.description,
          tags: override.tags ? override.tags : job.baseMetadata.tags
        };

        const result = await youtubeService.uploadVideoToChannel(
          job.userId,
          channelId,
          job.videoFile.path,
          channelSpecificMetadata,
          job.thumbnailFile ? job.thumbnailFile.path : null,
          (progressInfo) => {
            channelProgress.progress = progressInfo.progress;
            this.updateOverallProgress(job);
          }
        );

        channelProgress.status = 'success';
        channelProgress.progress = 100;
        channelProgress.videoId = result.videoId;
        channelProgress.videoUrl = result.videoUrl;
        job.completedChannels += 1;

        job.results.push({
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

        console.log(`✅ [Background Queue] Thành công trên kênh: ${channelTitle} (Job: ${jobId})`);
      } catch (err) {
        console.error(`❌ [Background Queue] Thất bại trên kênh: ${channelTitle} (Job: ${jobId}):`, err.message);
        channelProgress.status = 'failed';
        channelProgress.progress = 0;
        channelProgress.error = err.message;
        job.failedChannels += 1;

        job.results.push({
          channelId,
          channelTitle,
          success: false,
          error: err.message
        });

        historyRecord.channels.push({
          channelId,
          channelTitle,
          status: 'failed',
          error: err.message,
          title: job.baseMetadata.title,
          uploadedAt: new Date()
        });
      }

      this.updateOverallProgress(job);
    };

    // Chạy với hàng đợi concurrency
    const queue = [...channelList];
    const runWorker = async () => {
      while (queue.length > 0) {
        const chId = queue.shift();
        await processChannel(chId);
      }
    };

    const workers = [];
    const concurrency = Math.min(this.maxConcurrentPerJob, channelList.length);
    for (let i = 0; i < concurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);

    // Lưu lại lịch sử vào Database
    try {
      await dbService.addHistory(job.userId, historyRecord);
    } catch (histErr) {
      console.warn('Lỗi lưu lịch sử upload:', histErr.message);
    }

    job.status = job.failedChannels === job.totalChannels ? 'failed' : 'completed';
    job.overallProgress = 100;
    console.log(`🏁 [Background Queue] Hoàn tất Job ID: ${jobId}. Thành công: ${job.completedChannels}/${job.totalChannels}`);

    // Dọn dẹp an toàn các file tạm trên ổ đĩa
    this.cleanJobFiles(job);
  }

  // Cập nhật phần trăm tiến độ tổng thể của Job
  updateOverallProgress(job) {
    const channelArr = Object.values(job.channelsProgress);
    if (channelArr.length === 0) return;
    const sumProgress = channelArr.reduce((acc, cur) => acc + (cur.progress || 0), 0);
    job.overallProgress = Math.min(100, Math.round(sumProgress / channelArr.length));
  }

  // Tự động xóa file video và thumbnail tạm khi xong
  cleanJobFiles(job) {
    try {
      if (job.videoFile && job.videoFile.path && fs.existsSync(job.videoFile.path)) {
        fs.unlinkSync(job.videoFile.path);
        console.log(`🧹 [Background Queue] Đã xóa file video tạm: ${job.videoFile.path}`);
      }
      if (job.thumbnailFile && job.thumbnailFile.path && fs.existsSync(job.thumbnailFile.path)) {
        fs.unlinkSync(job.thumbnailFile.path);
        console.log(`🧹 [Background Queue] Đã xóa file thumbnail tạm: ${job.thumbnailFile.path}`);
      }
    } catch (e) {
      console.warn('Lỗi dọn dẹp file tạm của Job:', e.message);
    }
  }
}

module.exports = new UploadQueueService();
