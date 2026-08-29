const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');

// 1. Tổng hợp dữ liệu phân tích & số liệu biểu đồ cho Analytics Dashboard
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const channels = await dbService.getChannels(userId);
    const history = await dbService.getHistory(userId);
    const quota = dbService.getQuotaUsage();

    // 1. Các chỉ số KPI tổng quát
    const totalChannels = channels.length;
    const totalSubscribers = channels.reduce((sum, c) => sum + (Number(c.subscriberCount) || 0), 0);
    const totalViews = channels.reduce((sum, c) => sum + (Number(c.viewCount) || 0), 0);
    const totalVideosPublished = history.reduce((sum, h) => sum + (h.channels ? h.channels.filter(c => c.status === 'success').length : 0), 0);

    // 2. Dữ liệu biểu đồ Kênh (Tên kênh, Subscribers, Views, VideoCount)
    const channelNames = channels.map(c => c.title || 'Kênh');
    const subscriberData = channels.map(c => Number(c.subscriberCount) || 0);
    const viewData = channels.map(c => Number(c.viewCount) || 0);
    const videoData = channels.map(c => Number(c.videoCount) || 0);

    // 3. Phân bổ trạng thái upload (Success vs Failed vs Scheduled)
    let successCount = 0;
    let failedCount = 0;
    history.forEach(h => {
      if (h.channels && Array.isArray(h.channels)) {
        h.channels.forEach(ch => {
          if (ch.status === 'success') successCount++;
          else if (ch.status === 'failed') failedCount++;
        });
      }
    });

    // 4. Lịch sử phân phối 7 ngày gần nhất
    const last7DaysMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      last7DaysMap[key] = 0;
    }

    history.forEach(h => {
      const date = new Date(h.createdAt);
      const key = `${date.getDate()}/${date.getMonth() + 1}`;
      if (last7DaysMap[key] !== undefined) {
        last7DaysMap[key] += (h.channels ? h.channels.filter(c => c.status === 'success').length : 1);
      }
    });

    const recentTrend = {
      labels: Object.keys(last7DaysMap),
      data: Object.values(last7DaysMap)
    };

    res.json({
      success: true,
      data: {
        kpi: {
          totalChannels,
          totalSubscribers,
          totalViews,
          totalVideosPublished,
          quotaUsed: quota.used,
          quotaRemaining: quota.remaining
        },
        channelStats: {
          labels: channelNames,
          subscribers: subscriberData,
          views: viewData,
          videos: videoData
        },
        distributionStatus: {
          labels: ['Thành công', 'Thất bại'],
          data: [successCount, failedCount]
        },
        recentTrend
      }
    });
  } catch (err) {
    console.error('Analytics Overview Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu thống kê: ' + err.message });
  }
});

const growthAdvisorService = require('../services/growthAdvisorService');

// 2. Báo cáo Tăng Trưởng & Đề Xuất Chiến Lược AI (AI Growth Advisor)
router.get('/advisor', authenticateToken, async (req, res) => {
  try {
    const report = await growthAdvisorService.generateGrowthReport(req.user.id);
    res.json(report);
  } catch (err) {
    console.error('Growth Advisor Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi sinh báo cáo tăng trưởng AI: ' + err.message });
  }
});

module.exports = router;
