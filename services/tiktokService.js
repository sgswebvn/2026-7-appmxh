/**
 * ============================================================================
 * TIKTOK CONTENT POSTING API CONNECTOR (API v2)
 * ============================================================================
 * - Xác thực TikTok OAuth2 (Code exchange, Refresh Token).
 * - Khởi tạo Direct Post & Upload Video lên TikTok Creator Account.
 */

const fs = require('fs');

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';

class TikTokService {
  // 1. URL ủy quyền tài khoản TikTok
  getAuthUrl(redirectUri, state = 'default_user') {
    const clientKey = (process.env.TIKTOK_CLIENT_KEY || 'awrggyvwtjg30xy7').trim();
    if (!clientKey) {
      throw new Error('Chưa cấu hình TIKTOK_CLIENT_KEY trong cài đặt');
    }
    const scopes = 'user.info.basic,user.info.profile,user.info.stats,video.upload,video.publish';
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${encodeURIComponent(scopes)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  }

  // 2. Đổi Code lấy Token
  async handleCallback(code, redirectUri) {
    const clientKey = (process.env.TIKTOK_CLIENT_KEY || 'awrggyvwtjg30xy7').trim();
    const clientSecret = (process.env.TIKTOK_CLIENT_SECRET || 'yDLpKDRHdYtyB7VzB3puxlEyAkv2aQKV').trim();
    if (!clientKey || !clientSecret) {
      throw new Error('Chưa cấu hình TIKTOK_CLIENT_KEY và TIKTOK_CLIENT_SECRET');
    }

    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
    const body = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const data = await res.json();
    if (data.error || !data.data) {
      throw new Error(`Lỗi TikTok Auth: ${data.error_description || data.message || 'Không thể lấy token'}`);
    }

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      openId: data.data.open_id,
      expiresIn: data.data.expires_in
    };
  }

  // 3. Khởi tạo phiên Upload và Publish Video TikTok
  async publishVideo(accessToken, videoFilePath, { title, privacyLevel = 'PUBLIC_TO_EVERYONE', disableDuet = false, disableStitch = false, disableComment = false }) {
    if (!fs.existsSync(videoFilePath)) {
      throw new Error(`File video không tồn tại: ${videoFilePath}`);
    }

    const fileSize = fs.statSync(videoFilePath).size;

    // Bước 1: Khởi tạo bài đăng Direct Post API
    const initUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
    const initPayload = {
      post_info: {
        title: title || 'Video từ Social Content Factory',
        privacy_level: privacyLevel,
        disable_duet: disableDuet,
        disable_stitch: disableStitch,
        disable_comment: disableComment
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: fileSize,
        chunk_size: fileSize,
        total_chunk_count: 1
      }
    };

    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(initPayload)
    });

    const initData = await initRes.json();
    if (initData.error && initData.error.code !== 'ok') {
      throw new Error(`Lỗi khởi tạo TikTok upload: ${initData.error.message}`);
    }

    const uploadUrl = initData.data?.upload_url;
    const publishId = initData.data?.publish_id;

    if (!uploadUrl) {
      throw new Error('TikTok không trả về URL upload.');
    }

    // Bước 2: Tải dữ liệu video lên TikTok CDN
    const fileBuffer = fs.readFileSync(videoFilePath);
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`
      },
      body: fileBuffer
    });

    return {
      success: true,
      platform: 'TIKTOK',
      publishId,
      status: 'PUBLISHED'
    };
  }
}

module.exports = new TikTokService();
