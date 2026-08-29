// ==================== STATE MANAGEMENT ====================
let authToken = localStorage.getItem('ytb_auth_token') || null;
let currentUser = null;

try {
  const cachedUser = localStorage.getItem('ytb_user_data');
  if (cachedUser) {
    currentUser = JSON.parse(cachedUser);
  }
} catch (e) {}

let channelsState = [];
let selectedChannelIds = new Set();
let videoFile = null;
let thumbFile = null;
let lastAiResult = null;
let testUserTimerInterval = null;
let adminUsersInterval = null;
let adminTestUsersList = [];
let uploadJobPollInterval = null;
let chartInstances = {};
let brandsState = [];
let activeBrandId = localStorage.getItem('ytb_active_brand') || '';
let contentProjectsState = [];
let contentPlansState = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Hiển thị ngay trạng thái người dùng đã lưu từ trước (tránh giật lag khi F5)
  renderNavUser();
  handleUserRolesAndTimers();

  initTabs();
  initSidebarState();
  initDropzones();
  loadCategories();
  initGeminiStudio();
  initFormSubmit();
  initBrandFormSubmit();
  initPlanFormSubmit();
  initOAuthListener();
  checkDbHealth();
  initAdminPanel();

  await checkAuthStatus();
  loadBrands();

  document.getElementById('btn-add-channel').addEventListener('click', openOAuthPopup);
  document.getElementById('btn-refresh-history').addEventListener('click', () => {
    loadQuota();
    loadHistory();
    showToast('Đã làm mới dữ liệu.');
  });

  document.getElementById('select-all-channels').addEventListener('change', (e) => {
    toggleSelectAllChannels(e.target.checked);
  });
});

// Helper lấy Auth Headers
function getAuthHeaders(isMultipart = false) {
  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// ==================== AUTHENTICATION & ADMIN ROLES ====================
async function checkAuthStatus() {
  if (authToken) {
    try {
      const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });

      if (res.status === 401) {
        // Token không hợp lệ hoặc đã hết hạn
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        logout();
        return;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.isExpired || data.isLocked) {
          showToast(data.message || 'Tài khoản đã hết hạn hoặc bị khóa.', 'error');
          logout();
          return;
        }
      }

      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem('ytb_user_data', JSON.stringify(data.user));
        renderNavUser();
        handleUserRolesAndTimers();
        loadChannels();
        loadQuota();
        loadHistory();
        return;
      }
    } catch (err) {
      console.warn('Lỗi kiểm tra phiên từ máy chủ:', err);
      if (currentUser) {
        renderNavUser();
        handleUserRolesAndTimers();
        loadChannels();
        loadQuota();
        loadHistory();
        return;
      }
    }
  }

  if (!authToken) {
    currentUser = null;
    localStorage.removeItem('ytb_auth_token');
    localStorage.removeItem('ytb_user_data');
    renderNavUser();
    handleUserRolesAndTimers();
    renderChannelSelection();
    renderChannelsManager();
  }
}

function handleUserRolesAndTimers() {
  const adminTabBtn = document.getElementById('nav-tab-admin');
  const timerPill = document.getElementById('test-timer-pill');

  if (testUserTimerInterval) {
    clearInterval(testUserTimerInterval);
    testUserTimerInterval = null;
  }

  if (currentUser) {
    // 1. Nếu là Admin: Hiển thị tab Quản trị và tải danh sách tài khoản test
    if (currentUser.role === 'admin') {
      if (adminTabBtn) adminTabBtn.style.display = 'inline-block';
      loadAdminTestUsers();
    } else {
      if (adminTabBtn) adminTabBtn.style.display = 'none';
    }

    // 2. Nếu là tài khoản Test dùng thử: Kích hoạt đồng hồ đếm ngược
    if (currentUser.isTestAccount) {
      if (timerPill) timerPill.style.display = 'flex';
      startTestUserCountdown(currentUser.remainingSeconds || 600);
    } else {
      if (timerPill) timerPill.style.display = 'none';
    }
  } else {
    if (adminTabBtn) adminTabBtn.style.display = 'none';
    if (timerPill) timerPill.style.display = 'none';
  }
}

// Bộ đếm ngược thời gian thực cho tài khoản Test
function startTestUserCountdown(secondsLeft) {
  let timeLeft = Math.max(0, Number(secondsLeft) || 0);
  const timerText = document.getElementById('test-timer-text');

    function updateDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (timerText) {
      timerText.textContent = `Dùng thử: ${formatted}`;
    }

    if (timeLeft <= 0) {
      clearInterval(testUserTimerInterval);
      testUserTimerInterval = null;
      showToast('Hết hạn 10 phút dùng thử. Phiên làm việc đã tự động khóa.', 'error');
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 2500);
    }
    timeLeft--;
  }

  updateDisplay();
  testUserTimerInterval = setInterval(updateDisplay, 1000);
}

function renderNavUser() {
  const container = document.getElementById('auth-nav-container');
  if (currentUser) {
    const roleBadge = currentUser.role === 'admin'
      ? `<span style="background:var(--accent-red); color:#fff; font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:700; margin-right:4px;">ADMIN</span>`
      : (currentUser.isTestAccount ? `<span style="background:#f59e0b; color:#000; font-size:0.68rem; padding:2px 6px; border-radius:4px; font-weight:700; margin-right:4px;">TEST</span>` : '');

    container.innerHTML = `
      <div class="user-pill">
        <span>${roleBadge}<strong>${currentUser.name || currentUser.email}</strong></span>
        <button type="button" class="btn btn-sm btn-outline" onclick="logout()" style="padding:2px 6px; font-size:0.75rem;">Đăng xuất</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <a href="/login" class="btn btn-sm btn-accent" style="text-decoration:none;">
        Đăng Nhập
      </a>
    `;
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('ytb_auth_token');
  localStorage.removeItem('ytb_user_data');
  if (testUserTimerInterval) {
    clearInterval(testUserTimerInterval);
    testUserTimerInterval = null;
  }
  renderNavUser();
  handleUserRolesAndTimers();
  channelsState = [];
  renderChannelSelection();
  renderChannelsManager();
  showToast('Đã đăng xuất tài khoản.');
}

// ==================== DATABASE HEALTH ====================
async function checkDbHealth() {
  try {
    const res = await fetch('/api/health/db');
    const data = await res.json();
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');

    if (data.success && data.db) {
      if (data.db.connected) {
        dot.style.background = '#10b981';
        text.textContent = 'MongoDB Atlas: Kết nối tốt';
      } else {
        dot.style.background = '#94a3b8';
        text.textContent = 'Database: Local Resilience Mode';
      }
    }
  } catch (e) {}
}

// ==================== TAB NAVIGATION ====================
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });

  // Khôi phục tab từ URL Hash hoặc LocalStorage khi reload trang (F5)
  const hash = window.location.hash.replace('#', '');
  const savedTab = localStorage.getItem('ytb_active_tab');
  const targetTab = (hash && document.getElementById(hash)) ? hash : (savedTab && document.getElementById(savedTab) ? savedTab : 'publish-tab');
  switchTab(targetTab);
}

function switchTab(tabId) {
  if (!tabId || !document.getElementById(tabId)) tabId = 'publish-tab';

  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === tabId);
  });

  // Cập nhật tiêu đề Topbar
  const tabTitles = {
    'publish-tab': 'Phân Phối Video Đa Kênh',
    'gemini-tab': 'Multi-AI Script Studio & SEO Generator',
    'content-tab': 'Kho Lưu Trữ & Thư Viện Nội Dung',
    'planner-tab': 'Lịch Ma Trận Phân Phối Đa Kênh',
    'brands-tab': 'Quản Trị Hệ Thống Đa Thương Hiệu',
    'channels-tab': 'Quản Lý Mạng Xã Hội Đã Liên Kết',
    'analytics-tab': 'Báo Cáo Thống Kê & Phân Tích Tăng Trưởng',
    'history-tab': 'Lịch Sử Phân Phối & Hạn Mức Quota',
    'admin-tab': 'Bảng Điều Khiển Quản Trị Hệ Thống'
  };
  const currentTitle = tabTitles[tabId] || 'Bảng Điều Khiển';
  if (document.getElementById('topbar-page-title')) document.getElementById('topbar-page-title').textContent = currentTitle;

  // Lưu trạng thái tab hiện tại
  localStorage.setItem('ytb_active_tab', tabId);
  history.replaceState(null, null, '#' + tabId);

  // Tự động load dữ liệu khi mở các Tab tương ứng
  if (tabId === 'analytics-tab') {
    loadAnalyticsData();
  } else if (tabId === 'brands-tab') {
    loadBrands();
  } else if (tabId === 'content-tab') {
    loadContentProjects();
  } else if (tabId === 'planner-tab') {
    loadContentPlans();
  }
}

// ==================== CHANNELS MANAGEMENT ====================
async function loadChannels() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/channels', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      channelsState = data.channels || [];
      document.getElementById('channel-count-badge').textContent = channelsState.length;
      renderChannelSelection();
      renderChannelsManager();
      loadChannelGroups();
    }
  } catch (err) {
    console.error('Lỗi tải danh sách kênh:', err);
  }
}

// Đồng bộ số liệu kênh mới nhất trực tiếp từ YouTube Studio API (Có Cooldown chống Spam)
async function syncChannelsFromYouTube() {
  if (!currentUser) {
    window.location.href = '/login';
    return;
  }

  const syncBtn = document.getElementById('btn-sync-channels');
  if (syncBtn.disabled) return;

  syncBtn.disabled = true;
  showToast('Đang đồng bộ số liệu từ YouTube...');

  try {
    const res = await fetch('/api/channels/sync', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      channelsState = data.channels || [];
      document.getElementById('channel-count-badge').textContent = channelsState.length;
      renderChannelSelection();
      renderChannelsManager();
      showToast('Đã đồng bộ số lượng video và người đăng ký mới nhất!');
    } else {
      showToast(data.message || 'Lỗi khi đồng bộ', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
  } finally {
    // Cooldown 5 giây chống spam click liên tục
    let cooldown = 5;
    const interval = setInterval(() => {
      syncBtn.textContent = `Chờ (${cooldown}s)...`;
      cooldown--;
      if (cooldown < 0) {
        clearInterval(interval);
        syncBtn.disabled = false;
        syncBtn.textContent = 'Đồng bộ số liệu từ YouTube';
      }
    }, 1000);
  }
}

function getChannelPlatform(channel) {
  if (channel.tokens?.platform === 'FACEBOOK' || channel.id?.startsWith('fb_') || channel.title?.startsWith('[FB')) return 'FACEBOOK';
  if (channel.tokens?.platform === 'TIKTOK' || channel.id?.startsWith('tt_') || channel.title?.startsWith('[TikTok')) return 'TIKTOK';
  return 'YOUTUBE';
}

function filterPlatformView(platform) {
  document.querySelectorAll('.platform-filter-tab').forEach(t => t.classList.remove('active'));
  const activeTabBtn = document.getElementById(`tab-filter-${platform}`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  const secYt = document.getElementById('sec-platform-youtube');
  const secFb = document.getElementById('sec-platform-facebook');
  const secTt = document.getElementById('sec-platform-tiktok');

  if (secYt) secYt.style.display = (platform === 'all' || platform === 'youtube') ? 'block' : 'none';
  if (secFb) secFb.style.display = (platform === 'all' || platform === 'facebook') ? 'block' : 'none';
  if (secTt) secTt.style.display = (platform === 'all' || platform === 'tiktok') ? 'block' : 'none';
}

function createChannelSelectCard(channel) {
  const isSelected = selectedChannelIds.has(channel.id);
  const card = document.createElement('div');
  card.className = `channel-card-select ${isSelected ? 'selected' : ''}`;
  card.dataset.id = channel.id;

  const plat = getChannelPlatform(channel);
  const defaultThumb = plat === 'FACEBOOK' ? 'https://via.placeholder.com/36?text=FB' : plat === 'TIKTOK' ? 'https://via.placeholder.com/36?text=TT' : 'https://via.placeholder.com/36?text=YT';
  const avatarUrl = channel.thumbnailUrl || defaultThumb;
  const subText = plat === 'FACEBOOK' ? 'Fanpage Facebook' : plat === 'TIKTOK' ? 'TikTok Creator' : `${formatNumber(channel.subscriberCount)} sub • ${formatNumber(channel.videoCount)} video`;

  card.innerHTML = `
    <input type="checkbox" ${isSelected ? 'checked' : ''} style="cursor:pointer; width:15px; height:15px; accent-color:var(--accent-red);">
    <img src="${avatarUrl}" class="channel-avatar" alt="Avatar">
    <div style="overflow:hidden; flex:1;">
      <div style="font-weight:500; font-size:0.84rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${channel.title}</div>
      <div style="font-size:0.7rem; color:var(--text-muted);">${subText}</div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const checkbox = card.querySelector('input');
      checkbox.checked = !checkbox.checked;
    }
    const checkbox = card.querySelector('input');
    if (checkbox.checked) {
      selectedChannelIds.add(channel.id);
      card.classList.add('selected');
    } else {
      selectedChannelIds.delete(channel.id);
      card.classList.remove('selected');
    }
    updateSelectAllStatus();
    renderChannelOverrides();
  });

  return card;
}

function renderChannelSelection() {
  const container = document.getElementById('channel-selection-list');
  const emptyPrompt = document.getElementById('no-channels-prompt');
  if (!container) return;
  container.innerHTML = '';

  if (channelsState.length === 0) {
    if (emptyPrompt) emptyPrompt.style.display = 'block';
    return;
  }
  if (emptyPrompt) emptyPrompt.style.display = 'none';

  selectedChannelIds = new Set(channelsState.map(c => c.id));
  if (document.getElementById('select-all-channels')) document.getElementById('select-all-channels').checked = true;

  const ytChannels = channelsState.filter(c => getChannelPlatform(c) === 'YOUTUBE');
  const fbChannels = channelsState.filter(c => getChannelPlatform(c) === 'FACEBOOK');
  const ttChannels = channelsState.filter(c => getChannelPlatform(c) === 'TIKTOK');

  const renderGroup = (title, badgeClass, list, platKey) => {
    if (list.length === 0) return;
    const groupEl = document.createElement('div');
    groupEl.className = 'publisher-platform-group';
    groupEl.innerHTML = `
      <div class="publisher-group-header">
        <div class="publisher-group-title">
          <span class="platform-tag ${badgeClass}">${platKey}</span>
          <span>${title} (${list.length})</span>
        </div>
        <label class="publisher-group-select-all">
          <input type="checkbox" class="plat-group-check" data-platform="${platKey}" checked> Chọn tất cả ${platKey}
        </label>
      </div>
      <div class="channel-grid" id="plat-group-grid-${platKey}"></div>
    `;

    const grid = groupEl.querySelector(`#plat-group-grid-${platKey}`);
    list.forEach(channel => {
      grid.appendChild(createChannelSelectCard(channel));
    });

    const groupCheck = groupEl.querySelector('.plat-group-check');
    groupCheck.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      list.forEach(c => {
        if (isChecked) selectedChannelIds.add(c.id);
        else selectedChannelIds.delete(c.id);
        const cardEl = groupEl.querySelector(`.channel-card-select[data-id="${c.id}"]`);
        if (cardEl) {
          cardEl.classList.toggle('selected', isChecked);
          const inp = cardEl.querySelector('input');
          if (inp) inp.checked = isChecked;
        }
      });
      updateSelectAllStatus();
      renderChannelOverrides();
    });

    container.appendChild(groupEl);
  };

  renderGroup('Kênh YouTube', 'platform-tag-yt', ytChannels, 'YT');
  renderGroup('Fanpage Facebook', 'platform-tag-fb', fbChannels, 'FB');
  renderGroup('Tài Khoản TikTok', 'platform-tag-tt', ttChannels, 'TT');

  renderChannelOverrides();
}

function updateSelectAllStatus() {
  const selectAll = document.getElementById('select-all-channels');
  if (selectAll) selectAll.checked = selectedChannelIds.size === channelsState.length && channelsState.length > 0;
}

