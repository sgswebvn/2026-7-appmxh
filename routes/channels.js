const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const youtubeService = require('../services/youtubeService');
const { authenticateToken } = require('../middleware/auth');
const { syncChannelLimiter } = require('../middleware/security');

function formatSafeChannel(c) {
  const platform = c.tokens?.platform || (c.id?.startsWith('fb_') || c.title?.startsWith('[FB') ? 'FACEBOOK' : c.id?.startsWith('tt_') || c.title?.startsWith('[TikTok') ? 'TIKTOK' : 'YOUTUBE');
  
  let channelUrl = '';
  if (platform === 'FACEBOOK') {
    const pageId = (c.channelId || c.id || '').replace(/^fb_/, '');
    channelUrl = `https://www.facebook.com/${pageId}`;
  } else if (platform === 'TIKTOK') {
    const openId = (c.channelId || c.id || '').replace(/^tt_/, '');
    channelUrl = `https://www.tiktok.com/@${openId}`;
  } else {
    channelUrl = c.customUrl ? `https://www.youtube.com/${c.customUrl.startsWith('@') ? c.customUrl : '@' + c.customUrl}` : `https://www.youtube.com/channel/${c.channelId || c.id}`;
  }

  return {
    id: c.channelId || c.id,
    title: c.title,
    customUrl: c.customUrl,
    description: c.description,
    thumbnailUrl: c.thumbnailUrl,
    subscriberCount: c.subscriberCount || 0,
    videoCount: c.videoCount || 0,
    viewCount: c.viewCount || 0,
    email: c.email,
    platform: platform,
    tokens: { platform },
    channelUrl: channelUrl,
    createdAt: c.createdAt
  };
}

// 1. Lấy danh sách kênh của User
router.get('/', authenticateToken, async (req, res) => {
  try {
    const channels = await dbService.getChannels(req.user.id);
    const safeChannels = channels.map(formatSafeChannel);
    res.json({ success: true, channels: safeChannels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Xóa một kênh
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await dbService.deleteChannel(req.user.id, req.params.id);
    res.json({ success: true, message: 'Đã gỡ kênh khỏi hệ thống.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Đồng bộ số liệu kênh từ YouTube (chỉ đồng bộ các kênh YouTube)
router.post('/sync', authenticateToken, syncChannelLimiter, async (req, res) => {
  try {
    const channels = await dbService.getChannels(req.user.id);
    for (const ch of channels) {
      const isFb = ch.tokens?.platform === 'FACEBOOK' || ch.id?.startsWith('fb_');
      const isTt = ch.tokens?.platform === 'TIKTOK' || ch.id?.startsWith('tt_');
      if (!isFb && !isTt) {
        await youtubeService.syncChannelStatsFromYouTube(req.user.id, ch.channelId || ch.id);
      }
    }
    const updatedChannels = await dbService.getChannels(req.user.id);
    const safeChannels = updatedChannels.map(formatSafeChannel);
    res.json({ success: true, message: 'Đã đồng bộ số liệu mới nhất từ YouTube!', channels: safeChannels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
