/**
 * ============================================================================
 * META FACEBOOK & REELS CONNECTOR SERVICE (GRAPH API v20.0)
 * ============================================================================
 * - Xác thực Meta OAuth2 / Lấy Page Access Tokens dài hạn (Long-lived Token).
 * - Quản lý danh sách Fanpage của Brand.
 * - Phân phối Video thường & Facebook Reels trực tiếp tới Fanpage qua luồng stream.
 */

const fs = require('fs');

const FB_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const FB_GRAPH_VERSION = 'v20.0';
const GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;

class FacebookService {
  // 1. Tạo URL cấp quyền Facebook Login
  getLoginUrl(redirectUri, state = 'default_user') {
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'publish_video'
    ].join(',');

    return `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;
  }

  // 2. Đổi Code lấy User Access Token dài hạn (60 ngày)
  async handleCallback(code, redirectUri) {
    if (!FB_APP_ID || !FB_APP_SECRET) {
      throw new Error('Chưa cấu hình FACEBOOK_APP_ID và FACEBOOK_APP_SECRET trong .env');
    }

    // Bước 1: Đổi code lấy Short-lived Token
    const tokenUrl = `${GRAPH_BASE}/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(`Lỗi Facebook Auth: ${tokenData.error.message}`);
    }

    const shortLivedToken = tokenData.access_token;

    // Bước 2: Đổi sang Long-lived Token
    const longLivedUrl = `${GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const longRes = await fetch(longLivedUrl);
    const longData = await longRes.json();

    return longData.access_token || shortLivedToken;
  }

  // 3. Lấy danh sách Fanpage kèm Page Access Token
  async getUserPages(userAccessToken) {
    const pagesUrl = `${GRAPH_BASE}/me/accounts?fields=id,name,category,access_token,picture.type(large)&access_token=${userAccessToken}`;
    const res = await fetch(pagesUrl);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Lỗi lấy danh sách Fanpage: ${data.error.message}`);
    }

    return (data.data || []).map(page => ({
      pageId: page.id,
      name: page.name,
      category: page.category,
      accessToken: page.access_token,
      avatarUrl: page.picture?.data?.url || '',
      platform: 'FACEBOOK'
    }));
  }

  // 4. Upload Video / Reels lên Fanpage
  async uploadVideoToPage(pageId, pageAccessToken, videoFilePath, { title, description, publishAt = null, isReels = true }) {
    if (!fs.existsSync(videoFilePath)) {
      throw new Error(`File video không tồn tại: ${videoFilePath}`);
    }

    const fileSize = fs.statSync(videoFilePath).size;

    // Khởi tạo phiên Upload Video (Resumable Upload)
    const initUrl = `${GRAPH_BASE}/${pageId}/videos`;
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(videoFilePath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });

    formData.append('source', blob, 'video.mp4');
    formData.append('title', title || 'Video phân phối tự động');
    formData.append('description', description || '');
    formData.append('access_token', pageAccessToken);

    if (publishAt) {
      formData.append('published', 'false');
      formData.append('scheduled_publish_time', Math.floor(new Date(publishAt).getTime() / 1000).toString());
    }

    const uploadRes = await fetch(initUrl, {
      method: 'POST',
      body: formData
    });

    const result = await uploadRes.json();
    if (result.error) {
      throw new Error(`Lỗi upload Facebook: ${result.error.message}`);
    }

    const videoId = result.id;
    return {
      success: true,
      platform: 'FACEBOOK',
      videoId,
      postUrl: `https://www.facebook.com/${videoId}`,
      pageId
    };
  }
}

module.exports = new FacebookService();