function toggleSelectAllChannels(checked) {
  const cards = document.querySelectorAll('.channel-card-select');
  cards.forEach(card => {
    const id = card.dataset.id;
    const checkbox = card.querySelector('input');
    if (checkbox) checkbox.checked = checked;
    if (checked) {
      selectedChannelIds.add(id);
      card.classList.add('selected');
    } else {
      selectedChannelIds.delete(id);
      card.classList.remove('selected');
    }
  });
  document.querySelectorAll('.plat-group-check').forEach(c => c.checked = checked);
  renderChannelOverrides();
}

function createChannelItemCard(channel, platform) {
  const card = document.createElement('div');
  card.className = 'channel-item-card';

  const defaultThumb = platform === 'FACEBOOK' ? 'https://via.placeholder.com/44?text=FB' : platform === 'TIKTOK' ? 'https://via.placeholder.com/44?text=TT' : 'https://via.placeholder.com/44?text=YT';
  const avatarUrl = channel.thumbnailUrl || defaultThumb;
  const linkText = platform === 'FACEBOOK' ? 'Xem Fanpage ↗' : platform === 'TIKTOK' ? 'Xem TikTok ↗' : 'Trang chủ kênh ↗';
  
  const cleanId = (channel.id || '').replace(/^fb_/, '').replace(/^tt_/, '');
  let targetUrl = channel.channelUrl;
  if (!targetUrl || targetUrl.includes('youtube.com/@fb.com')) {
    if (platform === 'FACEBOOK') {
      targetUrl = `https://www.facebook.com/${cleanId}`;
    } else if (platform === 'TIKTOK') {
      targetUrl = `https://www.tiktok.com/@${cleanId}`;
    } else {
      targetUrl = `https://www.youtube.com/channel/${channel.id}`;
    }
  }

  let statsHtml = '';
  if (platform === 'YOUTUBE') {
    statsHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:8px; background:var(--bg-input); border-radius:var(--radius-sm); margin-bottom:12px; font-size:0.74rem;">
        <div>
          <span style="color:var(--text-muted); display:block;">Người đăng ký:</span>
          <strong>${formatNumber(channel.subscriberCount)}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted); display:block;">Video đã phát:</span>
          <strong style="color:#fff;">${formatNumber(channel.videoCount)}</strong>
        </div>
      </div>
    `;
  } else if (platform === 'FACEBOOK') {
    statsHtml = `
      <div style="padding:8px; background:var(--bg-input); border-radius:var(--radius-sm); margin-bottom:12px; font-size:0.74rem;">
        <span style="color:var(--text-muted); display:block;">Page ID: <code>${channel.id.replace('fb_', '')}</code></span>
        <span style="color:#38bdf8; display:block; margin-top:2px;">Meta Graph API Active</span>
      </div>
    `;
  } else {
    statsHtml = `
      <div style="padding:8px; background:var(--bg-input); border-radius:var(--radius-sm); margin-bottom:12px; font-size:0.74rem;">
        <span style="color:var(--text-muted); display:block;">TikTok Creator Direct Post</span>
        <span style="color:#34d399; display:block; margin-top:2px;">Sẵn sàng phân phối video</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <img src="${avatarUrl}" style="width:42px; height:42px; border-radius:50%; border:1px solid var(--border-subtle); object-fit:cover;" alt="Avatar">
        <div style="overflow:hidden; flex:1;">
          <h4 style="font-size:0.9rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff;">
            ${channel.title}
          </h4>
          <a href="${targetUrl}" target="_blank" class="channel-link-btn" style="font-size:0.74rem; color:var(--text-muted);">
            ${linkText}
          </a>
        </div>
      </div>
      ${statsHtml}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px;">
      <span class="status-badge status-success">Đã kết nối</span>
      <button type="button" class="btn btn-sm btn-danger-outline" onclick="deleteChannel('${channel.id}', '${channel.title.replace(/'/g, "\\'")}')">
        Gỡ liên kết
      </button>
    </div>
  `;

  return card;
}

function renderChannelsManager() {
  const ytGrid = document.getElementById('youtube-channels-grid');
  const fbGrid = document.getElementById('facebook-channels-grid');
  const ttGrid = document.getElementById('tiktok-channels-grid');

  const emptyYt = document.getElementById('empty-yt-state');
  const emptyFb = document.getElementById('empty-fb-state');
  const emptyTt = document.getElementById('empty-tt-state');

  if (ytGrid) ytGrid.innerHTML = '';
  if (fbGrid) fbGrid.innerHTML = '';
  if (ttGrid) ttGrid.innerHTML = '';

  const ytChannels = [];
  const fbChannels = [];
  const ttChannels = [];

  channelsState.forEach(c => {
    const plat = getChannelPlatform(c);
    if (plat === 'FACEBOOK') fbChannels.push(c);
    else if (plat === 'TIKTOK') ttChannels.push(c);
    else ytChannels.push(c);
  });

  if (document.getElementById('badge-count-all')) document.getElementById('badge-count-all').textContent = channelsState.length;
  if (document.getElementById('badge-count-yt')) document.getElementById('badge-count-yt').textContent = ytChannels.length;
  if (document.getElementById('badge-count-fb')) document.getElementById('badge-count-fb').textContent = fbChannels.length;
  if (document.getElementById('badge-count-tt')) document.getElementById('badge-count-tt').textContent = ttChannels.length;
  if (document.getElementById('channel-count-badge')) document.getElementById('channel-count-badge').textContent = channelsState.length;

  // Render YouTube
  if (emptyYt) emptyYt.style.display = ytChannels.length === 0 ? 'block' : 'none';
  ytChannels.forEach(channel => {
    if (ytGrid) ytGrid.appendChild(createChannelItemCard(channel, 'YOUTUBE'));
  });

  // Render Facebook
  if (emptyFb) emptyFb.style.display = fbChannels.length === 0 ? 'block' : 'none';
  fbChannels.forEach(channel => {
    if (fbGrid) fbGrid.appendChild(createChannelItemCard(channel, 'FACEBOOK'));
  });

  // Render TikTok
  if (emptyTt) emptyTt.style.display = ttChannels.length === 0 ? 'block' : 'none';
  ttChannels.forEach(channel => {
    if (ttGrid) ttGrid.appendChild(createChannelItemCard(channel, 'TIKTOK'));
  });
}

async function deleteChannel(id, title) {
  if (!confirm(`Bạn có chắc chắn muốn gỡ kênh "${title}" khỏi hệ thống?`)) return;

  try {
    const res = await fetch(`/api/channels/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Đã gỡ kênh "${title}".`);
      loadChannels();
    } else {
      showToast(data.message || 'Lỗi khi gỡ kênh', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối', 'error');
  }
}

// ==================== QUẢN LÝ NHÓM KÊNH & CHỦ ĐỀ (CHANNEL GROUPS & TOPICS) ====================
let channelGroupsState = [];
let activePublishGroupId = 'all';

async function loadChannelGroups() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/channels/groups', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      channelGroupsState = data.groups || [];
      renderChannelGroupsUI();
      renderPublishGroupSelector();
    }
  } catch (err) {
    console.error('Lỗi tải nhóm kênh:', err);
  }
}

function renderChannelGroupsUI() {
  const grid = document.getElementById('channel-groups-grid');
  const emptyState = document.getElementById('empty-groups-state');
  if (!grid) return;
  grid.innerHTML = '';

  if (channelGroupsState.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  channelGroupsState.forEach(group => {
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.background = '#0d131f';
    card.style.border = `1px solid ${group.color || '#38bdf8'}40`;
    card.style.padding = '12px 14px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';

    const channelCount = (group.channelIds || []).length;

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <h4 style="font-size:0.9rem; font-weight:600; color:#fff;">${group.name}</h4>
          <span style="font-size:0.7rem; font-weight:600; padding:2px 8px; border-radius:12px; background:${group.color || '#38bdf8'}25; color:${group.color || '#38bdf8'}; border:1px solid ${group.color || '#38bdf8'}50;">
            ${group.topic || 'Chung'}
          </span>
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4;">
          ${group.description || 'Chưa có mô tả'}
        </p>
        <div style="font-size:0.75rem; color:#38bdf8; font-weight:500; margin-bottom:10px;">
          📊 Bao gồm: <strong>${channelCount}</strong> kênh / fanpage
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #1e293b; padding-top:8px;">
        <button type="button" class="btn btn-sm btn-outline" style="padding:3px 10px; font-size:0.72rem;" onclick="openCreateChannelGroupModal('${group._id || group.id}')">
          Sửa Nhóm
        </button>
        <button type="button" class="btn btn-sm btn-danger-outline" style="padding:3px 10px; font-size:0.72rem;" onclick="deleteChannelGroup('${group._id || group.id}', '${group.name.replace(/'/g, "\\'")}')">
          Xóa
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderPublishGroupSelector() {
  const container = document.getElementById('publish-group-badges-list');
  if (!container) return;
  container.innerHTML = '';

  // Nút Tất Cả
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `btn btn-sm ${activePublishGroupId === 'all' ? 'btn-primary' : 'btn-outline'}`;
  allBtn.style.padding = '3px 9px';
  allBtn.style.fontSize = '0.74rem';
  allBtn.textContent = 'Tất Cả Kênh';
  allBtn.onclick = () => selectChannelsByGroup('all');
  container.appendChild(allBtn);

  // Từng Nhóm Chủ Đề
  channelGroupsState.forEach(group => {
    const isAct = activePublishGroupId === (group._id || group.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-sm ${isAct ? 'btn-primary' : 'btn-outline'}`;
    btn.style.padding = '3px 9px';
    btn.style.fontSize = '0.74rem';
    btn.style.borderColor = group.color || '#38bdf8';
    btn.style.color = isAct ? '#fff' : (group.color || '#38bdf8');
    btn.innerHTML = `🏷️ ${group.name} <span style="font-size:0.68rem; opacity:0.8;">(${(group.channelIds || []).length})</span>`;
    btn.onclick = () => selectChannelsByGroup(group._id || group.id);
    container.appendChild(btn);
  });
}

function selectChannelsByGroup(groupId) {
  activePublishGroupId = groupId;
  renderPublishGroupSelector();

  const cards = document.querySelectorAll('.channel-card-select');

  if (groupId === 'all') {
    cards.forEach(card => {
      const id = card.dataset.id;
      const checkbox = card.querySelector('input');
      if (checkbox) checkbox.checked = true;
      selectedChannelIds.add(id);
      card.classList.add('selected');
    });
    showToast('Đã chọn toàn bộ các kênh');
  } else {
    const group = channelGroupsState.find(g => (g._id || g.id) === groupId);
    if (!group) return;
    const allowedIds = new Set(group.channelIds || []);

    cards.forEach(card => {
      const id = card.dataset.id;
      const checkbox = card.querySelector('input');
      const isMatch = allowedIds.has(id);

      if (checkbox) checkbox.checked = isMatch;
      if (isMatch) {
        selectedChannelIds.add(id);
        card.classList.add('selected');
      } else {
        selectedChannelIds.delete(id);
        card.classList.remove('selected');
      }
    });
    showToast(`Đã chọn nhanh ${allowedIds.size} kênh trong nhóm "${group.name}"!`, 'success');
  }

  updateSelectAllStatus();
  renderChannelOverrides();
}

function openCreateChannelGroupModal(groupId = null) {
  const modal = document.getElementById('channel-group-modal');
  const title = document.getElementById('channel-group-modal-title');
  const idInput = document.getElementById('channel-group-id-hidden');
  const nameInput = document.getElementById('group-name-input');
  const topicSelect = document.getElementById('group-topic-select');
  const descInput = document.getElementById('group-desc-input');
  const colorSelect = document.getElementById('group-color-input');
  const checklist = document.getElementById('group-modal-channels-checklist');

  idInput.value = '';
  nameInput.value = '';
  descInput.value = '';

  let currentSelectedChannelIds = new Set();

  if (groupId) {
    const group = channelGroupsState.find(g => (g._id || g.id) === groupId);
    if (group) {
      title.textContent = `Chỉnh Sửa Nhóm: ${group.name}`;
      idInput.value = group._id || group.id;
      nameInput.value = group.name || '';
      topicSelect.value = group.topic || 'Chung';
      descInput.value = group.description || '';
      colorSelect.value = group.color || '#38bdf8';
      currentSelectedChannelIds = new Set(group.channelIds || []);
    }
  } else {
    title.textContent = 'Tạo Nhóm Kênh & Chủ Đề Mới';
  }

  // Render checklist các kênh
  checklist.innerHTML = '';
  if (channelsState.length === 0) {
    checklist.innerHTML = '<div style="color:var(--text-muted); font-size:0.75rem; text-align:center;">Chưa có kênh nào được liên kết trong hệ thống.</div>';
  } else {
    channelsState.forEach(ch => {
      const plat = getChannelPlatform(ch);
      const isChecked = currentSelectedChannelIds.has(ch.id);
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.padding = '4px 6px';
      row.style.background = '#111624';
      row.style.borderRadius = '4px';
      row.style.cursor = 'pointer';
      row.style.fontSize = '0.78rem';

      row.innerHTML = `
        <input type="checkbox" class="group-channel-cb" value="${ch.id}" ${isChecked ? 'checked' : ''} style="accent-color:var(--accent-red); cursor:pointer;">
        <span style="font-size:0.68rem; font-weight:600; padding:1px 5px; border-radius:3px; background:#1e293b; color:#94a3b8;">${plat}</span>
        <span style="color:#fff; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ch.title}</span>
      `;
      checklist.appendChild(row);
    });
  }

  updateGroupModalCount();
  checklist.querySelectorAll('.group-channel-cb').forEach(cb => {
    cb.addEventListener('change', updateGroupModalCount);
  });

  modal.style.display = 'flex';
}

function updateGroupModalCount() {
  const checked = document.querySelectorAll('.group-channel-cb:checked');
  const countEl = document.getElementById('group-modal-selected-count');
  if (countEl) countEl.textContent = `Đã chọn: ${checked.length} kênh`;
}

function closeChannelGroupModal() {
  const modal = document.getElementById('channel-group-modal');
  if (modal) modal.style.display = 'none';
}

async function handleSaveChannelGroup(e) {
  e.preventDefault();
  const id = document.getElementById('channel-group-id-hidden').value;
  const name = document.getElementById('group-name-input').value.trim();
  const topic = document.getElementById('group-topic-select').value;
  const description = document.getElementById('group-desc-input').value.trim();
  const color = document.getElementById('group-color-input').value;

  const selectedCbs = Array.from(document.querySelectorAll('.group-channel-cb:checked')).map(cb => cb.value);

  const btn = document.getElementById('btn-save-channel-group');
  btn.disabled = true;
  btn.textContent = 'Đang lưu...';

  try {
    const url = id ? `/api/channels/groups/${id}` : '/api/channels/groups';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        topic,
        description,
        color,
        channelIds: selectedCbs
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Đã lưu nhóm kênh thành công!', 'success');
      closeChannelGroupModal();
      loadChannelGroups();
    } else {
      showToast(data.message || 'Lỗi khi lưu nhóm kênh', 'error');
    }
  } catch (err) {
    showToast('Lỗi gửi yêu cầu: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lưu Nhóm Kênh';
  }
}

async function deleteChannelGroup(id, name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa nhóm kênh "${name}"?`)) return;

  try {
    const res = await fetch(`/api/channels/groups/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa nhóm kênh thành công.');
      loadChannelGroups();
    } else {
      showToast(data.message || 'Lỗi xóa nhóm', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }
}

