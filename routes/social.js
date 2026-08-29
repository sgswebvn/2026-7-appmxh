const express = require('express');
const router = express.Router();
const facebookService = require('../services/facebookService');
const tiktokService = require('../services/tiktokService');
const dbService = require('../services/dbService');
const { authenticateToken } = require('../middleware/auth');

// ==================== META FACEBOOK APIS ====================
router.get('/facebook/url', authenticateToken, (req, res) => {
  try {
    const host = req.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
    const redirectUri = `${protocol}://${host}/api/social/facebook/callback`;

    const authUrl = facebookService.getLoginUrl(redirectUri, req.user.id);
    res.json({ success: true, authUrl, redirectUri });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/facebook/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).send(`Lỗi xác thực Facebook: ${error}`);
  }
  try {
    const host = req.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
    const redirectUri = `${protocol}://${host}/api/social/facebook/callback`;

    const userToken = await facebookService.handleCallback(code, redirectUri);
    const pages = await facebookService.getUserPages(userToken);

    // Lưu các trang Fanpage vào danh sách kênh của User
    for (const page of pages) {
      await dbService.saveChannel(state || 'default_user', {
        id: `fb_${page.pageId}`,
        title: `[FB Page] ${page.name}`,
        customUrl: `fb.com/${page.pageId}`,
        description: `Fanpage Facebook (${page.category || 'Page'})`,
        thumbnailUrl: page.avatarUrl,
        subscriberCount: 0,
        videoCount: 0,
        tokens: { access_token: page.accessToken, platform: 'FACEBOOK' }
      });
    }

    res.send(`
      <html>
        <body style="background:#0b0d13;color:#fff;font-family:sans-serif;text-align:center;padding:40px;">
          <h2>Đã kết nối thành công ${pages.length} Fanpage Facebook!</h2>
          <script>
            if (window.opener) window.opener.postMessage({ type: 'FB_AUTH_SUCCESS' }, '*');
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Lỗi kết nối Facebook: ${err.message}`);
  }
});

// Kết nối trực tiếp bằng User Token (từ Graph API Explorer hoặc Tool)
router.post('/facebook/token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Access Token.' });

    const pages = await facebookService.getUserPages(token.trim());
    if (!pages || pages.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Fanpage nào được quản lý bởi token này.' });
    }

    const savedPages = [];
    for (const page of pages) {
      await dbService.saveChannel(req.user.id, {
        id: `fb_${page.pageId}`,
        title: `[FB Page] ${page.name}`,
        customUrl: `fb.com/${page.pageId}`,
        description: `Fanpage Facebook (${page.category || 'Page'})`,
        thumbnailUrl: page.avatarUrl,
        subscriberCount: 0,
        videoCount: 0,
        tokens: { access_token: page.accessToken, platform: 'FACEBOOK' }
      });
      savedPages.push(page.name);
    }

    res.json({
      success: true,
      message: `Đã kết nối thành công ${pages.length} Fanpage: ${savedPages.join(', ')}`,
      count: pages.length,
      pages: savedPages
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi kết nối Fanpage: ' + err.message });
  }
});

// ==================== TIKTOK APIS ====================
router.get('/tiktok/url', authenticateToken, (req, res) => {
  try {
    const host = req.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
    const redirectUri = `${protocol}://${host}/api/social/tiktok/callback`;

    const authUrl = tiktokService.getAuthUrl(redirectUri, req.user.id);
    res.json({ success: true, authUrl, redirectUri });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/tiktok/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).send(`Lỗi TikTok: ${error}`);
  }
  try {
    const host = req.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = req.headers['x-forwarded-proto'] || (isLocal ? 'http' : 'https');
    const redirectUri = `${protocol}://${host}/api/social/tiktok/callback`;

    const tokens = await tiktokService.handleCallback(code, redirectUri);
    await dbService.saveChannel(state || 'default_user', {
      id: `tt_${tokens.openId}`,
      title: `[TikTok] Creator ${tokens.openId.substring(0, 8)}`,
      customUrl: `tiktok.com/@${tokens.openId.substring(0, 8)}`,
      description: 'Tài khoản TikTok Content Creator',
      thumbnailUrl: '',
      tokens: { access_token: tokens.accessToken, refresh_token: tokens.refreshToken, platform: 'TIKTOK' }
    });

    res.send(`
      <html>
        <body style="background:#0b0d13;color:#fff;font-family:sans-serif;text-align:center;padding:40px;">
          <h2>Đã kết nối tài khoản TikTok thành công!</h2>
          <script>
            if (window.opener) window.opener.postMessage({ type: 'TIKTOK_AUTH_SUCCESS' }, '*');
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Lỗi kết nối TikTok: ${err.message}`);
  }
});

module.exports = router;
