// ==================== STATE MANAGEMENT ====================
let authToken = localStorage.getItem('ytb_auth_token') || null;
let currentUser = null;
let channelsState = [];
let selectedChannelIds = new Set();
let videoFile = null;
let thumbFile = null;
let lastAiResult = null;
let testUserTimerInterval = null;
let adminUsersInterval = null;
let adminTestUsersList = [];

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initDropzones();
  loadCategories();
  initGeminiStudio();
  initFormSubmit();
  initOAuthListener();
  checkDbHealth();
  initAdminPanel();

  await checkAuthStatus();

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
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        renderNavUser();
        handleUserRolesAndTimers();
        loadChannels();
        loadQuota();
        loadHistory();
        return;
      } else if (data.isExpired || data.isLocked) {
        showToast(data.message || 'Tài khoản đã hết hạn hoặc bị khóa.', 'error');
        logout();
        return;
      }
    } catch (err) {
      console.warn('Phiên đăng nhập không hợp lệ:', err);
    }
  }

  currentUser = null;
  authToken = null;
  localStorage.removeItem('ytb_auth_token');
  renderNavUser();
  handleUserRolesAndTimers();
  renderChannelSelection();
  renderChannelsManager();
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
      timerText.textContent = `⏱️ Dùng thử: ${formatted}`;
    }

    if (timeLeft <= 0) {
      clearInterval(testUserTimerInterval);
      testUserTimerInterval = null;
      showToast('⚠️ Hết hạn 10 phút dùng thử! Phiên làm việc đã tự động khóa.', 'error');
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
        Đăng Nhập / Đăng Ký
      </a>
    `;
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('ytb_auth_token');
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

  // Lưu trạng thái tab hiện tại
  localStorage.setItem('ytb_active_tab', tabId);
  history.replaceState(null, null, '#' + tabId);
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

function renderChannelSelection() {
  const container = document.getElementById('channel-selection-list');
  const emptyPrompt = document.getElementById('no-channels-prompt');
  container.innerHTML = '';

  if (channelsState.length === 0) {
    emptyPrompt.style.display = 'block';
    return;
  }
  emptyPrompt.style.display = 'none';

  selectedChannelIds = new Set(channelsState.map(c => c.id));
  document.getElementById('select-all-channels').checked = true;

  channelsState.forEach(channel => {
    const isSelected = selectedChannelIds.has(channel.id);
    const card = document.createElement('div');
    card.className = `channel-card-select ${isSelected ? 'selected' : ''}`;
    card.dataset.id = channel.id;

    const avatarUrl = channel.thumbnailUrl || 'https://via.placeholder.com/36?text=YTB';
    card.innerHTML = `
      <input type="checkbox" ${isSelected ? 'checked' : ''} style="cursor:pointer; width:15px; height:15px; accent-color:var(--accent-red);">
      <img src="${avatarUrl}" class="channel-avatar" alt="Avatar">
      <div style="overflow:hidden; flex:1;">
        <div style="font-weight:500; font-size:0.86rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${channel.title}</div>
        <div style="font-size:0.72rem; color:var(--text-muted);">${formatNumber(channel.subscriberCount)} sub • ${formatNumber(channel.videoCount)} video</div>
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

    container.appendChild(card);
  });

  renderChannelOverrides();
}

function updateSelectAllStatus() {
  const selectAll = document.getElementById('select-all-channels');
  selectAll.checked = selectedChannelIds.size === channelsState.length && channelsState.length > 0;
}

function toggleSelectAllChannels(checked) {
  const cards = document.querySelectorAll('.channel-card-select');
  cards.forEach(card => {
    const id = card.dataset.id;
    const checkbox = card.querySelector('input');
    checkbox.checked = checked;
    if (checked) {
      selectedChannelIds.add(id);
      card.classList.add('selected');
    } else {
      selectedChannelIds.delete(id);
      card.classList.remove('selected');
    }
  });
  renderChannelOverrides();
}