// ==================== GOOGLE OAUTH POPUP ====================
async function openOAuthPopup() {
  if (!currentUser) {
    window.location.href = '/login';
    return;
  }

  const addBtn = document.getElementById('btn-add-channel');
  if (addBtn) {
    addBtn.disabled = true;
    setTimeout(() => { if (addBtn) addBtn.disabled = false; }, 3000);
  }

  try {
    const res = await fetch(`/api/auth/url?userId=${currentUser.id}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.authUrl) {
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        data.authUrl,
        'google_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
      );

      // Tự động làm mới danh sách kênh khi cửa sổ OAuth được đóng lại
      const popupInterval = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(popupInterval);
          setTimeout(() => {
            loadChannels();
            loadQuota();
          }, 800);
        }
      }, 1000);
    } else {
      showToast('Không lấy được link cấp quyền: ' + (data.message || ''), 'error');
    }
  } catch (err) {
    showToast('Lỗi mở OAuth Google: ' + err.message, 'error');
  }
}

function initOAuthListener() {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'YOUTUBE_AUTH_SUCCESS') {
      const channel = event.data.channel;
      showToast(`Đã kết nối kênh: ${channel.title}`);
      loadChannels();
      loadQuota();
    }
  });
}

// ==================== GEMINI AI STUDIO ====================
function initGeminiStudio() {
  const form = document.getElementById('gemini-ai-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const topic = document.getElementById('ai-topic').value.trim();
    if (!topic) {
      showToast('Vui lòng nhập chủ đề video!', 'error');
      return;
    }

    const targetAudience = document.getElementById('ai-audience').value.trim();
    const tone = document.getElementById('ai-tone').value;
    const customKey = document.getElementById('ai-key-input').value.trim();

    // Tìm tên Brand đang chọn nếu có
    const selectedBrand = brandsState.find(b => (b._id || b.id) === activeBrandId);
    const brandName = selectedBrand ? selectedBrand.name : '';

    const btn = document.getElementById('btn-generate-ai');
    const loadingText = document.getElementById('ai-loading-text');

    btn.disabled = true;
    loadingText.style.display = 'inline-block';

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          topic,
          targetAudience,
          tone,
          brandName,
          apiKey: customKey
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        lastAiResult = data.data;
        renderAiResults(data.data, data.isAiGenerated, data.provider);
        showToast('Multi-AI Pool đã hoàn tất sinh kịch bản!', 'success');
      } else {
        showToast(data.message || 'Lỗi phân tích nội dung', 'error');
      }
    } catch (err) {
      showToast('Lỗi gửi yêu cầu: ' + err.message, 'error');
    } finally {
      loadingText.style.display = 'none';
      let cooldown = 3;
      const interval = setInterval(() => {
        btn.textContent = `Chờ (${cooldown}s)...`;
        cooldown--;
        if (cooldown < 0) {
          clearInterval(interval);
          btn.disabled = false;
          btn.textContent = 'Sinh Kịch Bản & Gói SEO (Auto-Failover AI)';
        }
      }, 1000);
    }
  });
}

async function triggerAiDeepResearch() {
  const topic = document.getElementById('ai-topic').value.trim();
  if (!topic) {
    showToast('Vui lòng nhập từ khóa hoặc chủ đề gốc để AI tự động nghiên cứu!', 'warning');
    return;
  }

  const targetAudience = document.getElementById('ai-audience').value.trim();
  const tone = document.getElementById('ai-tone').value;

  const selectedBrand = brandsState.find(b => (b._id || b.id) === activeBrandId);
  const brandName = selectedBrand ? selectedBrand.name : '';

  const btn = document.getElementById('btn-ai-deep-research');
  const loadingText = document.getElementById('ai-loading-text');

  btn.disabled = true;
  loadingText.textContent = '⚡ Multi-Agent đang khảo sát trend & tự động tranh luận...';
  loadingText.style.display = 'inline-block';

  try {
    const res = await fetch('/api/ai/deep-research', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        topic,
        targetAudience,
        tone,
        brandName
      })
    });

    const data = await res.json();
    if (data.success && data.data) {
      lastAiResult = data.data;
      aiGeneratedData = {
        titles: (data.data.viralTitles || []).map(t => typeof t === 'string' ? t : t.title),
        description: data.data.seoDescription || '',
        tags: (data.data.tags || []).map(t => t.replace(/^#/, ''))
      };
      renderAiResults(data.data, true, `${data.provider} (${data.model || 'Multi-Agent'})`);
      showToast('Hội đồng Multi-Agent đã nghiên cứu và chốt kịch bản viral!', 'success');
    } else {
      showToast(data.message || 'Lỗi nghiên cứu AI', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối Multi-Agent: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    loadingText.style.display = 'none';
  }
}

function renderAiResults(data, isAiGenerated, providerName) {
  const wrapper = document.getElementById('ai-results-wrapper');
  wrapper.style.display = 'block';

  document.getElementById('ai-engine-source').textContent = providerName ? `Xử lý bởi: ${providerName}` : 'Xử lý bởi Multi-AI Failover Pool';

  // Render Multi-Agent Debate & Trend Insights nếu có
  const debateBox = document.getElementById('ai-agent-debate-box');
  const insightsContainer = document.getElementById('ai-trend-insights-container');
  const debateContainer = document.getElementById('ai-debate-transcript-container');

  if (data.trendInsights || data.debateTranscript) {
    if (debateBox) debateBox.style.display = 'block';
    
    if (insightsContainer && data.trendInsights) {
      const angles = (data.trendInsights.trendingAngles || []).map(a => `<li style="margin-bottom:4px;">🎯 ${a}</li>`).join('');
      insightsContainer.innerHTML = `
        <div style="margin-bottom:6px;"><strong>Insight Nỗi Đau Khán Giả:</strong> <span style="color:#93c5fd;">${data.trendInsights.targetAudiencePainPoint || 'Đang bóc tách'}</span></div>
        <div style="margin-top:6px;"><strong>3 Góc Tiếp Cận Viral Được Khai Thác:</strong></div>
        <ul style="padding-left:18px; margin-top:4px; color:#e2e8f0;">${angles}</ul>
      `;
    }

    if (debateContainer && data.debateTranscript) {
      debateContainer.innerHTML = '<strong style="color:#38bdf8; display:block; margin-bottom:6px;">Trích đoạn tranh luận nội bộ giữa các AI Agent:</strong>';
      data.debateTranscript.forEach(t => {
        const item = document.createElement('div');
        item.style.marginBottom = '6px';
        item.innerHTML = `<span style="color:#f43f5e; font-weight:600;">[${t.agent}]:</span> <span style="color:#cbd5e1;">${t.thought || t.decision || ''}</span>`;
        debateContainer.appendChild(item);
      });
    }
  } else {
    if (debateBox) debateBox.style.display = 'none';
  }

  // Render Script (Hook, Body, CTA)
  if (data.script) {
    document.getElementById('ai-script-panel').style.display = 'block';
    document.getElementById('ai-hook-text').textContent = data.script.hook || 'Chưa có hook';
    document.getElementById('ai-cta-text').textContent = data.script.cta || data.script.callToAction || 'Chưa có CTA';
    
    const bodyContainer = document.getElementById('ai-script-body-container');
    bodyContainer.innerHTML = '';
    if (data.script.bodySections && Array.isArray(data.script.bodySections)) {
      data.script.bodySections.forEach(sec => {
        const p = document.createElement('div');
        p.style.marginBottom = '6px';
        p.innerHTML = `<strong style="color:#f8fafc;">[${sec.time || '00:00'}] ${sec.heading || ''}:</strong> ${sec.content || ''}`;
        bodyContainer.appendChild(p);
      });
    } else if (data.script.body) {
      bodyContainer.innerHTML = `<p style="color:#e2e8f0; line-height:1.6;">${data.script.body}</p>`;
    }
  }

  // Render Titles
  const titlesList = document.getElementById('ai-titles-list');
  titlesList.innerHTML = '';
  (data.viralTitles || []).forEach((item) => {
    const titleText = typeof item === 'string' ? item : item.title;
    const hookType = typeof item === 'object' ? (item.hookType || 'Viral') : 'Viral High-CTR';
    const clickScore = typeof item === 'object' ? (item.clickScore || 95) : 95;

    const card = document.createElement('div');
    card.className = 'title-option-card';
    card.innerHTML = `
      <div style="flex:1;">
        <span style="font-weight:500; font-size:0.88rem;">${titleText}</span>
        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Loại Hook: ${hookType}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="title-score-badge">CTR: ${clickScore}/100</span>
        <button type="button" class="btn btn-sm btn-outline" onclick="selectAiTitle('${titleText.replace(/'/g, "\\'")}')">
          Chọn tiêu đề này
        </button>
      </div>
    `;
    titlesList.appendChild(card);
  });

  // Render Description
  document.getElementById('ai-generated-desc').value = data.seoDescription || '';

  // Render Tags
  const tagsContainer = document.getElementById('ai-tags-container');
  tagsContainer.innerHTML = '';
  (data.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'tag-pill';
    span.textContent = tag.startsWith('#') ? tag : `#${tag}`;
    tagsContainer.appendChild(span);
  });

  // Render Channel Variants
  const variantsContainer = document.getElementById('ai-channel-variants-container');
  variantsContainer.innerHTML = '';
  if (data.channelVariants && data.channelVariants.length > 0) {
    data.channelVariants.forEach(v => {
      const vCard = document.createElement('div');
      vCard.style.padding = '8px';
      vCard.style.border = '1px solid var(--border-subtle)';
      vCard.style.borderRadius = 'var(--radius-sm)';
      vCard.style.marginBottom = '6px';
      vCard.innerHTML = `
        <div style="color:var(--text-primary); font-weight:600;">${v.channelTitle}</div>
        <div style="color:var(--text-secondary); margin-top:2px;">Tiêu đề: ${v.customTitle}</div>
      `;
      variantsContainer.appendChild(vCard);
    });
  } else {
    variantsContainer.innerHTML = '<em>Đã tối ưu hóa tiêu đề và mô tả sẵn sàng phân phối đa kênh.</em>';
  }
}

function copyFullScript() {
  if (!lastAiResult || !lastAiResult.script) return;
  const s = lastAiResult.script;
  let text = `KỊCH BẢN VIDEO:\n\nHOOK:\n${s.hook}\n\nNỘI DUNG CHÍNH:\n`;
  if (s.bodySections) {
    s.bodySections.forEach(b => {
      text += `[${b.time}] ${b.heading}: ${b.content}\n`;
    });
  }
  text += `\nCALL TO ACTION:\n${s.callToAction}`;
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('Đã sao chép kịch bản đầy đủ vào Clipboard.', 'success');
  }).catch(() => {
    showToast('Đã tạo kịch bản.');
  });
}

function selectAiTitle(title) {
  document.getElementById('video-title').value = title;
  showToast('Đã áp dụng tiêu đề vào form.');
}

// ==================== AI SCRIPT STUDIO, VOICEOVER TTS & VIDEO RENDERER ====================
let currentGeneratedAudioUrl = null;
let currentRenderedVideoUrl = null;
let aiGeneratedData = null;

function initGeminiStudio() {
  const form = document.getElementById('gemini-ai-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const topic = document.getElementById('ai-topic').value.trim();
    if (!topic) {
      showToast('Vui lòng nhập chủ đề video!', 'warning');
      return;
    }

    const targetAudience = document.getElementById('ai-audience').value.trim();
    const tone = document.getElementById('ai-tone').value;
    const customKey = document.getElementById('ai-key-input').value.trim();

    const selectedBrand = brandsState.find(b => (b._id || b.id) === activeBrandId);
    const brandName = selectedBrand ? selectedBrand.name : '';

    const btn = document.getElementById('btn-generate-ai');
    const loadingText = document.getElementById('ai-loading-text');

    btn.disabled = true;
    loadingText.style.display = 'inline-block';

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          topic,
          targetAudience,
          tone,
          brandName,
          apiKey: customKey
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        lastAiResult = data.data;
        aiGeneratedData = {
          titles: (data.data.viralTitles || []).map(t => typeof t === 'string' ? t : t.title),
          description: data.data.seoDescription || '',
          tags: (data.data.tags || []).map(t => t.replace(/^#/, ''))
        };
        renderAiResults(data.data, data.isAiGenerated, data.provider);
        showToast('Multi-AI Pool đã hoàn tất sinh kịch bản!', 'success');
      } else {
        showToast(data.message || 'Lỗi phân tích nội dung', 'error');
      }
    } catch (err) {
      showToast('Lỗi gửi yêu cầu: ' + err.message, 'error');
    } finally {
      loadingText.style.display = 'none';
      btn.disabled = false;
    }
  });
}

function getFullScriptText() {
  if (!lastAiResult || !lastAiResult.script) {
    const topic = document.getElementById('ai-topic')?.value.trim();
    return topic || 'Kịch bản video tự động hóa 2026.';
  }
  const s = lastAiResult.script;
  let text = `${s.hook || ''}. `;
  if (s.bodySections && Array.isArray(s.bodySections)) {
    s.bodySections.forEach(b => {
      text += `${b.content || ''}. `;
    });
  } else if (s.body) {
    text += `${s.body}. `;
  }
  text += `${s.cta || s.callToAction || ''}`;
  return text.trim();
}

async function generateVoiceFromScript() {
  const scriptText = getFullScriptText();
  if (!scriptText || scriptText.length < 5) {
    showToast('Vui lòng tạo kịch bản AI trước khi tạo giọng đọc!', 'warning');
    return;
  }

  const voiceSelect = document.getElementById('tts-voice-select');
  const voice = voiceSelect ? voiceSelect.value : 'vi-female';
  const btn = document.getElementById('btn-generate-voice');
  const playerContainer = document.getElementById('tts-player-container');
  const audioPlayer = document.getElementById('tts-audio-player');

  btn.disabled = true;
  btn.textContent = '⏳ Đang tổng hợp giọng đọc...';

  try {
    const res = await fetch('/api/voice/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        text: scriptText,
        voice,
        rate: 0,
        pitch: 0
      })
    });

    const data = await res.json();
    if (data.success && data.audioUrl) {
      currentGeneratedAudioUrl = data.audioUrl;
      if (audioPlayer) {
        audioPlayer.src = data.audioUrl;
        audioPlayer.load();
        audioPlayer.play().catch(() => {});
      }
      if (playerContainer) playerContainer.style.display = 'block';
      showToast(`Đã tạo âm thanh thành công (${data.provider || 'Edge Neural TTS'})! Đang phát thử...`, 'success');
    } else {
      showToast(data.message || 'Lỗi tạo giọng đọc AI', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối TTS: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo File Âm Thanh MP3';
  }
}

async function renderVideoFromAiStudio() {
  const scriptText = getFullScriptText();
  if (!scriptText || scriptText.length < 5) {
    showToast('Vui lòng nhập chủ đề và sinh kịch bản AI trước khi ghép video!', 'warning');
    return;
  }

  const aspectSelect = document.getElementById('video-aspect-select');
  const aspectRatio = aspectSelect ? aspectSelect.value : '9:16';
  const title = (aiGeneratedData?.titles && aiGeneratedData.titles[0]) || 'Video Shorts Tự Động';

  const btn = document.getElementById('btn-render-video');
  const progressBox = document.getElementById('render-progress-box');
  const statusText = document.getElementById('render-status-text');
  const percentText = document.getElementById('render-percent-text');
  const progressBar = document.getElementById('render-progress-bar');
  const resultBox = document.getElementById('render-result-box');

  btn.disabled = true;
  progressBox.style.display = 'block';
  resultBox.style.display = 'none';
  statusText.textContent = 'Khởi tạo render video MP4 kèm phụ đề Karaoke...';
  percentText.textContent = '15%';
  progressBar.style.width = '15%';

  // Nếu chưa tạo audio thì tự động gọi TTS luôn (Không bắt user phải bấm 2 lần!)
  let audioUrl = currentGeneratedAudioUrl;
  if (!audioUrl) {
    statusText.textContent = 'Đang tự động thu âm giọng đọc AI...';
    try {
      const voiceRes = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: scriptText, voice: 'vi-female' })
      });
      const voiceData = await voiceRes.json();
      if (voiceData.success && voiceData.audioUrl) {
        audioUrl = voiceData.audioUrl;
        currentGeneratedAudioUrl = audioUrl;
      }
    } catch (e) {}
  }

  percentText.textContent = '40%';
  progressBar.style.width = '40%';
  statusText.textContent = 'Đang biên tập B-Roll & Phụ đề Karaoke Hormozi...';

  try {
    const res = await fetch('/api/video/render', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title,
        scriptText,
        audioUrl: audioUrl || '',
        aspectRatio,
        karaokeStyle: 'hormozi-yellow'
      })
    });

    const data = await res.json();
    if (data.success && data.jobId) {
      pollRenderJobProgress(data.jobId);
    } else {
      progressBox.style.display = 'none';
      btn.disabled = false;
      showToast(data.message || 'Lỗi render video', 'error');
    }
  } catch (err) {
    progressBox.style.display = 'none';
    btn.disabled = false;
    showToast('Lỗi kết nối render: ' + err.message, 'error');
  }
}

