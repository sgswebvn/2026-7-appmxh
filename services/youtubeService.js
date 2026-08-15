const fs = require('fs');
const { google } = require('googleapis');
const dbService = require('./dbService');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function getAuthUrl(userId = 'default_user') {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: userId
  });
}

async function handleOAuthCallback(code, userId = 'default_user') {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  const channelRes = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    mine: true
  });

  if (!channelRes.data.items || channelRes.data.items.length === 0) {
    throw new Error('Tài khoản này chưa có kênh YouTube nào. Vui lòng tạo kênh YouTube trước khi liên kết.');
  }

  const channelItem = channelRes.data.items[0];
  const channelSnippet = channelItem.snippet;
  const channelStats = channelItem.statistics;

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  let userEmail = '';
  try {
    const userInfo = await oauth2.userinfo.get();
    userEmail = userInfo.data.email || '';
  } catch (e) {
    console.warn('Không lấy được email:', e.message);
  }

  const channelData = {
    id: channelItem.id,
    title: channelSnippet.title,
    customUrl: channelSnippet.customUrl || '',
    description: channelSnippet.description || '',
    thumbnailUrl: channelSnippet.thumbnails?.default?.url || channelSnippet.thumbnails?.medium?.url || '',
    subscriberCount: Number(channelStats?.subscriberCount) || 0,
    videoCount: Number(channelStats?.videoCount) || 0,
    viewCount: Number(channelStats?.viewCount) || 0,
    email: userEmail,
    tokens: tokens
  };

  await dbService.saveChannel(userId, channelData);
  return channelData;
}

async function getAuthenticatedYouTubeClient(userId, channelId) {
  const channel = await dbService.getChannelById(userId, channelId);
  if (!channel || !channel.tokens) {
    throw new Error(`Không tìm thấy dữ liệu xác thực cho kênh: ${channelId}`);
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(channel.tokens);

  oauth2Client.on('tokens', async (newTokens) => {
    await dbService.updateChannelTokens(userId, channelId, newTokens);
  });

  return {
    youtube: google.youtube({ version: 'v3', auth: oauth2Client }),
    channel
  };
}

// Đồng bộ lại thống kê kênh mới nhất từ YouTube
async function syncChannelStatsFromYouTube(userId, channelId) {
  try {
    const { youtube } = await getAuthenticatedYouTubeClient(userId, channelId);
    const res = await youtube.channels.list({
      part: ['statistics', 'snippet'],
      mine: true
    });
    if (res.data.items && res.data.items.length > 0) {
      const stats = res.data.items[0].statistics;
      await dbService.updateChannelStats(userId, channelId, {
        subscriberCount: stats.subscriberCount,
        videoCount: stats.videoCount,
        viewCount: stats.viewCount
      });
    }
  } catch (e) {
    console.warn(`Không thể đồng bộ thống kê cho kênh ${channelId}:`, e.message);
  }
}

const autoFixService = require('./autoFixService');

async function uploadVideoToChannel(userId, channelId, videoFilePath, metadata, thumbnailFilePath = null, onProgress = null) {
  const { youtube, channel } = await getAuthenticatedYouTubeClient(userId, channelId);

  if (!fs.existsSync(videoFilePath)) {
    throw new Error(`File video không tồn tại: ${videoFilePath}`);
  }

  // Tự động kiểm tra và sửa lỗi Metadata (cắt ngắn tiêu đề > 100 ký tự, tags > 500 ký tự)
  const safeMetadata = autoFixService.autoFixVideoMetadata(metadata);
  const fileSize = fs.statSync(videoFilePath).size;

  const requestBody = {
    snippet: {
      title: safeMetadata.title || 'Video tải lên tự động',
      description: safeMetadata.description || '',
      tags: Array.isArray(safeMetadata.tags) ? safeMetadata.tags : (safeMetadata.tags ? safeMetadata.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      categoryId: safeMetadata.categoryId || '22'
    },
    status: {
      privacyStatus: safeMetadata.privacyStatus || 'public',
      selfDeclaredMadeForKids: safeMetadata.madeForKids === true || safeMetadata.madeForKids === 'true'
    }
  };

  if (safeMetadata.publishAt) {
    requestBody.status.privacyStatus = 'private';
    requestBody.status.publishAt = new Date(safeMetadata.publishAt).toISOString();
  }

  const videoInsertRes = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: requestBody,
      media: {
        body: fs.createReadStream(videoFilePath)
      }
    },
    {
      onUploadProgress: (evt) => {
        if (fileSize > 0) {
          const progressPercent = Math.min(100, Math.round((evt.bytesRead / fileSize) * 100));
          if (onProgress) {
            onProgress({
              channelId,
              channelTitle: channel.title,
              progress: progressPercent,
              bytesRead: evt.bytesRead,
              totalBytes: fileSize,
              status: 'uploading'
            });
          }
        }
      }
    }
  );

  const videoId = videoInsertRes.data.id;
  dbService.addQuotaUsage(1600);

  // Tăng số lượng videoCount trong Database ngay lập tức
  await dbService.incrementChannelVideoCount(userId, channelId);

  // Upload Thumbnail nếu có
  let thumbnailUploaded = false;
  if (thumbnailFilePath && fs.existsSync(thumbnailFilePath)) {
    try {
      await youtube.thumbnails.set({
        videoId: videoId,
        media: {
          body: fs.createReadStream(thumbnailFilePath)
        }
      });
      thumbnailUploaded = true;
      dbService.addQuotaUsage(50);
    } catch (thumbErr) {
      console.warn(`Lỗi tải thumbnail cho kênh ${channel.title}:`, thumbErr.message);
    }
  }

  return {
    success: true,
    channelId,
    channelTitle: channel.title,
    videoId: videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUploaded
  };
}

module.exports = {
  getAuthUrl,
  handleOAuthCallback,
  uploadVideoToChannel,
  syncChannelStatsFromYouTube,
  getAuthenticatedYouTubeClient
};