function renderChannelsManager() {
  const grid = document.getElementById('channels-grid-container');
  const emptyState = document.getElementById('empty-channels-state');
  grid.innerHTML = '';

  if (channelsState.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  channelsState.forEach(channel => {
    const card = document.createElement('div');
    card.className = 'channel-item-card';

    const avatarUrl = channel.thumbnailUrl || 'https://via.placeholder.com/44?text=YTB';
    card.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <img src="${avatarUrl}" style="width:44px; height:44px; border-radius:50%; border:1px solid var(--border-subtle);" alt="Avatar">
          <div style="overflow:hidden;">
            <h4 style="font-size:0.95rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${channel.title}
            </h4>
            <a href="${channel.channelUrl}" target="_blank" class="channel-link-btn" title="Mở trang chủ YouTube của kênh này">
              Trang chủ kênh ↗
            </a>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:8px; background:var(--bg-input); border-radius:var(--radius-sm); margin-bottom:12px; font-size:0.76rem;">
          <div>
            <span style="color:var(--text-muted); display:block;">Người đăng ký:</span>
            <strong>${formatNumber(channel.subscriberCount)}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted); display:block;">Video đã đăng:</span>
            <strong style="color:#fff;">${formatNumber(channel.videoCount)}</strong>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px;">
        <span class="status-badge status-success">Đã xác thực</span>
        <button type="button" class="btn btn-sm btn-danger-outline" onclick="deleteChannel('${channel.id}', '${channel.title.replace(/'/g, "\\'")}')">
          Gỡ kênh
        </button>
      </div>
    `;

    grid.appendChild(card);
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

// ==================== GOOGLE OAUTH POPUP ====================
async function openOAuthPopup() {
  if (!currentUser) {
    window.location.href = '/login';
    return;
  }

  try {
    const res = await fetch(`/api/auth/url?userId=${currentUser.id}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.authUrl) {
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(
        data.authUrl,
        'google_oauth_popup',
        `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
      );
    } else {
      showToast('Không lấy được link cấp quyền', 'error');
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
          apiKey: customKey
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        lastAiResult = data.data;
        renderAiResults(data.data, data.isAiGenerated);
        showToast('Phân tích nội dung hoàn tất.');
      } else {
        showToast(data.message || 'Lỗi phân tích nội dung', 'error');
      }
    } catch (err) {
      showToast('Lỗi gửi yêu cầu: ' + err.message, 'error');
    } finally {
      loadingText.style.display = 'none';
      let cooldown = 4;
      const interval = setInterval(() => {
        btn.textContent = `Chờ (${cooldown}s)...`;
        cooldown--;
        if (cooldown < 0) {
          clearInterval(interval);
          btn.disabled = false;
          btn.textContent = 'Phân Tích & Tạo Nội Dung';
        }
      }, 1000);
    }
  });
}

function renderAiResults(data, isAiGenerated) {
  const wrapper = document.getElementById('ai-results-wrapper');
  wrapper.style.display = 'block';

  document.getElementById('ai-engine-source').textContent = isAiGenerated 
    ? 'Mô hình Gemini 2.5 Flash Engine'
    : 'Bộ máy thuật toán YouTube SEO';

  // Render Titles
  const titlesList = document.getElementById('ai-titles-list');
  titlesList.innerHTML = '';
  (data.viralTitles || []).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'title-option-card';
    card.innerHTML = `
      <div style="flex:1;">
        <span style="font-weight:500; font-size:0.88rem;">${item.title}</span>
        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Loại Hook: ${item.hookType || 'Viral'}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="title-score-badge">CTR: ${item.clickScore || 90}/100</span>
        <button type="button" class="btn btn-sm btn-outline" onclick="selectAiTitle('${item.title.replace(/'/g, "\\'")}')">
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
    span.textContent = `#${tag}`;
    tagsContainer.appendChild(span);
  });

  // Render Channel Variants
  const variantsContainer = document.getElementById('ai-channel-variants-container');
  variantsContainer.innerHTML = '';
  if (data.channelVariants && data.channelVariants.length > 0) {
    data.channelVariants.forEach(v => {
      const div = document.createElement('div');
      div.style.padding = '6px 10px';
      div.style.background = 'var(--bg-surface)';
      div.style.borderRadius = 'var(--radius-sm)';
      div.style.marginBottom = '4px';
      div.innerHTML = `
        <strong style="color:var(--text-primary);">${v.channelTitle}:</strong>
        <span style="color:var(--text-secondary);"> "${v.customTitle}"</span>
      `;
      variantsContainer.appendChild(div);
    });
  } else {
    variantsContainer.innerHTML = '<p style="color:var(--text-muted);">Chưa có kênh nào để tạo biến thể riêng.</p>';
  }

  wrapper.scrollIntoView({ behavior: 'smooth' });
}