function pollRenderJobProgress(jobId) {
  const statusText = document.getElementById('render-status-text');
  const percentText = document.getElementById('render-percent-text');
  const progressBar = document.getElementById('render-progress-bar');
  const resultBox = document.getElementById('render-result-box');
  const btn = document.getElementById('btn-render-video');

  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/video/status/${jobId}`, { headers: getAuthHeaders() });
      const data = await res.json();

      if (data.success && data.status) {
        const percent = data.status.progress || 50;
        progressBar.style.width = `${percent}%`;
        percentText.textContent = `${percent}%`;

        if (data.status.status === 'SUCCESS' || percent >= 100) {
          clearInterval(pollInterval);
          btn.disabled = false;
          statusText.textContent = 'Hoàn tất render video MP4!';
          currentRenderedVideoUrl = data.status.videoUrl;
          resultBox.style.display = 'flex';
          showToast('Đã tạo thành công video MP4 kèm phụ đề Karaoke!', 'success');
        } else if (data.status.status === 'FAILED') {
          clearInterval(pollInterval);
          btn.disabled = false;
          statusText.textContent = 'Render thất bại: ' + (data.status.error || 'Lỗi không xác định');
          showToast('Render video thất bại', 'error');
        }
      }
    } catch (err) {
      clearInterval(pollInterval);
      btn.disabled = false;
    }
  }, 1000);
}

function pushRenderedVideoToPublisher() {
  applyAllAiToPublisher();
  showToast('Đã chuyển Video & Tiêu đề sang Bảng Phân Phối Sẵn Sàng Đăng!', 'success');
}

// ==================== HỆ THỐNG HƯỚNG DẪN SỬ DỤNG (GUIDE MODAL LOGIC) ====================
const guideTopicsData = {
  'publish-tab': {
    title: '📖 Hướng Dẫn Phân Phối Video Đa Kênh',
    html: `
      <p><strong>Bước 1:</strong> Chọn video MP4/MOV từ máy tính hoặc dùng video vừa tạo từ AI Studio.</p>
      <p><strong>Bước 2:</strong> Chọn danh sách các Kênh YouTube, Fanpage Facebook, hoặc Kênh TikTok bạn muốn đăng.</p>
      <p><strong>Bước 3:</strong> Nhập Tiêu đề, Mô tả, Tags (hoặc bấm <em>"Tùy biến riêng từng kênh"</em> để cá nhân hóa nội dung).</p>
      <p><strong>Bước 4:</strong> Bấm <strong>"Bắt Đầu Đăng Video"</strong>. Hệ thống chạy nền tự động tải lên và lưu lịch sử.</p>
    `
  },
  'gemini-tab': {
    title: '🤖 Hướng Dẫn AI Script Studio & Video Generator',
    html: `
      <p><strong>1. Sinh Kịch Bản:</strong> Nhập chủ đề ➔ Bấm <em>"Sinh Kịch Bản Nhanh"</em> hoặc <em>"⚡ AI Săn Trend & Tranh Luận"</em>.</p>
      <p><strong>2. Tạo Giọng Đọc AI (TTS):</strong> Chọn giọng Hoài My / Nam Minh ➔ Bấm <em>"Tạo File Âm Thanh MP3"</em> để nghe thử tức thì.</p>
      <p><strong>3. Ghép Video & Karaoke:</strong> Chọn tỉ lệ (9:16 Dọc) ➔ Bấm <em>"Ghép & Tạo Video Tự Động"</em>. Video sẽ tự động ghép B-Roll chuyển động và phụ đề chạy chữ vàng Hormozi.</p>
      <p><strong>4. Xuất Bản Hoặc Edit:</strong> Bấm <em>"🎬 Xuất Dự Án CapCut (PC)"</em> để mở trong CapCut, hoặc bấm <em>"Chuyển Sang Phân Phối"</em> để đăng ngay.</p>
    `
  },
  'clipper-tab': {
    title: '✂️ Hướng Dẫn Cắt Video Dài Thành Shorts (Opus AI)',
    html: `
      <p><strong>Bước 1:</strong> Dán link YouTube video dài (Podcast, Review, Talkshow) vào ô nhập.</p>
      <p><strong>Bước 2:</strong> Bấm <strong>"⚡ Bắt Đầu Quét & Trích Xuất Shorts Viral"</strong>.</p>
      <p><strong>Bước 3:</strong> AI sẽ quét toàn bộ video và trả về 3-5 đoạn cao trào kèm <strong>Điểm Viral Score (/100)</strong> và câu Hook 3s.</p>
      <p><strong>Bước 4:</strong> Bấm <strong>"🚀 Đăng Clip Này Ngay"</strong> để chuyển clip sang xuất bản đa kênh.</p>
    `
  },
  'planner-tab': {
    title: '📅 Hướng Dẫn Lịch Ma Trận & Auto-Pilot 5 Bước',
    html: `
      <p><strong>Ma Trận Đăng Bài:</strong> Xem lịch phát sóng 7 ngày trong tuần cho từng kênh.</p>
      <p><strong>🚀 Zero-Touch Auto-Pilot:</strong> Chọn nhóm kênh ➔ Bấm <em>"⚡ Chạy 1 Chu Kỳ Auto-Pilot Ngay"</em>. Hệ thống sẽ tự động thực hiện 5 bước khép kín:</p>
      <ul>
        <li>1. Quét từ khóa hot trend</li>
        <li>2. Viết kịch bản chuẩn viral</li>
        <li>3. Thu âm giọng đọc Edge TTS</li>
        <li>4. Render Video kèm phụ đề Karaoke</li>
        <li>5. Xuất bản đồng loạt lên tất cả các kênh trong nhóm!</li>
      </ul>
    `
  },
  'brands-tab': {
    title: '🏷️ Hướng Dẫn Quản Lý Brand & Nhóm Kênh',
    html: `
      <p><strong>Quản lý Multi-Brand:</strong> Tạo không gian riêng cho từng khách hàng hoặc từng dự án (Mỗi Brand có kịch bản và tone giọng riêng).</p>
      <p><strong>Tạo Nhóm Kênh:</strong> Vào tab Mạng Xã Hội ➔ Bấm <em>"➕ Tạo Nhóm Kênh"</em> để gom các page/kênh cùng chủ đề (Hài hước, Tin tức, Review) giúp quản lý và đăng bài 1-click.</p>
    `
  },
  'channels-tab': {
    title: '🔗 Hướng Dẫn Kết Nối Mạng Xã Hội',
    html: `
      <p><strong>YouTube:</strong> Bấm nút <em>"Kết Nối Kênh YouTube"</em> và đăng nhập tài khoản Google.</p>
      <p><strong>Facebook Fanpage & TikTok:</strong> Chọn Brand và kết nối tài khoản tương ứng.</p>
      <p><strong>Quản lý trạng thái:</strong> Theo dõi Token hết hạn và kiểm tra tình trạng kênh trực tiếp.</p>
    `
  },
  'analytics-tab': {
    title: '📈 Hướng Dẫn Cố Vấn Tăng Trưởng AI (Growth Advisor)',
    html: `
      <p><strong>Điểm Tăng Trưởng:</strong> Đánh giá hiệu quả tổng thể đa kênh từ 0-100 điểm.</p>
      <p><strong>Khung Giờ Vàng:</strong> Xem thời điểm khán giả tương tác cao nhất trong ngày để lên lịch đăng.</p>
      <p><strong>Chủ đề gợi ý:</strong> Nhận các công thức và chủ đề được AI dự báo sẽ bùng nổ tiếp theo.</p>
    `
  },
  'admin-tab': {
    title: '👑 Hướng Dẫn Quản Trị Hệ Thống (Admin Hub)',
    html: `
      <p><strong>Cấp Tài Khoản Dùng Thử:</strong> Tạo tài khoản test 10 phút cho khách hàng trải nghiệm.</p>
      <p><strong>Quản lý Quota & Giám sát:</strong> Theo dõi toàn bộ lịch sử phân phối và chặn người dùng lạm dụng.</p>
    `
  }
};

function openGuideModal() {
  const modal = document.getElementById('guide-modal');
  if (!modal) return;

  // Tự động nhận diện tab đang mở để chọn hướng dẫn phù hợp
  const activeTab = document.querySelector('.nav-tab.active')?.getAttribute('data-tab') || 'publish-tab';
  switchGuideTopic(activeTab);
  modal.classList.add('open');
}

function closeGuideModal() {
  const modal = document.getElementById('guide-modal');
  if (modal) modal.classList.remove('open');
}

function switchGuideTopic(topicId) {
  const contentEl = document.getElementById('guide-modal-content');
  const titleEl = document.getElementById('guide-modal-title');
  const topic = guideTopicsData[topicId] || guideTopicsData['publish-tab'];

  if (titleEl) titleEl.textContent = topic.title;
  if (contentEl) contentEl.innerHTML = topic.html;

  document.querySelectorAll('#guide-modal button[onclick^="switchGuideTopic"]').forEach(btn => {
    const fnStr = btn.getAttribute('onclick') || '';
    if (fnStr.includes(topicId)) {
      btn.style.borderColor = '#38bdf8';
      btn.style.color = '#38bdf8';
    } else {
      btn.style.borderColor = 'var(--border-subtle)';
      btn.style.color = 'var(--text-secondary)';
    }
  });
}

// ==================== DROPZONES & PREVIEWS ====================
function initDropzones() {
  const videoDropzone = document.getElementById('video-dropzone');
  const videoInput = document.getElementById('video-input');
  const videoPreviewContainer = document.getElementById('video-preview-container');
  const videoPlayer = document.getElementById('video-preview-player');
  const videoNameEl = document.getElementById('video-file-name');
  const videoSizeEl = document.getElementById('video-file-size');
  const removeVideoBtn = document.getElementById('remove-video-btn');
  const videoStatusTag = document.getElementById('video-status-tag');
  const videoTitleInput = document.getElementById('video-title');

  videoDropzone.addEventListener('click', () => videoInput.click());
  videoDropzone.addEventListener('dragover', (e) => { e.preventDefault(); videoDropzone.classList.add('dragover'); });
  videoDropzone.addEventListener('dragleave', () => videoDropzone.classList.remove('dragover'));
  videoDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    videoDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleVideoFile(e.dataTransfer.files[0]);
  });
  videoInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleVideoFile(e.target.files[0]);
  });

  function handleVideoFile(file) {
    videoFile = file;
    videoNameEl.textContent = file.name;
    videoSizeEl.textContent = formatBytes(file.size);
    videoPlayer.src = URL.createObjectURL(file);
    videoDropzone.style.display = 'none';
    videoPreviewContainer.style.display = 'block';

    videoStatusTag.className = 'status-badge status-success';
    videoStatusTag.textContent = 'Đã chọn video';

    if (!videoTitleInput.value.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      videoTitleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
  }

  removeVideoBtn.addEventListener('click', () => {
    videoFile = null;
    videoInput.value = '';
    videoPlayer.src = '';
    videoDropzone.style.display = 'block';
    videoPreviewContainer.style.display = 'none';
    videoStatusTag.className = 'status-badge status-pending';
    videoStatusTag.textContent = 'Chưa chọn video';
  });

  const thumbDropzone = document.getElementById('thumb-dropzone');
  const thumbInput = document.getElementById('thumb-input');
  const thumbPreviewContainer = document.getElementById('thumb-preview-container');
  const thumbPreviewImg = document.getElementById('thumb-preview-img');
  const thumbNameEl = document.getElementById('thumb-file-name');
  const thumbSizeEl = document.getElementById('thumb-file-size');
  const removeThumbBtn = document.getElementById('remove-thumb-btn');

  thumbDropzone.addEventListener('click', () => thumbInput.click());
  thumbDropzone.addEventListener('dragover', (e) => { e.preventDefault(); thumbDropzone.classList.add('dragover'); });
  thumbDropzone.addEventListener('dragleave', () => thumbDropzone.classList.remove('dragover'));
  thumbDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    thumbDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleThumbFile(e.dataTransfer.files[0]);
  });
  thumbInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleThumbFile(e.target.files[0]);
  });

  function handleThumbFile(file) {
    thumbFile = file;
    thumbNameEl.textContent = file.name;
    thumbSizeEl.textContent = formatBytes(file.size);
    thumbPreviewImg.src = URL.createObjectURL(file);
    thumbDropzone.style.display = 'none';
    thumbPreviewContainer.style.display = 'block';
  }

  removeThumbBtn.addEventListener('click', () => {
    thumbFile = null;
    thumbInput.value = '';
    thumbPreviewImg.src = '';
    thumbDropzone.style.display = 'block';
    thumbPreviewContainer.style.display = 'none';
  });
}

// ==================== ACCORDION & CUSTOM METADATA ====================
function toggleAccordion() {
  const acc = document.getElementById('custom-channel-accordion');
  const arrow = document.getElementById('accordion-arrow');
  acc.classList.toggle('open');
  arrow.textContent = acc.classList.contains('open') ? '▲' : '▼';
}

function renderChannelOverrides() {
  const container = document.getElementById('channel-overrides-container');
  container.innerHTML = '';

  if (selectedChannelIds.size === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem;">Vui lòng chọn ít nhất 1 kênh để cấu hình.</p>';
    return;
  }

  selectedChannelIds.forEach(channelId => {
    const channel = channelsState.find(c => c.id === channelId);
    if (!channel) return;

    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    div.style.padding = '8px';
    div.style.background = 'var(--bg-surface)';
    div.style.borderRadius = 'var(--radius-sm)';
    div.style.border = '1px solid var(--border-subtle)';

    div.innerHTML = `
      <div style="font-weight:500; font-size:0.82rem; margin-bottom:4px;">
        ${channel.title}
      </div>
      <input type="text" class="form-input override-title" data-channel-id="${channel.id}" placeholder="Tiêu đề riêng (Để trống nếu dùng chung)" style="margin-bottom:4px; font-size:0.8rem; padding:6px 10px;">
      <textarea class="form-textarea override-desc" data-channel-id="${channel.id}" placeholder="Mô tả riêng (Để trống nếu dùng chung)" style="font-size:0.8rem; min-height:45px; padding:6px 10px;"></textarea>
    `;
    container.appendChild(div);
  });
}

// ==================== CATEGORIES, QUOTA & HISTORY ====================
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success) {
      const select = document.getElementById('video-category');
      select.innerHTML = '';
      data.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.title;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Lỗi tải danh mục:', err);
  }
}

async function loadQuota() {
  try {
    const res = await fetch('/api/quota');
    const data = await res.json();
    if (data.success) {
      const q = data.quota;
      document.getElementById('quota-used-text').textContent = formatNumber(q.unitsUsed);
      document.getElementById('quota-detail-text').textContent = `${formatNumber(q.unitsUsed)} / ${formatNumber(q.limit)} Units`;
      
      const percent = Math.min(100, Math.round((q.unitsUsed / q.limit) * 100));
      const fillBar = document.getElementById('quota-progress-bar');
      fillBar.style.width = `${percent}%`;
    }
  } catch (err) {
    console.error('Lỗi tải quota:', err);
  }
}

async function loadHistory() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/history', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const history = data.history || [];
      const tbody = document.getElementById('history-table-body');
      const emptyState = document.getElementById('empty-history-state');
      tbody.innerHTML = '';

      if (history.length === 0) {
        emptyState.style.display = 'block';
        return;
      }
      emptyState.style.display = 'none';

      history.forEach(item => {
        const tr = document.createElement('tr');
        const dateStr = new Date(item.createdAt).toLocaleString('vi-VN');
        
        let channelsHtml = '';
        if (item.channels && item.channels.length > 0) {
          channelsHtml = item.channels.map(c => {
            if (c.status === 'success') {
              return `<div style="margin-bottom:3px;">
                <span class="status-badge status-success">Thành công: ${c.channelTitle}</span>
                <a href="${c.videoUrl}" target="_blank" style="color:var(--text-primary); text-decoration:underline; margin-left:6px;">Xem video ↗</a>
              </div>`;
            } else {
              return `<div style="margin-bottom:3px;">
                <span class="status-badge status-failed">Thất bại: ${c.channelTitle}</span>
                <span style="color:#f87171; font-size:0.74rem; margin-left:4px;" title="${c.error || ''}">${c.error ? c.error.slice(0, 30) + '...' : 'Lỗi'}</span>
              </div>`;
            }
          }).join('');
        }

        tr.innerHTML = `
          <td style="color:var(--text-muted); white-space:nowrap; font-size:0.78rem;">${dateStr}</td>
          <td><strong>${item.title}</strong><br><span style="font-size:0.72rem; color:var(--text-muted);">${item.videoOriginalName || ''} (${formatBytes(item.fileSize || 0)})</span></td>
          <td><span class="status-badge status-pending">${item.targetCount || (item.channels ? item.channels.length : 1)} Kênh</span></td>
          <td>${channelsHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Lỗi tải lịch sử:', err);
  }
}

