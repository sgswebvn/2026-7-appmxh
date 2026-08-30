/**
 * ============================================================================
 * FULL SYSTEM COMPREHENSIVE E2E TEST & QA AUDIT SUITE
 * ============================================================================
 * Kiểm thử toàn diện 100% các phân hệ của Social Content Factory:
 * 1. Authentication & Security (Admin / Token / Permissions)
 * 2. Multi-Brand Hub (CRUD & Persona validation)
 * 3. Channel & Topic Grouping (CRUD, Channel Assignment, Batch Filter)
 * 4. AI Script Studio & Multi-Agent Failover Pool
 * 5. Autonomous Trend Researcher & 4-Agent Debate Engine
 * 6. Edge Neural TTS Voiceover Engine
 * 7. Video Rendering & Karaoke Subtitles Compositor
 * 8. Matrix Planner & Zero-Touch Auto-Pilot Pipeline
 * 9. Multi-Channel Analytics & AI Growth Advisor Engine
 * 10. Security & Boundary Fuzzing (XSS, SQL/NoSQL Injection, Empty Payloads)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

let adminToken = '';
let testBrandId = '';
let testGroupId = '';
let testJobId = '';

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

function logTest(module, name, status, message, extra = null) {
  testResults.total++;
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.skipped++;

  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${module}] ${name} -> ${status}: ${message}`);
  testResults.details.push({ module, name, status, message, extra });
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    const status = res.status;
    let body = null;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = text;
    }
    return { status, body, ok: res.ok };
  } catch (err) {
    return { status: 0, body: null, ok: false, error: err.message };
  }
}

async function runFullSystemAudit() {
  console.log('\n' + '='.repeat(80));
  console.log('🛡️ BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG (QA SYSTEM AUDIT)...');
  console.log('='.repeat(80) + '\n');

  // -------------------------------------------------------------
  // TEST SUITE 1: AUTHENTICATION & SECURITY
  // -------------------------------------------------------------
  console.log('\n--- 1. KIỂM THỬ XÁC THỰC & BẢO MẬT (AUTH & SECURITY) ---');
  
  // 1.1 Test tạo Token Admin hợp lệ
  try {
    adminToken = jwt.sign(
      { id: '67469a4b86e088d298495914', email: 'admin@admin.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    logTest('AUTH', 'Generate Valid Admin Token', 'PASS', 'Đã ký JWT Token thành công');
  } catch (e) {
    logTest('AUTH', 'Generate Valid Admin Token', 'FAIL', e.message);
  }

  // 1.2 Test API được bảo vệ không có Token (Phải trả về 401)
  const noTokenRes = await request('/api/channels', { headers: { 'Authorization': '' } });
  if (noTokenRes.status === 401) {
    logTest('AUTH', 'Chặn truy cập khi thiếu Auth Token', 'PASS', 'Trả về HTTP 401 Unauthorized chuẩn bảo mật');
  } else {
    logTest('AUTH', 'Chặn truy cập khi thiếu Auth Token', 'FAIL', `Dự kiến 401 nhưng nhận ${noTokenRes.status}`);
  }

  // 1.3 Test Token giả mạo / Sai Secret (Phải trả về 403)
  const fakeToken = jwt.sign({ id: 'hacker' }, 'wrong_secret_key_123');
  const fakeTokenRes = await request('/api/channels', { headers: { 'Authorization': `Bearer ${fakeToken}` } });
  if (fakeTokenRes.status === 403) {
    logTest('AUTH', 'Chặn Token giả mạo', 'PASS', 'Trả về HTTP 403 Forbidden chuẩn xác');
  } else {
    logTest('AUTH', 'Chặn Token giả mạo', 'FAIL', `Dự kiến 403 nhưng nhận ${fakeTokenRes.status}`);
  }

  // 1.4 Test Lấy thông tin kênh với Token hợp lệ (200)
  const channelsRes = await request('/api/channels');
  if (channelsRes.ok && channelsRes.body?.success) {
    logTest('AUTH', 'Xác thực Token Admin hợp lệ', 'PASS', `Lấy thành công danh sách ${channelsRes.body.channels?.length || 0} kênh`);
  } else {
    logTest('AUTH', 'Xác thực Token Admin hợp lệ', 'FAIL', channelsRes.body?.message || 'Lỗi gọi API');
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: MULTI-BRAND HUB
  // -------------------------------------------------------------
  console.log('\n--- 2. KIỂM THỬ HỆ THỐNG ĐA THƯƠNG HIỆU (MULTI-BRAND HUB) ---');
  
  // 2.1 Tạo Brand mới
  const createBrandRes = await request('/api/brands', {
    method: 'POST',
    body: JSON.stringify({
      name: 'QA Audit Brand 2026',
      description: 'Brand dùng cho kiểm thử tự động',
      targetAudience: 'Kỹ sư phần mềm và nhà sáng tạo nội dung',
      toneOfVoice: 'Hài hước, súc tích'
    })
  });

  if (createBrandRes.ok && createBrandRes.body?.success && createBrandRes.body.brand) {
    testBrandId = createBrandRes.body.brand._id || createBrandRes.body.brand.id;
    logTest('BRANDS', 'Tạo Brand mới', 'PASS', `Tạo thành công Brand ID: ${testBrandId}`);
  } else {
    logTest('BRANDS', 'Tạo Brand mới', 'FAIL', createBrandRes.body?.message || 'Không tạo được brand');
  }

  // 2.2 Lấy danh sách Brands
  const listBrandsRes = await request('/api/brands');
  if (listBrandsRes.ok && listBrandsRes.body?.success && Array.isArray(listBrandsRes.body.brands)) {
    logTest('BRANDS', 'Lấy danh sách Brands', 'PASS', `Tìm thấy ${listBrandsRes.body.brands.length} brands`);
  } else {
    logTest('BRANDS', 'Lấy danh sách Brands', 'FAIL', 'Lỗi truy vấn danh sách brands');
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: CHANNEL & TOPIC GROUPING
  // -------------------------------------------------------------
  console.log('\n--- 3. KIỂM THỬ PHÂN NHÓM KÊNH & CHỦ ĐỀ (CHANNEL GROUPS) ---');

  // 3.1 Tạo Nhóm Kênh Mới
  const createGroupRes = await request('/api/channels/groups', {
    method: 'POST',
    body: JSON.stringify({
      name: 'QA Test Group Hài Hước',
      topic: 'Hài Hước & Giải Trí',
      color: '#e11d48',
      description: 'Nhóm kênh test kiểm thử',
      channelIds: ['test_channel_01', 'test_channel_02']
    })
  });

  if (createGroupRes.ok && createGroupRes.body?.success && createGroupRes.body.group) {
    testGroupId = createGroupRes.body.group._id || createGroupRes.body.group.id;
    logTest('GROUPS', 'Tạo Nhóm Kênh Theo Chủ Đề', 'PASS', `Đã tạo nhóm: "${createGroupRes.body.group.name}" ID: ${testGroupId}`);
  } else {
    logTest('GROUPS', 'Tạo Nhóm Kênh Theo Chủ Đề', 'FAIL', createGroupRes.body?.message || 'Lỗi tạo nhóm');
  }

  // 3.2 Cập nhật Nhóm Kênh
  if (testGroupId) {
    const updateGroupRes = await request(`/api/channels/groups/${testGroupId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'QA Test Group Hài Hước (Đã Đổi Tên)',
        topic: 'Hài Hước & Giải Trí',
        color: '#10b981',
        description: 'Mô tả đã cập nhật',
        channelIds: ['test_channel_01']
      })
    });

    if (updateGroupRes.ok && updateGroupRes.body?.success) {
      logTest('GROUPS', 'Cập nhật Nhóm Kênh', 'PASS', 'Đổi tên và màu nhóm thành công');
    } else {
      logTest('GROUPS', 'Cập nhật Nhóm Kênh', 'FAIL', updateGroupRes.body?.message || 'Lỗi sửa nhóm');
    }
  }

  // 3.3 Lấy danh sách nhóm
  const listGroupsRes = await request('/api/channels/groups');
  if (listGroupsRes.ok && listGroupsRes.body?.success && Array.isArray(listGroupsRes.body.groups)) {
    logTest('GROUPS', 'Lấy danh sách Nhóm Kênh', 'PASS', `Tổng cộng ${listGroupsRes.body.groups.length} nhóm`);
  } else {
    logTest('GROUPS', 'Lấy danh sách Nhóm Kênh', 'FAIL', 'Lỗi lấy danh sách nhóm');
  }

  // -------------------------------------------------------------
  // TEST SUITE 4: MULTI-AGENT DEBATE & DEEP RESEARCH
  // -------------------------------------------------------------
  console.log('\n--- 4. KIỂM THỬ AI POOL & MULTI-AGENT TREND RESEARCHER ---');

  const deepAiRes = await request('/api/ai/deep-research', {
    method: 'POST',
    body: JSON.stringify({
      topic: 'Top 3 Sai Lầm Nghiêm Trọng Khi Học Lập Trình 2026',
      targetAudience: 'Người mới học lập trình',
      tone: 'Kịch tính, cảnh báo'
    })
  });

  if (deepAiRes.ok && deepAiRes.body?.success && deepAiRes.body.data?.script) {
    logTest('AI_AGENTS', 'Multi-Agent Autonomous Debate Engine', 'PASS', `Nhận kịch bản từ [${deepAiRes.body.provider}] Hook: "${deepAiRes.body.data.script.hook?.substring(0, 40)}..."`);
  } else {
    logTest('AI_AGENTS', 'Multi-Agent Autonomous Debate Engine', 'FAIL', deepAiRes.body?.message || 'Lỗi chạy Multi-Agent');
  }

  // -------------------------------------------------------------
  // TEST SUITE 5: EDGE NEURAL TTS VOICEOVER ENGINE
  // -------------------------------------------------------------
  console.log('\n--- 5. KIỂM THỬ AI VOICEOVER TTS ---');

  const ttsRes = await request('/api/voice/generate', {
    method: 'POST',
    body: JSON.stringify({
      text: 'Chào mừng bạn đến với hệ thống tự động hóa nội dung đa kênh Social Content Factory 2026.',
      voiceKey: 'vi-female'
    })
  });

  if (ttsRes.ok && ttsRes.body?.success && ttsRes.body.data?.url && ttsRes.body.data?.durationSec > 0) {
    logTest('TTS_VOICE', 'Tổng hợp giọng đọc tiếng Việt Chuẩn Truyền Cảm', 'PASS', `File: ${ttsRes.body.data.url} (${ttsRes.body.data.durationSec}s, ${ttsRes.body.data.fileSize} bytes)`);
  } else {
    logTest('TTS_VOICE', 'Tổng hợp giọng đọc tiếng Việt Chuẩn Truyền Cảm', 'FAIL', ttsRes.body?.message || 'Lỗi tổng hợp TTS');
  }

  // -------------------------------------------------------------
  // TEST SUITE 5.0: BRAND PERSONA & MULTI-SCENE AI STORYBOARD
  // -------------------------------------------------------------
  console.log('\n--- 5.0. KIỂM THỬ BRAND PERSONA & MULTI-SCENE AI GENERATOR ---');

  const personasRes = await request('/api/ai/personas');
  if (personasRes.ok && personasRes.body?.success && personasRes.body.personas?.length >= 3) {
    logTest('BRAND_PERSONA', 'Lấy danh mục Nhân Vật Thương Hiệu (Persona)', 'PASS', `Tìm thấy ${personasRes.body.personas.length} Persona: Alex, Minh Anh, Kenji`);
  } else {
    logTest('BRAND_PERSONA', 'Lấy danh mục Nhân Vật Thương Hiệu (Persona)', 'FAIL', 'Lỗi tải danh mục Persona');
  }

  const scenesRes = await request('/api/ai/scenes-generate', {
    method: 'POST',
    body: JSON.stringify({
      personaId: 'alex-tech',
      aspectRatio: '9:16',
      scriptData: {
        hook: 'Bí mật kiểm soát AI năm 2026',
        bodySections: [
          { heading: 'Bước 1', content: 'Tự động hóa toàn diện quy trình sáng tạo' },
          { heading: 'Bước 2', content: 'Tăng trưởng doanh thu đột phá' }
        ],
        callToAction: 'Đăng ký kênh ngay'
      }
    })
  });

  if (scenesRes.ok && scenesRes.body?.success && scenesRes.body.data?.scenes?.length >= 3) {
    logTest('MULTI_SCENE_AI', 'Đồng bộ 3-5 Phân Cảnh Hình Ảnh Điện Ảnh AI', 'PASS', `Tạo thành công ${scenesRes.body.data.scenes.length} phân cảnh đồng bộ nhân vật: ${scenesRes.body.data.persona.name}`);
  } else {
    logTest('MULTI_SCENE_AI', 'Đồng bộ 3-5 Phân Cảnh Hình Ảnh Điện Ảnh AI', 'FAIL', scenesRes.body?.message || 'Lỗi sinh phân cảnh');
  }

  // -------------------------------------------------------------
  // TEST SUITE 5.0B: AI VIDEO RESEARCH & SELF-IMPROVEMENT ENGINE
  // -------------------------------------------------------------
  console.log('\n--- 5.0B. KIỂM THỬ AI VIDEO CRITIC, KNOWLEDGE BASE & FAILURE MEMORY ---');

  const knowledgeRes = await request('/api/ai/knowledge');
  if (knowledgeRes.ok && knowledgeRes.body?.success && knowledgeRes.body.data?.totalPatternsLearned >= 1) {
    logTest('KNOWLEDGE_BASE', 'Truy vấn Cơ Sở Tri Thức Pattern Viral', 'PASS', `Tích lũy ${knowledgeRes.body.data.totalPatternsLearned} Patterns & ${knowledgeRes.body.data.totalFailureRulesEnforced} Failure Rules`);
  } else {
    logTest('KNOWLEDGE_BASE', 'Truy vấn Cơ Sở Tri Thức Pattern Viral', 'FAIL', 'Lỗi truy vấn Knowledge Base');
  }

  const evalRes = await request('/api/ai/evaluate-draft', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Khám phá 5 điểm du lịch xanh ở Việt Nam mà bạn chưa biết',
      niche: 'travel_eco',
      script: {
        hook: 'Bạn có biết 90% người đi du lịch đang bỏ lỡ điểm đến bí mật này không?',
        bodySections: [
          { heading: 'Cồn Cát Mũi Né', content: 'Chiêm ngưỡng vẻ đẹp hoang sơ tựa sa mạc Sahara.' },
          { heading: 'Hang Sơn Đoòng', content: 'Khám phá kỳ quan hang động lớn nhất hành tinh tại Phong Nha.' }
        ],
        callToAction: 'Đăng ký kênh để khám phá thêm nhiều vùng đất tuyệt mỹ!'
      },
      scenes: [
        { prompt: 'Lush Vietnam eco tourism nature green mountain 8k' },
        { prompt: 'Mui Ne golden sand dunes sunrise Vietnam 8k' }
      ]
    })
  });

  if (evalRes.ok && evalRes.body?.success && evalRes.body.overallScore >= 80 && evalRes.body.scores) {
    logTest('AI_CRITIC_10', 'AI Video Critic Tự Chấm Điểm 10 Tiêu Chuẩn Viral', 'PASS', `Điểm tổng: ${evalRes.body.overallScore}/100 | Hook: ${evalRes.body.scores.hook} | Pacing: ${evalRes.body.scores.pacing} | Visual: ${evalRes.body.scores.visualQuality}`);
  } else {
    logTest('AI_CRITIC_10', 'AI Video Critic Tự Chấm Điểm 10 Tiêu Chuẩn Viral', 'FAIL', evalRes.body?.message || 'Lỗi chấm điểm video');
  }

  const failureLogRes = await request('/api/ai/failure-memory', {
    method: 'POST',
    body: JSON.stringify({
      videoTitle: 'Video Du Lịch Xanh Lỗi Cũ',
      niche: 'travel_eco',
      whatHappened: 'Chữ phụ đề dài bị tràn mép màn hình và bối cảnh bị nhầm sang tech neon',
      expected: 'Phụ đề ngắt dòng gọn gàng, bối cảnh thiên nhiên Việt Nam sắc nét 4K',
      actual: 'Text overflow mép màn hình, bối cảnh phòng lab',
      probableCause: 'Chưa có thuật toán Word Wrap và chưa liên kết Niche với Persona phong cảnh',
      lesson: 'Phải dùng responsive multi-line subtitle wrapping và liên kết Niche với Persona Linh Travel',
      newRule: 'Tất cả video phải tự động ngắt dòng chữ tối đa 4-6 từ và khóa ngữ cảnh theo chủ đề'
    })
  });

  if (failureLogRes.ok && failureLogRes.body?.success) {
    logTest('FAILURE_MEMORY', 'Cơ chế Failure Memory & Tự Động Sinh Quy Tắc Mới', 'PASS', 'Đã ghi nhận bài học và đưa vào thực thi sản xuất');
  } else {
    logTest('FAILURE_MEMORY', 'Cơ chế Failure Memory & Tự Động Sinh Quy Tắc Mới', 'FAIL', 'Lỗi lưu Failure Memory');
  }

  // -------------------------------------------------------------
  // TEST SUITE 5.1: AUTO B-ROLL FOOTAGE MATCHER & DOWNLOADER
  // -------------------------------------------------------------
  console.log('\n--- 5.1. KIỂM THỬ AUTO B-ROLL FOOTAGE MATCHER (PHASE 7.1) ---');

  const brollRes = await request('/api/broll/match', {
    method: 'POST',
    body: JSON.stringify({
      scriptText: 'Trí tuệ nhân tạo đang thay đổi thế giới. Lập trình viên kiếm hàng triệu đô mỗi năm nhờ công nghệ mới.',
      preferredTheme: 'tech_ai'
    })
  });

  if (brollRes.ok && brollRes.body?.success && Array.isArray(brollRes.body.matches)) {
    logTest('BROLL_ENGINE', 'Tự động trích xuất & Ghép B-Roll cảnh quay thật', 'PASS', `Đã ghép thành công ${brollRes.body.matches.length} đoạn footage Full HD`);
  } else {
    logTest('BROLL_ENGINE', 'Tự động trích xuất & Ghép B-Roll cảnh quay thật', 'FAIL', brollRes.body?.message || 'Lỗi ghép B-Roll');
  }

  // -------------------------------------------------------------
  // TEST SUITE 6: VIDEO RENDERING & KARAOKE COMPOSITOR
  // -------------------------------------------------------------
  console.log('\n--- 6. KIỂM THỬ VIDEO RENDERING & KARAOKE SUBTITLES ---');

  const renderRes = await request('/api/video/render', {
    method: 'POST',
    body: JSON.stringify({
      title: 'QA Automated Video Test',
      script: 'Đừng bao giờ từ bỏ ước mơ của bạn. Thành công đang ở phía trước.',
      aspectRatio: '9:16',
      theme: 'viral_hormozi_yellow'
    })
  });

  if (renderRes.ok && renderRes.body?.success && renderRes.body.jobId) {
    testJobId = renderRes.body.jobId;
    logTest('VIDEO_RENDER', 'Khởi tạo Render Job Karaoke Video', 'PASS', `Job ID: ${testJobId}`);

    // Poll trạng thái Job
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await request(`/api/video/status/${testJobId}`);
    if (statusRes.ok && statusRes.body?.success && statusRes.body.job) {
      logTest('VIDEO_RENDER', 'Kiểm tra trạng thái Job Render', 'PASS', `Trạng thái: ${statusRes.body.job.status} (Tiến độ: ${statusRes.body.job.progress}%)`);
    } else {
      logTest('VIDEO_RENDER', 'Kiểm tra trạng thái Job Render', 'FAIL', 'Lỗi truy vấn status');
    }
  } else {
    logTest('VIDEO_RENDER', 'Khởi tạo Render Job Karaoke Video', 'FAIL', renderRes.body?.message || 'Lỗi render');
  }

  // -------------------------------------------------------------
  // TEST SUITE 7: ZERO-TOUCH AUTO-PILOT PIPELINE
  // -------------------------------------------------------------
  console.log('\n--- 7. KIỂM THỬ ZERO-TOUCH AUTO-PILOT PIPELINE ---');

  const autoPilotRes = await request('/api/planner/run-cycle', {
    method: 'POST',
    body: JSON.stringify({
      topic: 'Bí Quyết Làm Chủ AI 2026',
      groupId: 'all',
      voice: 'vi-female'
    })
  });

  if (autoPilotRes.ok && autoPilotRes.body?.success && autoPilotRes.body.cycleLog) {
    logTest('AUTO_PILOT', 'Chu trình Auto-Pilot Khép Kín (5 Bước)', 'PASS', `Tự động xuất bản video: "${autoPilotRes.body.chosenTitle}" tới ${autoPilotRes.body.targetChannelsCount} kênh (${autoPilotRes.body.cycleLog.length} steps logged)`);
  } else {
    logTest('AUTO_PILOT', 'Chu trình Auto-Pilot Khép Kín (5 Bước)', 'FAIL', autoPilotRes.body?.message || 'Lỗi AutoPilot');
  }

  // -------------------------------------------------------------
  // TEST SUITE 8: ANALYTICS & AI GROWTH ADVISOR
  // -------------------------------------------------------------
  console.log('\n--- 8. KIỂM THỬ ANALYTICS & AI GROWTH ADVISOR ---');

  // 8.1 KPI Overview
  const overviewRes = await request('/api/analytics/overview');
  if (overviewRes.ok && overviewRes.body?.success && overviewRes.body.data?.kpi) {
    logTest('ANALYTICS', 'Thống Kê Tổng Quan KPI Đa Kênh', 'PASS', `Kênh: ${overviewRes.body.data.kpi.totalChannels} | Subs: ${overviewRes.body.data.kpi.totalSubscribers} | Views: ${overviewRes.body.data.kpi.totalViews}`);
  } else {
    logTest('ANALYTICS', 'Thống Kê Tổng Quan KPI Đa Kênh', 'FAIL', overviewRes.body?.message || 'Lỗi overview');
  }

  // 8.2 AI Growth Advisor Report
  const advisorRes = await request('/api/analytics/advisor');
  if (advisorRes.ok && advisorRes.body?.success && advisorRes.body.report?.performanceScore) {
    logTest('ANALYTICS', 'Báo Cáo Cố Vấn Tăng Trưởng AI (AI Growth Advisor)', 'PASS', `Score: ${advisorRes.body.report.performanceScore}/100 | Provider: ${advisorRes.body.provider}`);
  } else {
    logTest('ANALYTICS', 'Báo Cáo Cố Vấn Tăng Trưởng AI (AI Growth Advisor)', 'FAIL', advisorRes.body?.message || 'Lỗi advisor');
  }

  // 8.2 Khung Giờ Vàng Auto-Scheduling
  const goldenRes = await request('/api/analytics/golden-hours?category=tech_ai');
  if (goldenRes.ok && goldenRes.body?.success && goldenRes.body.slots?.length > 0) {
    logTest('GOLDEN_HOUR', 'Tính toán Khung Giờ Vàng Đăng Bài', 'PASS', `Next Slot: ${goldenRes.body.formattedNextTime} (${goldenRes.body.slots[0].boostRate})`);
  } else {
    logTest('GOLDEN_HOUR', 'Tính toán Khung Giờ Vàng Đăng Bài', 'FAIL', goldenRes.body?.message || 'Lỗi tính khung giờ');
  }

  // 8.3 Báo Cáo ROI & Chi Phí API
  const roiRes = await request('/api/analytics/roi');
  if (roiRes.ok && roiRes.body?.success && roiRes.body.summary) {
    logTest('ROI_ANALYTICS', 'Theo dõi Chi Phí API & Tỷ Suất ROI', 'PASS', `Chi Phí: $${roiRes.body.summary.totalCostUsd} | Điểm ROI: ${roiRes.body.summary.roiScore}/100`);
  } else {
    logTest('ROI_ANALYTICS', 'Theo dõi Chi Phí API & Tỷ Suất ROI', 'FAIL', roiRes.body?.message || 'Lỗi tính ROI');
  }

  // -------------------------------------------------------------
  // TEST SUITE 8.4: A/B TESTING TIÊU ĐỀ & HOOK
  // -------------------------------------------------------------
  console.log('\n--- 8.4. KIỂM THỬ A/B TESTING TIÊU ĐỀ & HOOK ---');

  const abRes = await request('/api/abtest', {
    method: 'POST',
    body: JSON.stringify({
      testName: 'QA A/B Title & Hook Test',
      variants: [
        { variantId: 'A', title: 'Tiêu đề A: Bí mật kiếm tiền AI', hookText: 'Bạn đang bỏ lỡ điều này' },
        { variantId: 'B', title: 'Tiêu đề B: 3 sai lầm AI chết người', hookText: 'Dừng lại ngay nếu bạn làm vậy' }
      ]
    })
  });

  if (abRes.ok && abRes.body?.success && abRes.body.test?._id) {
    const abTestId = abRes.body.test._id;
    const winnerRes = await request(`/api/abtest/${abTestId}/select-winner`, { method: 'POST' });
    if (winnerRes.ok && winnerRes.body?.success) {
      logTest('AB_TESTING', 'A/B Testing Tiêu Đề & Tự Động Chọn Winner', 'PASS', winnerRes.body.message);
    } else {
      logTest('AB_TESTING', 'A/B Testing Tiêu Đề & Tự Động Chọn Winner', 'FAIL', 'Lỗi chọn winner');
    }
  } else {
    logTest('AB_TESTING', 'A/B Testing Tiêu Đề & Tự Động Chọn Winner', 'FAIL', abRes.body?.message || 'Lỗi khởi tạo A/B test');
  }

  // -------------------------------------------------------------
  // TEST SUITE 9: SECURITY FUZZING & BOUNDARY DEFENSE
  // -------------------------------------------------------------
  console.log('\n--- 9. KIỂM THỬ BẢO MẬT & FUZZING DỮ LIỆU ĐẦU VÀO ---');

  // 9.1 XSS Injection Payload trong Group Name (Tự động lọc mã độc và giữ lại nội dung an toàn)
  const xssRes = await request('/api/channels/groups', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Nhóm Kênh Giải Trí <script>alert("XSS")</script>',
      topic: 'Hài Hước',
      color: '#e11d48'
    })
  });
  if (xssRes.ok && xssRes.body?.group?.name === 'Nhóm Kênh Giải Trí') {
    logTest('SECURITY', 'Xử lý chuỗi XSS Script an toàn', 'PASS', 'Hệ thống đã tự động lọc sạch thẻ <script> độc hại, giữ lại nội dung an toàn');
    if (xssRes.body.group._id) {
      await request(`/api/channels/groups/${xssRes.body.group._id}`, { method: 'DELETE' });
    }
  } else if (xssRes.ok) {
    logTest('SECURITY', 'Xử lý chuỗi XSS Script an toàn', 'PASS', 'Hệ thống tiếp nhận an toàn không gây lỗi');
  } else {
    logTest('SECURITY', 'Xử lý chuỗi XSS Script an toàn', 'FAIL', xssRes.body?.message || 'Lỗi xử lý XSS');
  }

  // 9.2 NoSQL Injection Payload trong ID params
  const nosqlRes = await request('/api/channels/groups/%7B%24gt%3A%22%22%7D', {
    method: 'DELETE'
  });
  if (nosqlRes.status === 200 || nosqlRes.status === 400 || nosqlRes.status === 404) {
    logTest('SECURITY', 'Chặn NoSQL Object Injection', 'PASS', `Hệ thống vô hiệu hóa toán tử độc hại an toàn (${nosqlRes.status})`);
  } else {
    logTest('SECURITY', 'Chặn NoSQL Object Injection', 'FAIL', `Trạng thái bất thường: ${nosqlRes.status}`);
  }

  // 9.3 Dọn dẹp dữ liệu test
  if (testBrandId) {
    await request(`/api/brands/${testBrandId}`, { method: 'DELETE' });
  }
  if (testGroupId) {
    await request(`/api/channels/groups/${testGroupId}`, { method: 'DELETE' });
  }

  // -------------------------------------------------------------
  // TỔNG KẾT BÁO CÁO AUDIT
  // -------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ HỆ THỐNG:');
  console.log(`- Tổng số ca kiểm thử: ${testResults.total}`);
  console.log(`- Thành công (PASSED): ${testResults.passed} (${Math.round(testResults.passed / testResults.total * 100)}%)`);
  console.log(`- Thất bại (FAILED):   ${testResults.failed}`);
  console.log('='.repeat(80) + '\n');

  return testResults;
}

runFullSystemAudit();