function selectAiTitle(title) {
  document.getElementById('video-title').value = title;
  showToast('Đã áp dụng tiêu đề vào form.');
}

function copyAiDescription() {
  const desc = document.getElementById('ai-generated-desc').value;
  navigator.clipboard.writeText(desc);
  showToast('Đã sao chép mô tả vào bộ nhớ tạm.');
}

function applyAllAiToPublisher() {
  if (!lastAiResult) return;

  if (lastAiResult.viralTitles && lastAiResult.viralTitles.length > 0) {
    document.getElementById('video-title').value = lastAiResult.viralTitles[0].title;
  }

  if (lastAiResult.seoDescription) {
    document.getElementById('video-description').value = lastAiResult.seoDescription;
  }

  if (lastAiResult.tags) {
    document.getElementById('video-tags').value = lastAiResult.tags.join(', ');
  }

  if (lastAiResult.channelVariants && lastAiResult.channelVariants.length > 0) {
    const accordion = document.getElementById('custom-channel-accordion');
    accordion.classList.add('open');
    document.getElementById('accordion-arrow').textContent = '▲';

    lastAiResult.channelVariants.forEach(v => {
      const titleInput = document.querySelector(`.override-title[data-channel-id="${v.channelId}"]`);
      const descInput = document.querySelector(`.override-desc[data-channel-id="${v.channelId}"]`);
      if (titleInput && v.customTitle) titleInput.value = v.customTitle;
      if (descInput && v.customDescription) descInput.value = v.customDescription;
    });
  }

  switchTab('publish-tab');
  showToast('Đã chuyển toàn bộ dữ liệu vào Bảng Phân Phối!');
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

// ==================== FORM SUBMISSION & UPLOAD MODAL ====================
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
      if (data.success) {
        updateModalResults(data.results);
        showToast('Đã hoàn tất phân phối video.');
        loadChannels(); // Cập nhật lại số lượng videoCount của kênh ngay lập tức
        loadQuota();
        loadHistory();
      } else {
        updateModalError(data.message || 'Xảy ra lỗi khi upload.');
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

  statusList.innerHTML = '';
  closeBtn.style.display = 'none';
  progressBar.style.width = '30%';
  title.textContent = 'Đang Phân Phối Video...';
  subtitle.textContent = `Đang tải lên ${selectedChannelIds.size} kênh. Vui lòng chờ...`;

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
      <span class="status-badge status-pending" id="status-badge-${id}">Đang xử lý...</span>
    `;
    statusList.appendChild(row);
  });

  modal.classList.add('active');
}

function updateModalResults(results) {
  const closeBtn = document.getElementById('btn-close-modal');
  const progressBar = document.getElementById('overall-progress-bar');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');

  progressBar.style.width = '100%';
  title.textContent = 'Phân Phối Hoàn Tất';
  subtitle.textContent = 'Đã đăng tải thành công lên các kênh đã chọn.';
  closeBtn.style.display = 'inline-flex';

  results.forEach(res => {
    const badge = document.getElementById(`status-badge-${res.channelId}`);
    if (badge) {
      if (res.success) {
        badge.className = 'status-badge status-success';
        badge.innerHTML = `Hoàn tất - <a href="${res.videoUrl}" target="_blank" style="color:var(--text-primary); text-decoration:underline;">Xem trên YouTube ↗</a>`;
      } else {
        badge.className = 'status-badge status-failed';
        badge.innerHTML = `Thất bại (${res.error || 'Lỗi'})`;
      }
    }
  });
}

function updateModalError(errMsg) {
  const closeBtn = document.getElementById('btn-close-modal');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');
  title.textContent = 'Có Lỗi Xảy Ra';
  subtitle.textContent = errMsg;
  closeBtn.style.display = 'inline-flex';
}

function closeUploadModal() {
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
      timeBadge = `<span id="admin-user-timer-${u.id}" style="color:#10b981; font-weight:600; font-family:monospace;">⏱️ ${timeFormatted}</span>`;
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
          el.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