// ==================== FORM SUBMISSION & BACKGROUND QUEUE UPLOAD ====================
function initFormSubmit() {
  const form = document.getElementById('upload-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
      window.location.href = '/login';
      return;
    }

    if (!videoFile) {
      showToast('Vui lòng chọn file video trước khi đăng!', 'error');
      return;
    }

    if (selectedChannelIds.size === 0) {
      showToast('Vui lòng chọn ít nhất 1 kênh!', 'error');
      return;
    }

    const title = document.getElementById('video-title').value.trim();
    if (!title) {
      showToast('Vui lòng nhập tiêu đề video!', 'error');
      return;
    }

    const channelOverrides = {};
    document.querySelectorAll('.override-title').forEach(input => {
      const channelId = input.dataset.channelId;
      const customTitle = input.value.trim();
      const customDesc = document.querySelector(`.override-desc[data-channel-id="${channelId}"]`)?.value.trim();
      if (customTitle || customDesc) {
        channelOverrides[channelId] = {
          title: customTitle,
          description: customDesc
        };
      }
    });

    const formData = new FormData();
    formData.append('video', videoFile);
    if (thumbFile) formData.append('thumbnail', thumbFile);
    formData.append('title', title);
    formData.append('description', document.getElementById('video-description').value);
    formData.append('tags', document.getElementById('video-tags').value);
    formData.append('categoryId', document.getElementById('video-category').value);
    formData.append('privacyStatus', document.getElementById('video-privacy').value);
    formData.append('publishAt', document.getElementById('video-publish-at').value);
    formData.append('madeForKids', document.getElementById('made-for-kids').value);
    formData.append('selectedChannels', JSON.stringify(Array.from(selectedChannelIds)));
    formData.append('channelOverrides', JSON.stringify(channelOverrides));

    openUploadModal();

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: formData
      });

      const data = await res.json();
      if (data.success && data.jobId) {
        showToast(data.message || 'Đã khởi tạo tiến trình xử lý nền.');
        startUploadJobPolling(data.jobId);
      } else {
        updateModalError(data.message || 'Xảy ra lỗi khi tiếp nhận upload.');
        showToast(data.message || 'Lỗi upload', 'error');
      }
    } catch (err) {
      updateModalError('Không thể gửi file lên máy chủ: ' + err.message);
      showToast('Lỗi kết nối', 'error');
    }
  });
}

function openUploadModal() {
  const modal = document.getElementById('upload-modal');
  const statusList = document.getElementById('modal-channel-status-list');
  const closeBtn = document.getElementById('btn-close-modal');
  const progressBar = document.getElementById('overall-progress-bar');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');

  if (uploadJobPollInterval) {
    clearInterval(uploadJobPollInterval);
    uploadJobPollInterval = null;
  }

  statusList.innerHTML = '';
  closeBtn.style.display = 'none';
  progressBar.style.width = '10%';
  title.textContent = 'Đang Phân Phối Video...';
  subtitle.textContent = `Đang đưa ${selectedChannelIds.size} kênh vào hàng đợi nền. Vui lòng chờ...`;

  selectedChannelIds.forEach(id => {
    const channel = channelsState.find(c => c.id === id);
    const row = document.createElement('div');
    row.className = 'upload-channel-row';
    row.id = `modal-row-${id}`;
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${channel ? channel.thumbnailUrl : ''}" style="width:22px; height:22px; border-radius:50%;">
        <strong>${channel ? channel.title : id}</strong>
      </div>
      <span class="status-badge status-pending" id="status-badge-${id}">Đang chờ...</span>
    `;
    statusList.appendChild(row);
  });

  modal.classList.add('active');
}

// Polling tiến độ Background Job
function startUploadJobPolling(jobId) {
  if (uploadJobPollInterval) clearInterval(uploadJobPollInterval);

  uploadJobPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/upload/job/${jobId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.job) {
        renderJobProgress(data.job);
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          clearInterval(uploadJobPollInterval);
          uploadJobPollInterval = null;
          loadChannels();
          loadQuota();
          loadHistory();
          if (document.getElementById('analytics-tab').classList.contains('active')) {
            loadAnalyticsData();
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi polling Job tiến trình:', e.message);
    }
  }, 1200);
}

function renderJobProgress(job) {
  const progressBar = document.getElementById('overall-progress-bar');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');
  const closeBtn = document.getElementById('btn-close-modal');

  progressBar.style.width = `${job.overallProgress}%`;

  if (job.status === 'processing') {
    title.textContent = `Đang Tải Lên Nền (${job.overallProgress}%)...`;
    subtitle.textContent = `Đã hoàn thành ${job.completedChannels}/${job.totalChannels} kênh.`;
  } else if (job.status === 'completed') {
    title.textContent = 'Phân Phối Hoàn Tất!';
    subtitle.textContent = `Đã hoàn tất tải lên ${job.completedChannels}/${job.totalChannels} kênh.`;
    closeBtn.style.display = 'inline-flex';
    showToast('Đã hoàn tất phân phối video đa kênh!', 'success');
  } else if (job.status === 'failed') {
    title.textContent = 'Phân Phối Thất Bại';
    subtitle.textContent = `Tất cả kênh đều gặp sự cố khi tải lên.`;
    closeBtn.style.display = 'inline-flex';
    showToast('Phân phối video gặp lỗi', 'error');
  }

  // Cập nhật trạng thái từng kênh
  if (job.channelsProgress && Array.isArray(job.channelsProgress)) {
    job.channelsProgress.forEach(ch => {
      const badge = document.getElementById(`status-badge-${ch.channelId}`);
      if (badge) {
        if (ch.status === 'uploading') {
          badge.className = 'status-badge status-pending';
          badge.textContent = `Đang tải (${ch.progress || 0}%)`;
        } else if (ch.status === 'success') {
          badge.className = 'status-badge status-success';
          badge.innerHTML = `Hoàn tất - <a href="${ch.videoUrl}" target="_blank" style="color:var(--text-primary); text-decoration:underline;">Xem YouTube ↗</a>`;
        } else if (ch.status === 'failed') {
          badge.className = 'status-badge status-failed';
          badge.innerHTML = `Lỗi (${ch.error || 'Thất bại'})`;
        }
      }
    });
  }
}

function updateModalError(errMsg) {
  if (uploadJobPollInterval) {
    clearInterval(uploadJobPollInterval);
    uploadJobPollInterval = null;
  }
  const closeBtn = document.getElementById('btn-close-modal');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');
  title.textContent = 'Có Lỗi Xảy Ra';
  subtitle.textContent = errMsg;
  closeBtn.style.display = 'inline-flex';
}

function closeUploadModal() {
  if (uploadJobPollInterval) {
    clearInterval(uploadJobPollInterval);
    uploadJobPollInterval = null;
  }
  document.getElementById('upload-modal').classList.remove('active');
}

// ==================== TOAST NOTIFICATIONS & UTILS ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ==================== ADMIN TEST USERS MANAGEMENT ====================
function initAdminPanel() {
  const refreshBtn = document.getElementById('btn-refresh-admin-users');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadAdminTestUsers();
      showToast('Đã làm mới danh sách tài khoản khách hàng.');
    });
  }

  const form = document.getElementById('admin-create-test-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-test-email').value.trim();
      const password = document.getElementById('admin-test-pass').value.trim();
      const name = document.getElementById('admin-test-name').value.trim();
      const duration = document.getElementById('admin-test-duration').value || 10;

      if (!email || !password) {
        showToast('Vui lòng nhập đầy đủ Email và Mật khẩu cấp cho khách.', 'error');
        return;
      }

      await createAdminTestUser(email, password, name, duration);
      form.reset();
      document.getElementById('admin-test-duration').value = '10';
    });
  }
}

async function loadAdminTestUsers() {
  if (!authToken || !currentUser || currentUser.role !== 'admin') return;

  try {
    const res = await fetch('/api/admin/test-users', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      adminTestUsersList = data.users;
      renderAdminTestUsersTable();
      startAdminUsersTableCountdown();
    }
  } catch (err) {
    console.error('Lỗi tải danh sách tài khoản test:', err);
  }
}

function renderAdminTestUsersTable() {
  const tbody = document.getElementById('admin-test-users-tbody');
  const emptyState = document.getElementById('empty-admin-users-state');
  if (!tbody) return;

  if (adminTestUsersList.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = adminTestUsersList.map(u => {
    const remainingMins = Math.floor(u.remainingSeconds / 60);
    const remainingSecs = u.remainingSeconds % 60;
    const timeFormatted = `${String(remainingMins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;

    let statusBadge = '';
    let timeBadge = '';

    if (u.isLocked) {
      statusBadge = `<span class="status-badge status-pending" style="background:#dc2626; color:#fff;">Đã khóa</span>`;
      timeBadge = `<span style="color:var(--text-muted); font-family:monospace;">--:--</span>`;
    } else if (u.isExpired || u.remainingSeconds <= 0) {
      statusBadge = `<span class="status-badge status-failed" style="background:rgba(239,68,68,0.2); color:#ef4444;">Hết hạn 10p</span>`;
      timeBadge = `<span style="color:#ef4444; font-weight:600; font-family:monospace;">00:00 (Đã khóa)</span>`;
    } else {
      statusBadge = `<span class="status-badge status-success" style="background:rgba(16,185,129,0.2); color:#10b981;">Đang dùng thử</span>`;
      timeBadge = `<span id="admin-user-timer-${u.id}" style="color:#10b981; font-weight:600; font-family:monospace;">${timeFormatted}</span>`;
    }

    return `
      <tr>
        <td>
          <div style="font-weight:600; color:#fff;">${u.email}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${u.name || 'Khách dùng thử'}</div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <code style="background:var(--bg-main); padding:2px 6px; border-radius:4px; border:1px solid var(--border-subtle);">${u.plainPassword}</code>
            <button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px; font-size:0.72rem;" onclick="copyTestUserCredentials('${u.email}', '${u.plainPassword}')">
              Copy
            </button>
          </div>
        </td>
        <td>${u.durationMinutes || 10} phút</td>
        <td>${timeBadge}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center;">
          <div style="display:inline-flex; gap:4px;">
            <button type="button" class="btn btn-sm btn-accent" style="padding:3px 8px; font-size:0.75rem;" onclick="extendAdminTestUser('${u.id}', 10)">
              +10 Phút
            </button>
            <button type="button" class="btn btn-sm btn-outline" style="padding:3px 8px; font-size:0.75rem;" onclick="toggleLockAdminTestUser('${u.id}')">
              ${u.isLocked ? 'Mở Khóa' : 'Khóa'}
            </button>
            <button type="button" class="btn btn-sm btn-danger-outline" style="padding:3px 8px; font-size:0.75rem;" onclick="deleteAdminTestUser('${u.id}', '${u.email}')">
              Xóa
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function startAdminUsersTableCountdown() {
  if (adminUsersInterval) clearInterval(adminUsersInterval);

  adminUsersInterval = setInterval(() => {
    let hasActive = false;
    adminTestUsersList.forEach(u => {
      if (!u.isLocked && u.remainingSeconds > 0) {
        u.remainingSeconds--;
        hasActive = true;
        const el = document.getElementById(`admin-user-timer-${u.id}`);
        if (el) {
          const mins = Math.floor(u.remainingSeconds / 60);
          const secs = u.remainingSeconds % 60;
          el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          if (u.remainingSeconds === 0) {
            u.isExpired = true;
            renderAdminTestUsersTable();
          }
        }
      }
    });

    if (!hasActive && adminUsersInterval) {
      // Nothing actively ticking
    }
  }, 1000);
}

async function createAdminTestUser(email, password, name, durationMinutes) {
  const submitBtn = document.getElementById('btn-submit-create-test');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang cấp...';
  }

  try {
    const res = await fetch('/api/admin/create-test-user', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password, name, durationMinutes })
    });
    const data = await res.json();
    if (data.success && data.user) {
      showToast(`Đã cấp tài khoản cho khách: ${data.user.email} (Hạn mức ${durationMinutes} phút)`, 'success');
      loadAdminTestUsers();
    } else {
      showToast(data.message || 'Lỗi cấp tài khoản test', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Cấp Tài Khoản';
    }
  }
}

async function extendAdminTestUser(userId, minutes = 10) {
  try {
    const res = await fetch(`/api/admin/extend-test-user/${userId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ minutes })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadAdminTestUsers();
    } else {
      showToast(data.message || 'Lỗi gia hạn', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
  }
}

async function toggleLockAdminTestUser(userId) {
  try {
    const res = await fetch(`/api/admin/toggle-lock-user/${userId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadAdminTestUsers();
    } else {
      showToast(data.message || 'Lỗi thao tác', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
  }
}

async function deleteAdminTestUser(userId, email) {
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản test ${email}?`)) return;

  try {
    const res = await fetch(`/api/admin/test-users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa tài khoản test thành công.', 'success');
      loadAdminTestUsers();
    } else {
      showToast(data.message || 'Lỗi xóa tài khoản', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }
}

function copyTestUserCredentials(email, password) {
  const text = `Tài khoản dùng thử YouTube Multi-Publisher (Hạn dùng 10 phút):\nEmail: ${email}\nMật khẩu: ${password}\nĐăng nhập tại: ${window.location.origin}/login`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Đã sao chép thông tin tài khoản vào Clipboard!', 'success');
  }).catch(() => {
    showToast(`Email: ${email} | Mật khẩu: ${password}`);
  });
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatNumber(num) {
  return new Intl.NumberFormat('vi-VN').format(num || 0);
}

// ==================== ANALYTICS DASHBOARD & CHART.JS ====================
async function loadAnalyticsData() {
  if (!authToken || typeof Chart === 'undefined') return;

  try {
    const res = await fetch('/api/analytics/overview', {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!data.success || !data.data) return;

    const { kpi, channelStats, distributionStatus, recentTrend } = data.data;

    // 1. Cập nhật các thẻ KPI
    document.getElementById('kpi-total-channels').textContent = formatNumber(kpi.totalChannels);
    document.getElementById('kpi-total-subscribers').textContent = formatNumber(kpi.totalSubscribers);
    document.getElementById('kpi-total-views').textContent = formatNumber(kpi.totalViews);
    document.getElementById('kpi-total-videos').textContent = formatNumber(kpi.totalVideosPublished);

    // Cấu hình chung cho Chart.js nền tối
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#232838';
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

    // 2. Chart 1: Quy mô kênh (Subscribers & Views)
    const ctx1 = document.getElementById('channelStatsChart')?.getContext('2d');
    if (ctx1) {
      if (chartInstances.channelStats) chartInstances.channelStats.destroy();
      chartInstances.channelStats = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: channelStats.labels.length > 0 ? channelStats.labels : ['Chưa có kênh'],
          datasets: [
            {
              label: 'Người đăng ký',
              data: channelStats.subscribers.length > 0 ? channelStats.subscribers : [0],
              backgroundColor: 'rgba(56, 189, 248, 0.75)',
              borderColor: '#38bdf8',
              borderWidth: 1,
              borderRadius: 4
            },
            {
              label: 'Lượt xem',
              data: channelStats.views.length > 0 ? channelStats.views : [0],
              backgroundColor: 'rgba(167, 139, 250, 0.75)',
              borderColor: '#a78bfa',
              borderWidth: 1,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: '#1e2433' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Chart 2: Xu hướng đăng video 7 ngày
    const ctx2 = document.getElementById('trendChart')?.getContext('2d');
    if (ctx2) {
      if (chartInstances.trend) chartInstances.trend.destroy();
      chartInstances.trend = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: recentTrend.labels,
          datasets: [{
            label: 'Video đã đăng',
            data: recentTrend.data,
            borderColor: '#e11d48',
            backgroundColor: 'rgba(225, 29, 72, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#e11d48',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#1e2433' } },
            x: { grid: { color: '#1e2433' } }
          }
        }
      });
    }

    // 4. Chart 3: Phân bổ số video từng kênh
    const ctx3 = document.getElementById('videoDistChart')?.getContext('2d');
    if (ctx3) {
      if (chartInstances.videoDist) chartInstances.videoDist.destroy();
      chartInstances.videoDist = new Chart(ctx3, {
        type: 'bar',
        data: {
          labels: channelStats.labels.length > 0 ? channelStats.labels : ['Chưa có kênh'],
          datasets: [{
            label: 'Số lượng video',
            data: channelStats.videos.length > 0 ? channelStats.videos : [0],
            backgroundColor: 'rgba(52, 211, 153, 0.75)',
            borderColor: '#34d399',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: '#1e2433' } },
            y: { grid: { display: false } }
          }
        }
      });
    }

    // 5. Chart 4: Tỷ lệ phân phối thành công / thất bại
    const ctx4 = document.getElementById('successRateChart')?.getContext('2d');
    if (ctx4) {
      if (chartInstances.successRate) chartInstances.successRate.destroy();
      const hasData = distributionStatus.data.some(v => v > 0);
      chartInstances.successRate = new Chart(ctx4, {
        type: 'doughnut',
        data: {
          labels: distributionStatus.labels,
          datasets: [{
            data: hasData ? distributionStatus.data : [1, 0],
            backgroundColor: hasData ? ['#34d399', '#f87171'] : ['#293043', '#1e2433'],
            borderColor: '#141721',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
          }
        }
      });
    }

  } catch (err) {
    console.warn('Lỗi tải số liệu Analytics:', err.message);
  }
}

// ==================== MULTI-BRAND MANAGEMENT ====================
async function loadBrands() {
  if (!authToken) return;
  try {
    const res = await fetch('/api/brands', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.brands) {
      brandsState = data.brands;
      document.getElementById('brand-count-badge').textContent = brandsState.length;
      renderNavBrandSelector();
      renderBrandsManager();
    }
  } catch (e) {
    console.warn('Lỗi tải danh sách Brand:', e.message);
  }
}

function renderNavBrandSelector() {
  const select = document.getElementById('nav-brand-select');
  if (!select) return;

  select.innerHTML = '<option value="">(Tất Cả / Mặc Định)</option>';
  brandsState.forEach(b => {
    const bId = b._id || b.id;
    const opt = document.createElement('option');
    opt.value = bId;
    opt.textContent = b.name;
    if (bId === activeBrandId) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = (e) => {
    activeBrandId = e.target.value;
    localStorage.setItem('ytb_active_brand', activeBrandId);
    showToast(activeBrandId ? `Đã chọn Brand: ${e.target.options[e.target.selectedIndex].text}` : 'Đã chọn chế độ Chung.');
    
    // Tự động điền tệp khán giả và giọng văn tương ứng vào AI Studio
    const found = brandsState.find(b => (b._id || b.id) === activeBrandId);
    if (found) {
      if (document.getElementById('ai-audience')) document.getElementById('ai-audience').value = found.targetAudience || '';
      if (document.getElementById('ai-tone')) document.getElementById('ai-tone').value = found.toneOfVoice || 'Hấp dẫn, kích thích tò mò';
    }
  };
}

function renderBrandsManager() {
  const container = document.getElementById('brands-grid-container');
  const emptyState = document.getElementById('empty-brands-state');
  if (!container) return;

  container.innerHTML = '';
  if (brandsState.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  brandsState.forEach(brand => {
    const bId = brand._id || brand.id;
    const isCurrentActive = bId === activeBrandId;
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.background = 'var(--bg-input)';
    card.style.padding = '16px';
    card.style.borderColor = isCurrentActive ? '#38bdf8' : 'var(--border-subtle)';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:12px; height:12px; border-radius:50%; background:${brand.primaryColor || '#e11d48'};"></div>
          <h4 style="color:#fff; font-size:0.95rem; font-weight:700; margin:0;">${brand.name}</h4>
        </div>
        ${isCurrentActive ? '<span class="status-badge status-success" style="font-size:0.7rem;">Đang chọn</span>' : ''}
      </div>

      <p style="font-size:0.8rem; color:var(--text-muted); min-height:36px; margin-bottom:12px;">
        ${brand.description || 'Chưa có mô tả định vị thương hiệu.'}
      </p>

      <div style="background:#121622; padding:10px; border-radius:var(--radius-sm); font-size:0.75rem; color:var(--text-secondary); margin-bottom:14px;">
        <div><strong>Khán giả:</strong> ${brand.targetAudience || 'Khán giả đại chúng'}</div>
        <div style="margin-top:3px;"><strong>Giọng văn:</strong> ${brand.toneOfVoice || 'Hấp dẫn, kích thích tò mò'}</div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <button type="button" class="btn btn-sm ${isCurrentActive ? 'btn-outline' : 'btn-primary'}" onclick="setActiveBrandId('${bId}')">
          ${isCurrentActive ? 'Đang kích hoạt' : 'Kích hoạt Brand này'}
        </button>
        <button type="button" class="btn btn-sm btn-danger-outline" onclick="deleteBrandItem('${bId}')">
          Xóa
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function setActiveBrandId(id) {
  activeBrandId = id;
  localStorage.setItem('ytb_active_brand', activeBrandId);
  renderNavBrandSelector();
  renderBrandsManager();
  showToast('Đã chuyển đổi Brand làm việc thành công!', 'success');
}

function openCreateBrandModal() {
  document.getElementById('brand-id-hidden').value = '';
  document.getElementById('brand-name-input').value = '';
  document.getElementById('brand-desc-input').value = '';
  document.getElementById('brand-audience-input').value = 'Khán giả đại chúng';
  document.getElementById('brand-tone-input').value = 'Hấp dẫn, kích thích tò mò';
  document.getElementById('brand-modal-title').textContent = 'Tạo Thương Hiệu Mới (Brand)';
  document.getElementById('brand-modal').classList.add('active');
}

function closeBrandModal() {
  document.getElementById('brand-modal').classList.remove('active');
}

function initBrandFormSubmit() {
  const form = document.getElementById('brand-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('brand-name-input').value.trim();
    const description = document.getElementById('brand-desc-input').value.trim();
    const targetAudience = document.getElementById('brand-audience-input').value.trim();
    const toneOfVoice = document.getElementById('brand-tone-input').value;

    if (!name) {
      showToast('Vui lòng nhập tên Brand!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description, targetAudience, toneOfVoice })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã tạo Brand thành công!', 'success');
        closeBrandModal();
        loadBrands();
      } else {
        showToast(data.message || 'Lỗi tạo Brand', 'error');
      }
    } catch (err) {
      showToast('Lỗi gửi request: ' + err.message, 'error');
    }
  });
}

async function deleteBrandItem(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa Brand này?')) return;
  try {
    const res = await fetch(`/api/brands/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      if (activeBrandId === id) {
        activeBrandId = '';
        localStorage.removeItem('ytb_active_brand');
      }
      showToast('Đã xóa Brand thành công.', 'success');
      loadBrands();
    } else {
      showToast(data.message || 'Lỗi xóa Brand', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }
}

// ==================== CONTENT LIBRARY (KHO NỘI DUNG) ====================
async function loadContentProjects() {
  if (!authToken) return;
  try {
    const url = activeBrandId ? `/api/content?brandId=${activeBrandId}` : '/api/content';
    const res = await fetch(url, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.projects) {
      contentProjectsState = data.projects;
      document.getElementById('content-count-badge').textContent = contentProjectsState.length;
      renderContentProjects('ALL');
    }
  } catch (e) {
    console.warn('Lỗi tải kho nội dung:', e.message);
  }
}

function renderContentProjects(filterStatus = 'ALL') {
  const container = document.getElementById('content-projects-grid');
  const emptyState = document.getElementById('empty-content-state');
  if (!container) return;

  container.innerHTML = '';
  const filtered = filterStatus === 'ALL' ? contentProjectsState : contentProjectsState.filter(p => p.status === filterStatus);

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  filtered.forEach(proj => {
    const pId = proj._id || proj.id;
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.background = 'var(--bg-input)';
    card.style.padding = '14px';

    const statusBadge = {
      IDEA: '<span class="status-badge status-pending">Ý tưởng</span>',
      SCRIPT_GENERATED: '<span class="status-badge" style="background:#1e293b; color:#38bdf8; border:1px solid #38bdf8;">Đã có kịch bản</span>',
      READY: '<span class="status-badge status-success">Sẵn sàng</span>',
      PUBLISHED: '<span class="status-badge" style="background:#064e3b; color:#34d399;">Đã xuất bản</span>'
    }[proj.status] || '<span class="status-badge status-pending">Bản nháp</span>';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <h4 style="color:#fff; font-size:0.92rem; font-weight:700; margin:0; flex:1; padding-right:8px;">${proj.title}</h4>
        ${statusBadge}
      </div>

      <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:10px;">
        Chủ đề: ${proj.topic || 'Tổng quan'}
      </p>

      ${proj.scriptData?.hook ? `
        <div style="background:#121622; padding:8px 10px; border-radius:4px; font-size:0.75rem; color:var(--text-secondary); margin-bottom:12px; border-left:2px solid #e11d48;">
          <strong>Hook:</strong> ${proj.scriptData.hook.substring(0, 75)}...
        </div>
      ` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
        <button type="button" class="btn btn-sm btn-primary" onclick="applyContentProjectToPublisher('${pId}')">
          Đăng video này
        </button>
        <button type="button" class="btn btn-sm btn-danger-outline" onclick="deleteContentProjectItem('${pId}')">
          Xóa
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterContentStatus(status) {
  document.querySelectorAll('.active-filter').forEach(el => el.classList.remove('active-filter'));
  event.target.classList.add('active-filter');
  renderContentProjects(status);
}

async function saveCurrentAiToLibrary() {
  if (!lastAiResult) {
    showToast('Chưa có nội dung AI nào để lưu!', 'error');
    return;
  }

  const title = lastAiResult.viralTitles?.[0]?.title || document.getElementById('video-title')?.value || 'Nội dung Video Mới';
  const topic = document.getElementById('ai-topic')?.value || title;

  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        brandId: activeBrandId,
        title,
        topic,
        contentType: 'SHORT',
        status: 'SCRIPT_GENERATED',
        scriptData: lastAiResult.script,
        seoMetadata: {
          viralTitles: lastAiResult.viralTitles,
          description: lastAiResult.seoDescription,
          tags: lastAiResult.tags
        }
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Đã lưu kịch bản vào Kho Nội Dung (Content Vault)!', 'success');
      loadContentProjects();
    } else {
      showToast(data.message || 'Lỗi lưu kho', 'error');
    }
  } catch (err) {
    showToast('Lỗi gửi request: ' + err.message, 'error');
  }
}

function applyContentProjectToPublisher(id) {
  const proj = contentProjectsState.find(p => (p._id || p.id) === id);
  if (!proj) return;

  if (proj.title) document.getElementById('video-title').value = proj.title;
  if (proj.seoMetadata?.description) document.getElementById('video-description').value = proj.seoMetadata.description;
  if (proj.seoMetadata?.tags) document.getElementById('video-tags').value = proj.seoMetadata.tags.join(', ');

  switchTab('publish-tab');
  showToast('Đã điền tiêu đề và mô tả từ Kho Nội Dung vào form đăng video!');
}

async function deleteContentProjectItem(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa nội dung này?')) return;
  try {
    const res = await fetch(`/api/content/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa nội dung.', 'success');
      loadContentProjects();
    } else {
      showToast(data.message || 'Lỗi xóa', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }
}

// ==================== CONTENT MATRIX PLANNER ====================
async function loadContentPlans() {
  if (!authToken) return;
  try {
    const url = activeBrandId ? `/api/planner?brandId=${activeBrandId}` : '/api/planner';
    const res = await fetch(url, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.plans) {
      contentPlansState = data.plans;
      renderContentPlansMatrix();
    }
  } catch (e) {
    console.warn('Lỗi tải lịch Planner:', e.message);
  }
}

function renderContentPlansMatrix() {
  const container = document.getElementById('planner-matrix-container');
  if (!container) return;

  const days = [
    { key: 'MONDAY', label: 'Thứ Hai' },
    { key: 'TUESDAY', label: 'Thứ Ba' },
    { key: 'WEDNESDAY', label: 'Thứ Tư' },
    { key: 'THURSDAY', label: 'Thứ Năm' },
    { key: 'FRIDAY', label: 'Thứ Sáu' },
    { key: 'SATURDAY', label: 'Thứ Bảy' },
    { key: 'SUNDAY', label: 'Chủ Nhật' }
  ];

  container.innerHTML = '';
  days.forEach(day => {
    const dayCol = document.createElement('div');
    dayCol.className = 'matrix-day-col';
    dayCol.innerHTML = `<div class="matrix-day-header">${day.label}</div>`;

    const dayPlans = contentPlansState.filter(p => p.dayOfWeek === day.key);
    if (dayPlans.length === 0) {
      dayCol.innerHTML += '<p style="font-size:0.72rem; color:var(--text-muted); text-align:center; margin-top:20px;">Trống</p>';
    } else {
      dayPlans.forEach(slot => {
        const slotEl = document.createElement('div');
        slotEl.className = 'plan-slot-card';
        slotEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="plan-slot-time">${slot.timeSlot}</div>
            <button type="button" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem;" onclick="deletePlanItem('${slot._id || slot.id}')">✕</button>
          </div>
          <div class="plan-slot-theme">${slot.topicTheme}</div>
          <div class="plan-slot-badges">
            ${(slot.targetPlatforms || []).map(p => `<span class="platform-badge">${p === 'YOUTUBE' ? 'YT' : p === 'FACEBOOK' ? 'FB' : 'TT'}</span>`).join('')}
          </div>
        `;
        dayCol.appendChild(slotEl);
      });
    }
    container.appendChild(dayCol);
  });
}

function openCreatePlanModal() {
  document.getElementById('plan-modal').classList.add('active');
}

function closeCreatePlanModal() {
  document.getElementById('plan-modal').classList.remove('active');
}

function initPlanFormSubmit() {
  const form = document.getElementById('plan-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const dayOfWeek = document.getElementById('plan-day-select').value;
    const timeSlot = document.getElementById('plan-time-input').value;
    const topicTheme = document.getElementById('plan-theme-input').value.trim();

    const targetPlatforms = [];
    if (document.getElementById('plan-plat-yt').checked) targetPlatforms.push('YOUTUBE');
    if (document.getElementById('plan-plat-fb').checked) targetPlatforms.push('FACEBOOK');
    if (document.getElementById('plan-plat-tt').checked) targetPlatforms.push('TIKTOK');

    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          brandId: activeBrandId,
          dayOfWeek,
          timeSlot,
          topicTheme,
          targetPlatforms
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Đã thêm slot lịch đăng ma trận!', 'success');
        closeCreatePlanModal();
        loadContentPlans();
      } else {
        showToast(data.message || 'Lỗi thêm lịch', 'error');
      }
    } catch (err) {
      showToast('Lỗi gửi request: ' + err.message, 'error');
    }
  });
}

async function deletePlanItem(id) {
  try {
    const res = await fetch(`/api/planner/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa slot lịch.', 'success');
      loadContentPlans();
    }
  } catch (e) {
    showToast('Lỗi xóa lịch: ' + e.message, 'error');
  }
}

// ==================== MULTI-PLATFORM SOCIAL CONNECTORS ====================
async function connectFacebook() {
  if (!currentUser) {
    window.location.href = '/login';
    return;
  }
  try {
    const res = await fetch('/api/social/facebook/url', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.authUrl) {
      window.open(data.authUrl, 'FacebookAuth', 'width=600,height=700');
    } else {
      openFbTokenModal();
    }
  } catch (err) {
    openFbTokenModal();
  }
}

function openFbTokenModal() {
  document.getElementById('fb-token-modal').classList.add('active');
}

function closeFbTokenModal() {
  document.getElementById('fb-token-modal').classList.remove('active');
}

async function submitFbToken(e) {
  e.preventDefault();
  const token = document.getElementById('fb-token-input').value.trim();
  if (!token) return;

  const btn = document.getElementById('btn-submit-fb-token');
  btn.disabled = true;
  btn.textContent = 'Đang quét Fanpage...';

  try {
    const res = await fetch('/api/social/facebook/token', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Đã liên kết Fanpage thành công!', 'success');
      closeFbTokenModal();
      document.getElementById('fb-token-input').value = '';
      loadChannels();
      loadQuota();
    } else {
      showToast(data.message || 'Lỗi liên kết Fanpage', 'error');
    }
  } catch (err) {
    showToast('Lỗi gửi token: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Liên Kết Fanpage Ngay';
  }
}

async function connectTikTok() {
  if (!currentUser) {
    window.location.href = '/login';
    return;
  }
  
  const width = 600;
  const height = 750;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  const popup = window.open('about:blank', 'TikTokAuth', `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`);
  
  try {
    const res = await fetch('/api/social/tiktok/url', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.authUrl) {
      if (popup) {
        popup.location.href = data.authUrl;
      } else {
        window.location.href = data.authUrl;
      }
      
      const interval = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(interval);
          setTimeout(() => {
            loadChannels();
          }, 1000);
        }
      }, 1000);
    } else {
      if (popup) popup.close();
      showToast(data.message || 'Chưa cấu hình TikTok Client Credentials', 'error');
    }
  } catch (err) {
    if (popup) popup.close();
    showToast('Lỗi kết nối TikTok: ' + err.message, 'error');
  }
}

// ==================== END AI VIDEO HELPERS ====================

// ==================== HƯỚNG DẪN SỬ DỤNG TƯƠNG TÁC (INTERACTIVE GUIDE SYSTEM) ====================
const GUIDE_TOPICS = {
  'publish-tab': {
    title: 'Hướng Dẫn: Phân Phối Video Đa Kênh (Publishing Engine)',
    html: `
      <div style="background:#11151f; border-left:3px solid #e11d48; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Tải lên 1 video và phân phối đồng thời sang hàng chục kênh YouTube, Fanpage Facebook, TikTok cùng lúc mà không lo nghẽn mạng hay khóa trình duyệt.
      </div>
      <h4 style="color:#f8fafc; margin-bottom:6px;">Quy trình 4 bước thực hiện:</h4>
      <ol style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;"><strong>Bước 1 - Chọn Video & Thumbnail:</strong> Kéo thả hoặc bấm chọn file video (MP4, MOV, MKV) và ảnh bìa Thumbnail tùy chọn.</li>
        <li style="margin-bottom:6px;"><strong>Bước 2 - Chọn Kênh Nhận Video:</strong> Tích chọn các kênh bạn muốn đăng (có thể dùng nút <em>"Chọn tất cả kênh"</em> để thao tác nhanh).</li>
        <li style="margin-bottom:6px;"><strong>Bước 3 - Soạn Tiêu Đề & Mô Tả:</strong> Nhập tiêu đề, mô tả chuẩn SEO, bộ thẻ Tags hoặc bấm <em>"Áp dụng từ AI Studio"</em> để tự động điền trong 1 giây.</li>
        <li style="margin-bottom:6px;"><strong>Bước 4 - Tùy Chọn Lập Lịch & Đăng:</strong> Đặt chế độ <em>Công khai (Public)</em> hoặc <em>Hẹn giờ (Scheduled)</em>, sau đó bấm <strong>"Bắt Đầu Phân Phối Video"</strong>.</li>
      </ol>
      <div style="background:#121724; border:1px solid #232838; padding:10px 12px; border-radius:6px;">
        <strong style="color:#38bdf8;">Tính năng Hàng Đợi Nền (Background Queue):</strong>
        <p style="margin-top:4px; font-size:0.8rem; color:var(--text-muted);">
          Hệ thống sử dụng Resumable Stream Worker chạy nền. Khi bấm đăng, cửa sổ tiến trình hiển thị tỷ lệ % từng kênh theo thời gian thực và bạn có thể yên tâm làm việc khác.
        </p>
      </div>
    `
  },
  'gemini-tab': {
    title: 'Hướng Dẫn: AI Script Studio & Multi-AI Failover Pool',
    html: `
      <div style="background:#11151f; border-left:3px solid #38bdf8; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Tự động sinh kịch bản video ngắn (Shorts/Reels), Hook 3s cuốn hút, 5 tiêu đề viral CTR cao và gói từ khóa SEO tối ưu.
      </div>
      <h4 style="color:#f8fafc; margin-bottom:6px;">Cách thao tác:</h4>
      <ol style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;"><strong>Nhập ý tưởng / chủ đề:</strong> Điền chủ đề bạn muốn làm video (Ví dụ: <em>Top 5 công cụ AI lập trình đỉnh nhất 2026</em>).</li>
        <li style="margin-bottom:6px;"><strong>Chọn Giọng Văn (Tone):</strong> Chọn phong cách phù hợp như <em>Hấp dẫn & Tò mò</em>, <em>Kịch tính & Cảnh báo</em>, <em>Hài hước</em>, hoặc <em>Chuyên sâu</em>.</li>
        <li style="margin-bottom:6px;"><strong>Bấm "Sinh Kịch Bản":</strong> Hệ thống tự động kết nối qua <strong>Multi-AI Failover Pool</strong> (Groq Llama 3.3 ➔ Gemini 2.5 Flash ➔ OpenRouter ➔ Smart Fallback Engine) để đảm bảo không bao giờ gián đoạn.</li>
        <li style="margin-bottom:6px;"><strong>Sử dụng kết quả:</strong> Bấm <em>"Sao chép kịch bản"</em>, bấm <em>"Lưu vào kho nội dung"</em> hoặc bấm <em>"Áp dụng vào bảng đăng video"</em> để xuất bản ngay.</li>
      </ol>
    `
  },
  'content-tab': {
    title: 'Hướng Dẫn: Kho Lưu Trữ Nội Dung (Content Vault)',
    html: `
      <div style="background:#11151f; border-left:3px solid #34d399; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Quản lý vòng đời sản xuất content từ khâu Ý tưởng (Idea) ➔ Kịch bản (Script) ➔ Sẵn sàng (Ready) ➔ Đã xuất bản (Published).
      </div>
      <ul style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;"><strong>Lưu trữ tự động:</strong> Mỗi kịch bản sinh từ AI Studio có thể lưu trực tiếp vào Kho gắn liền với Brand đang chọn.</li>
        <li style="margin-bottom:6px;"><strong>Bộ lọc trạng thái:</strong> Lọc nhanh các bài viết đang ở giai đoạn nào để lên lịch sản xuất video phù hợp.</li>
        <li style="margin-bottom:6px;"><strong>1-Click Phân Phối:</strong> Bấm nút <em>"Đăng video này"</em> trên thẻ bài viết để tự động điền toàn bộ kịch bản, tiêu đề, tags vào bảng đăng video.</li>
      </ul>
    `
  },
  'planner-tab': {
    title: 'Hướng Dẫn: Lịch Ma Trận Phân Phối Đa Kênh (Matrix Scheduler)',
    html: `
      <div style="background:#11151f; border-left:3px solid #f59e0b; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Quy hoạch lịch xuất bản tự động theo 7 ngày trong tuần và các khung giờ vàng (Prime Time).
      </div>
      <ol style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;">Bấm nút <strong>"Thêm Slot Lịch Đăng"</strong> ở góc trên bên phải.</li>
        <li style="margin-bottom:6px;">Chọn Thứ trong tuần (Thứ 2 đến Chủ Nhật) và khung giờ đăng mong muốn (Ví dụ: <code>09:00</code>, <code>15:00</code>, <code>20:00</code>).</li>
        <li style="margin-bottom:6px;">Nhập Chủ đề bài đăng định kỳ (Ví dụ: <em>AI News Thứ 2</em>, <em>Review Tool Thứ 4</em>).</li>
        <li style="margin-bottom:6px;">Tích chọn các nền tảng mục tiêu (YouTube Shorts, Facebook Reels, TikTok) và bấm <em>Lưu Slot Lịch</em>.</li>
      </ol>
    `
  },
  'brands-tab': {
    title: 'Hướng Dẫn: Quản Trị Đa Thương Hiệu (Multi-Brand Hub)',
    html: `
      <div style="background:#11151f; border-left:3px solid #a855f7; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Tạo và quản lý không giới hạn các Brand độc lập cho từng khách hàng hoặc từng dự án kinh doanh.
      </div>
      <ul style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;"><strong>Tạo Brand mới:</strong> Bấm <em>"Tạo Brand Mới"</em>, điền Tên thương hiệu, Mô tả định vị, Tệp khán giả mục tiêu và Giọng văn (Tone of Voice).</li>
        <li style="margin-bottom:6px;"><strong>Chuyển đổi Brand:</strong> Dùng bộ chọn <em>"Thương Hiệu Đang Chọn"</em> ở trên cùng của Sidebar bên trái để đổi Brand làm việc trong 1-click.</li>
        <li style="margin-bottom:6px;"><strong>Tự động đồng bộ:</strong> Khi bạn chọn Brand nào, AI Script Studio và Kho nội dung sẽ tự động nhận diện persona của Brand đó để sinh nội dung đúng chất riêng.</li>
      </ul>
    `
  },
  'channels-tab': {
    title: 'Hướng Dẫn: Quản Lý Mạng Xã Hội (YouTube / Facebook / TikTok)',
    html: `
      <div style="background:#11151f; border-left:3px solid #0284c7; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Ủy quyền và liên kết các kênh YouTube, Fanpage Facebook và TikTok Creator vào hệ thống.
      </div>
      <ol style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;"><strong>Thêm Kênh YouTube:</strong> Bấm nút <code>Thêm Kênh YouTube</code> ➔ Đăng nhập tài khoản Google và cấp quyền quản trị kênh.</li>
        <li style="margin-bottom:6px;"><strong>Thêm Fanpage Facebook:</strong> Bấm nút <code>Kết Nối Facebook</code> ➔ Ủy quyền Meta Graph API để hệ thống tự động nhận diện danh sách Fanpage.</li>
        <li style="margin-bottom:6px;"><strong>Thêm Tài Khoản TikTok:</strong> Bấm nút <code>Kết Nối TikTok</code> ➔ Đăng nhập tài khoản TikTok Creator để kích hoạt Direct Post API.</li>
        <li style="margin-bottom:6px;"><strong>Đồng bộ số liệu:</strong> Bấm <em>"Đồng bộ số liệu"</em> để cập nhật số người đăng ký và tổng số video mới nhất từ server.</li>
      </ol>
    `
  },
  'analytics-tab': {
    title: 'Hướng Dẫn: Báo Cáo Thống Kê & Tăng Trưởng (Analytics Dashboard)',
    html: `
      <div style="background:#11151f; border-left:3px solid #10b981; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Theo dõi tổng thể chỉ số phát triển trên toàn bộ hệ thống kênh theo thời gian thực.
      </div>
      <ul style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;"><strong>Thẻ KPI Tổng Quan:</strong> Xem nhanh Tổng số kênh, Tổng lượng người đăng ký (Subscribers), Tổng lượt xem (Views) và Tổng số video đã phát.</li>
        <li style="margin-bottom:6px;"><strong>Biểu đồ so sánh Kênh:</strong> Trực quan hóa kênh nào đang có lượng tương tác và số lượng video nhiều nhất.</li>
        <li style="margin-bottom:6px;"><strong>Xu hướng phân phối 7 ngày:</strong> Theo dõi mật độ phát video đều đặn qua các ngày trong tuần.</li>
        <li style="margin-bottom:6px;"><strong>Tỷ lệ Thành Công (Success Rate):</strong> Đánh giá hiệu suất phân phối không lỗi.</li>
      </ul>
    `
  },
  'admin-tab': {
    title: 'Hướng Dẫn: Quản Trị Khách Dùng Thử (Admin Portal)',
    html: `
      <div style="background:#11151f; border-left:3px solid #fb7185; padding:10px 14px; border-radius:4px; margin-bottom:12px;">
        <strong>Mục tiêu:</strong> Cấp tài khoản dùng thử có thời hạn tự động (Auto-Expiry) cho khách hàng trải nghiệm an toàn.
      </div>
      <ol style="padding-left:20px; margin-bottom:12px;">
        <li style="margin-bottom:6px;"><strong>Cấp tài khoản mới:</strong> Nhập Email, Mật khẩu cấp cho khách và thời lượng (mặc định 10 phút).</li>
        <li style="margin-bottom:6px;"><strong>Tự động khóa:</strong> Khi hết 10 phút, tài khoản của khách tự động bị khóa và đăng xuất ngay lập tức.</li>
        <li style="margin-bottom:6px;"><strong>Gia hạn / Khóa thủ công:</strong> Bấm <em>"+10 Phút"</em> để gia hạn thêm hoặc bấm <em>"Khóa ngay"</em> / <em>"Mở khóa"</em> bất cứ lúc nào.</li>
      </ol>
    `
  }
};

function openGuideModal(topicId = null) {
  const currentTab = topicId || localStorage.getItem('ytb_active_tab') || 'publish-tab';
  switchGuideTopic(currentTab);
  document.getElementById('guide-modal').classList.add('active');
}

function closeGuideModal() {
  document.getElementById('guide-modal').classList.remove('active');
}

function switchGuideTopic(topicId) {
  const topic = GUIDE_TOPICS[topicId] || GUIDE_TOPICS['publish-tab'];
  
  // Highlight subtab
  document.querySelectorAll('#guide-modal .btn-outline, #guide-modal .active-guide-tab').forEach(b => {
    if (b.getAttribute('onclick')?.includes(topicId)) {
      b.classList.add('active-guide-tab');
      b.style.background = 'var(--accent-red)';
      b.style.borderColor = 'var(--accent-red)';
      b.style.color = '#fff';
    } else {
      b.classList.remove('active-guide-tab');
      b.style.background = 'transparent';
      b.style.borderColor = 'var(--border-subtle)';
      b.style.color = 'var(--text-secondary)';
    }
  });

  document.getElementById('guide-modal-title').textContent = topic.title;
  document.getElementById('guide-modal-content').innerHTML = topic.html;
}

// ==================== SIDEBAR COLLAPSE TOGGLE ====================
function initSidebarState() {
  const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  const sidebar = document.querySelector('.app-sidebar');
  const topbarToggle = document.getElementById('topbar-toggle-sidebar');
  if (isCollapsed && sidebar) {
    sidebar.classList.add('collapsed');
    if (topbarToggle) topbarToggle.style.display = 'inline-block';
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const topbarToggle = document.getElementById('topbar-toggle-sidebar');
  if (!sidebar) return;

  const isNowCollapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('sidebar_collapsed', isNowCollapsed ? 'true' : 'false');
  if (topbarToggle) {
    topbarToggle.style.display = isNowCollapsed ? 'inline-block' : 'none';
  }
}

// ==================== AI VOICEOVER TTS GENERATION ====================
async function generateVoiceFromScript() {
  if (!lastAiResult || !lastAiResult.script) {
    showToast('Chưa có kịch bản AI để tạo giọng đọc!', 'error');
    return;
  }
  const s = lastAiResult.script;
  let fullScriptText = `${s.hook || ''}. `;
  if (s.bodySections && Array.isArray(s.bodySections)) {
    s.bodySections.forEach(b => {
      fullScriptText += `${b.content || ''} `;
    });
  }
  fullScriptText += `${s.callToAction || ''}`;

  const voiceKey = document.getElementById('tts-voice-select').value;
  const btn = document.getElementById('btn-generate-voice');
  btn.disabled = true;
  btn.textContent = 'Đang tổng hợp giọng nói...';

  try {
    const res = await fetch('/api/voice/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: fullScriptText, voiceKey })
    });
    const data = await res.json();
    if (data.success && data.data?.url) {
      const container = document.getElementById('tts-player-container');
      const player = document.getElementById('tts-audio-player');
      player.src = data.data.url;
      container.style.display = 'block';
      player.play();
      showToast('Đã tạo file âm thanh Voiceover MP3 thành công!', 'success');
    } else {
      showToast(data.message || 'Lỗi tạo giọng đọc', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối TTS: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo File Âm Thanh MP3';
  }
}

// ==================== ANALYTICS DASHBOARD & CHART.JS ENGINE ====================
async function loadAnalyticsData() {
  if (!authToken) return;

  try {
    const res = await fetch('/api/analytics/overview', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.data) {
      const { kpi, channelStats, distributionStatus, recentTrend } = data.data;

      // Cập nhật KPI Cards
      document.getElementById('kpi-total-channels').textContent = kpi.totalChannels || 0;
      document.getElementById('kpi-total-subscribers').textContent = (kpi.totalSubscribers || 0).toLocaleString();
      document.getElementById('kpi-total-views').textContent = (kpi.totalViews || 0).toLocaleString();
      document.getElementById('kpi-total-videos').textContent = (kpi.totalVideosPublished || 0).toLocaleString();

      // Render Charts nếu có Chart.js
      if (window.Chart) {
        renderChannelStatsChart(channelStats);
        renderTrendChart(recentTrend);
        renderVideoDistChart(channelStats);
        renderSuccessRateChart(distributionStatus);
      }
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu Analytics:', err);
  }

  // Tự động tải báo cáo AI Growth Advisor
  loadGrowthAdvisorReport();
}

function renderChannelStatsChart(stats) {
  const ctx = document.getElementById('channelStatsChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstances.channelStats) chartInstances.channelStats.destroy();

  chartInstances.channelStats = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.labels.length ? stats.labels : ['Chưa có kênh'],
      datasets: [
        {
          label: 'Người đăng ký',
          data: stats.subscribers.length ? stats.subscribers : [0],
          backgroundColor: '#38bdf8',
          borderRadius: 4
        },
        {
          label: 'Lượt xem',
          data: stats.views.length ? stats.views : [0],
          backgroundColor: '#a78bfa',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('trendChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstances.trend) chartInstances.trend.destroy();

  chartInstances.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [{
        label: 'Video đã đăng',
        data: trend.data,
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderVideoDistChart(stats) {
  const ctx = document.getElementById('videoDistChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstances.videoDist) chartInstances.videoDist.destroy();

  chartInstances.videoDist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stats.labels.length ? stats.labels : ['Chưa có kênh'],
      datasets: [{
        label: 'Số lượng Video',
        data: stats.videos.length ? stats.videos : [0],
        backgroundColor: '#e11d48',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderSuccessRateChart(dist) {
  const ctx = document.getElementById('successRateChart')?.getContext('2d');
  if (!ctx) return;

  if (chartInstances.successRate) chartInstances.successRate.destroy();

  chartInstances.successRate = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dist.labels,
      datasets: [{
        data: dist.data[0] === 0 && dist.data[1] === 0 ? [1, 0] : dist.data,
        backgroundColor: ['#34d399', '#f43f5e'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } }
    }
  });
}

// ==================== AI GROWTH ADVISOR ====================
async function loadGrowthAdvisorReport() {
  if (!authToken) return;

  const headline = document.getElementById('growth-summary-headline');
  const scoreBadge = document.getElementById('growth-score-badge');
  const providerText = document.getElementById('growth-advisor-provider');
  const goldenBox = document.getElementById('growth-golden-hours');
  const viralBox = document.getElementById('growth-viral-formulas');
  const topicsBox = document.getElementById('growth-recommended-topics');
  const adviceText = document.getElementById('growth-strategic-advice');

  if (headline) headline.textContent = 'Đang phân tích dữ liệu đa kênh qua AI Pool...';

  try {
    const res = await fetch('/api/analytics/advisor', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.report) {
      const r = data.report;
      if (providerText) providerText.textContent = `Phân tích chuyên sâu bởi: ${data.provider}`;
      if (scoreBadge) scoreBadge.textContent = `${r.performanceScore || 88}/100`;
      if (headline) headline.textContent = `🎯 ${r.summaryHeadline || 'Hệ thống đang hoạt động ổn định!'}`;

      // Khung giờ vàng
      if (goldenBox) {
        goldenBox.innerHTML = (r.goldenPostingHours || []).map(h => `
          <div style="margin-bottom:6px;">
            <strong style="color:#fbbf24;">⚡ ${h.slot}:</strong>
            <span style="color:#94a3b8; display:block; font-size:0.72rem;">${h.reason}</span>
          </div>
        `).join('');
      }

      // Công thức viral
      if (viralBox) {
        viralBox.innerHTML = (r.viralFormulas || []).map(f => `
          <div style="margin-bottom:4px;">✨ ${f}</div>
        `).join('');
      }

      // Đề xuất chủ đề
      if (topicsBox) {
        topicsBox.innerHTML = (r.recommendedTopicsNext || []).map(t => `
          <div style="margin-bottom:4px;">🚀 ${t}</div>
        `).join('');
      }

      if (adviceText) adviceText.textContent = r.strategicAdvice || 'Duy trì lịch đăng đều đặn.';
    }
  } catch (err) {
    console.error('Lỗi tải Growth Advisor:', err);
  }
}

// ==================== ZERO-TOUCH AUTO-PILOT RUNNER ====================
async function triggerAutoPilotCycle() {
  const groupSelect = document.getElementById('autopilot-group-select');
  const selectedGroupId = groupSelect ? groupSelect.value : 'all';

  const btn = document.getElementById('btn-run-autopilot');
  const timelineBox = document.getElementById('autopilot-timeline-box');
  const stepsContainer = document.getElementById('autopilot-steps-container');
  const statusTitle = document.getElementById('autopilot-status-title');

  btn.disabled = true;
  timelineBox.style.display = 'block';
  statusTitle.textContent = '🚀 Đang kích hoạt chu trình Auto-Pilot tự động...';
  stepsContainer.innerHTML = '<div style="color:#38bdf8;">[1/5] Đang khởi động AI Multi-Agent và khảo sát trend...</div>';

  try {
    const res = await fetch('/api/planner/run-cycle', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        topic: 'AI Automation & Công Nghệ 2026',
        groupId: selectedGroupId,
        voice: 'vi-female'
      })
    });

    const data = await res.json();
    if (data.success) {
      statusTitle.textContent = `✅ Chu trình Auto-Pilot hoàn tất thành công (Cycle ID: ${data.cycleId?.substring(0,8)})!`;
      stepsContainer.innerHTML = '';

      (data.cycleLog || []).forEach(step => {
        const item = document.createElement('div');
        item.style.padding = '4px 0';
        item.style.borderBottom = '1px solid #1e293b';
        item.innerHTML = `<strong style="color:#34d399;">Bước ${step.step} - ${step.name}:</strong> <span style="color:#cbd5e1;">${step.message}</span>`;
        stepsContainer.appendChild(item);
      });

      showToast(`Đã xuất bản tự động video "${data.chosenTitle}" tới ${data.targetChannelsCount} kênh!`, 'success');
      loadHistory();
      loadAnalyticsData();
    } else {
      statusTitle.textContent = '❌ Auto-Pilot gặp lỗi: ' + (data.message || 'Lỗi không xác định');
      showToast(data.message || 'Lỗi chạy Auto-Pilot', 'error');
    }
  } catch (err) {
    statusTitle.textContent = '❌ Lỗi kết nối Auto-Pilot: ' + err.message;
    showToast('Lỗi Auto-Pilot: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// Cập nhật danh sách nhóm vào AutoPilot dropdown khi loadChannelGroups
const originalRenderChannelGroupsUI = renderChannelGroupsUI;
renderChannelGroupsUI = function() {
  if (typeof originalRenderChannelGroupsUI === 'function') originalRenderChannelGroupsUI();

  const autopilotSelect = document.getElementById('autopilot-group-select');
  if (autopilotSelect) {
    autopilotSelect.innerHTML = '<option value="all">Tất Cả Kênh & Fanpage</option>';
    channelGroupsState.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g._id || g.id;
      opt.textContent = `🏷️ ${g.name} (${(g.channelIds || []).length} kênh)`;
      autopilotSelect.appendChild(opt);
    });
  }
};

// ==================== TELEGRAM NOTIFICATION BOT ====================
function openTelegramModal() {
  const modal = document.getElementById('telegram-modal');
  const tokenInput = document.getElementById('tele-bot-token');
  const chatIdInput = document.getElementById('tele-chat-id');

  if (tokenInput) tokenInput.value = localStorage.getItem('tele_bot_token') || '';
  if (chatIdInput) chatIdInput.value = localStorage.getItem('tele_chat_id') || '';

  if (modal) modal.style.display = 'flex';
}

function closeTelegramModal() {
  const modal = document.getElementById('telegram-modal');
  if (modal) modal.style.display = 'none';
}

function handleSaveTelegramConfig(e) {
  e.preventDefault();
  const token = document.getElementById('tele-bot-token').value.trim();
  const chatId = document.getElementById('tele-chat-id').value.trim();

  localStorage.setItem('tele_bot_token', token);
  localStorage.setItem('tele_chat_id', chatId);

  showToast('Đã lưu cấu hình Telegram Bot thành công!', 'success');
  closeTelegramModal();
}

async function handleTestTelegram() {
  const token = document.getElementById('tele-bot-token').value.trim();
  const chatId = document.getElementById('tele-chat-id').value.trim();

  if (!token || !chatId) {
    showToast('Vui lòng nhập đầy đủ Bot Token và Chat ID trước khi test!', 'warning');
    return;
  }

  const btn = document.getElementById('btn-test-telegram');
  btn.disabled = true;
  btn.textContent = 'Đang gửi...';

  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ botToken: token, chatId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Đã gửi tin nhắn test thành công tới Telegram của bạn!', 'success');
    } else {
      showToast(data.message || 'Lỗi gửi tin nhắn Telegram', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Gửi Tin Nhắn Thử';
  }
}

// ==================== AUTONOMOUS WEB AGENT LIVE TRENDS SCANNER ====================
async function scanLiveTrends(platform = 'TIKTOK') {
  const box = document.getElementById('live-trends-results-box');
  const header = document.getElementById('live-trends-header');
  const container = document.getElementById('live-trends-chips-container');

  if (box) box.style.display = 'block';
  if (header) header.textContent = `⏳ Web Agent đang cào xu hướng thời gian thực từ ${platform}...`;
  if (container) container.innerHTML = '<div style="color:#38bdf8; font-size:0.75rem;">Đang kết nối DOM & phân tích mẫu tương tác...</div>';

  try {
    const res = await fetch('/api/browser/scan-trends', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ platform })
    });

    const data = await res.json();
    if (data.success && data.trends) {
      if (header) header.textContent = `🔥 Top Xu Hướng Hot Nhất ${platform} (Bấm vào từ khóa để tạo kịch bản ngay):`;
      if (container) {
        container.innerHTML = '';
        data.trends.forEach(t => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'btn btn-sm btn-outline';
          chip.style.padding = '4px 8px';
          chip.style.fontSize = '0.74rem';
          chip.style.borderColor = '#38bdf8';
          chip.style.color = '#fff';
          chip.style.background = '#090d16';
          chip.innerHTML = `<strong>#${t.rank}</strong> ${t.keyword} <span style="color:#34d399; font-size:0.68rem;">(${t.growthRate || '+100%'})</span>`;

          chip.onclick = () => {
            const topicInput = document.getElementById('ai-topic');
            if (topicInput) {
              topicInput.value = `${t.keyword} - ${t.insight || ''}`;
              showToast(`Đã áp dụng chủ đề: "${t.keyword}" vào AI Script Studio!`, 'success');
              topicInput.focus();
            }
          };

          container.appendChild(chip);
        });
      }
      showToast(`Web Agent đã quét thành công ${data.trends.length} xu hướng hot!`, 'success');
    } else {
      if (container) container.innerHTML = '<div style="color:#f43f5e; font-size:0.75rem;">Không thể quét trend. Vui lòng thử lại.</div>';
    }
  } catch (err) {
    if (container) container.innerHTML = `<div style="color:#f43f5e; font-size:0.75rem;">Lỗi kết nối: ${err.message}</div>`;
  }
}

// ==================== LONG-TO-SHORTS VIDEO CLIPPER (OPUS CLIP AI) ====================
let currentClippedData = null;

async function handleAnalyzeVideoClipper() {
  const url = document.getElementById('clipper-video-url')?.value.trim();
  const title = document.getElementById('clipper-video-title')?.value.trim();
  const transcript = document.getElementById('clipper-transcript-text')?.value.trim();

  if (!url && !title && !transcript) {
    showToast('Vui lòng nhập Link video, Tiêu đề hoặc Transcript.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-run-clipper');
  const loading = document.getElementById('clipper-loading-state');
  const empty = document.getElementById('clipper-empty-state');
  const list = document.getElementById('clipper-clips-list');

  btn.disabled = true;
  loading.style.display = 'block';
  empty.style.display = 'none';
  list.style.display = 'none';

  try {
    const res = await fetch('/api/clipper/analyze', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ videoUrl: url, videoTitle: title, transcriptText: transcript })
    });

    const data = await res.json();
    if (data.success && data.clips) {
      currentClippedData = data;
      renderClipperResults(data.clips);
      list.style.display = 'flex';
      showToast(`Đã tìm thấy ${data.clips.length} đoạn Shorts tiềm năng triệu view!`, 'success');
    } else {
      empty.style.display = 'block';
      showToast(data.message || 'Không thể phân tích video', 'error');
    }
  } catch (err) {
    empty.style.display = 'block';
    showToast('Lỗi kết nối Clipper: ' + err.message, 'error');
  } finally {
    loading.style.display = 'none';
    btn.disabled = false;
  }
}

function renderClipperResults(clips) {
  const list = document.getElementById('clipper-clips-list');
  if (!list) return;
  list.innerHTML = '';

  clips.forEach((clip, idx) => {
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.background = '#0d131f';
    card.style.border = '1px solid rgba(236, 72, 153, 0.4)';
    card.style.padding = '12px 14px';

    const scoreColor = clip.viralScore >= 90 ? '#34d399' : '#fbbf24';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
        <h4 style="font-size:0.88rem; font-weight:600; color:#fff;">${clip.clipTitle}</h4>
        <span style="font-size:0.72rem; font-weight:700; color:${scoreColor}; background:${scoreColor}20; padding:2px 8px; border-radius:10px; border:1px solid ${scoreColor}50;">
          Viral: ${clip.viralScore}/100
        </span>
      </div>
      <div style="font-size:0.75rem; color:#f472b6; font-weight:500; margin-bottom:6px;">
        ⏱️ Thời lượng: ${clip.durationSec}s (Từ ${clip.startSec}s ➔ ${clip.endSec}s)
      </div>
      <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4;">
        <strong>Hook 3s:</strong> "${clip.hookText}"<br>
        <span style="color:#94a3b8; font-size:0.72rem;">💡 ${clip.viralityReason}</span>
      </p>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #1e293b; padding-top:8px;">
        <span style="font-size:0.7rem; color:#64748b;">${(clip.suggestedTags || []).join(' ')}</span>
        <button type="button" class="btn btn-sm btn-primary" onclick="applyClipToPublisher('${clip.clipTitle.replace(/'/g, "\\'")}', '${clip.hookText.replace(/'/g, "\\'")}', '${(clip.suggestedTags || []).join(', ')}')" style="padding:3px 10px; font-size:0.74rem; background:#db2777; border-color:#ec4899;">
          🚀 Đăng Clip Này Ngay
        </button>
      </div>
    `;
    list.appendChild(card);
  });
}

function applyClipToPublisher(title, hook, tags) {
  const titleInput = document.getElementById('video-title');
  const descInput = document.getElementById('video-description');
  const tagsInput = document.getElementById('video-tags');

  if (titleInput) titleInput.value = title;
  if (descInput) descInput.value = `${hook}\n\nĐăng ký kênh để theo dõi thêm video hay mỗi ngày!`;
  if (tagsInput) tagsInput.value = tags;

  showToast(`Đã chuyển Clip "${title}" sang Bảng Phân Phối Video!`, 'success');
  switchTab('publish-tab');
}

// ==================== 1-CLICK CAPCUT DRAFT EXPORTER ====================
async function handleExportCapCutDraft() {
  const scriptText = document.getElementById('ai-script-preview')?.value.trim() || 'Kịch bản tự động';
  const title = (aiGeneratedData?.titles && aiGeneratedData.titles[0]) || 'Social Content Factory Project';

  try {
    const res = await fetch('/api/capcut/export', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title,
        scriptText,
        audioUrl: currentGeneratedAudioUrl || '',
        durationSec: 30,
        aspectRatio: '9:16'
      })
    });

    const data = await res.json();
    if (data.success && data.draftContent) {
      // Tự động tạo file download draft_content.json
      const blob = new Blob([JSON.stringify(data.draftContent, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `capcut_draft_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Đã tải xuống file dự án CapCut Draft JSON thành công! Bạn có thể import trực tiếp vào CapCut.', 'success');
    } else {
      showToast(data.message || 'Lỗi xuất CapCut Draft', 'error');
    }
  } catch (err) {
    showToast('Lỗi xuất CapCut: ' + err.message, 'error');
  }
}






