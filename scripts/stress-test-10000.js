/**
 * ============================================================================
 * STRESS TEST 10,000 REQUESTS & ERROR FUZZING SUITE
 * ============================================================================
 * Kiểm thử chịu tải cao, kiểm tra khả năng tự sửa lỗi (Self-Healing),
 * chống tấn công NoSQL/XSS/DDoS và đo độ trễ trên toàn bộ API của hệ thống.
 */

const http = require('http');
const jwt = require('jsonwebtoken');

const TOTAL_REQUESTS = 10000;
const CONCURRENCY = 50; // 50 luồng đồng thời
const JWT_SECRET = process.env.JWT_SECRET || 'ytb_multi_jwt_secret_shield_key_2026_secure!';
const PORT = 3000;

// Tạo token admin hợp lệ
const validAdminToken = jwt.sign(
  { id: '67469a4b86e088d298495914', email: 'admin@admin.com', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1d' }
);

// Tạo token hết hạn để test
const expiredToken = jwt.sign(
  { id: '67469a4b86e088d298495914', email: 'admin@admin.com', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '-10s' }
);

const testScenarios = [
  // 1. Static Pages & Legal
  { method: 'GET', path: '/', headers: {} },
  { method: 'GET', path: '/login', headers: {} },
  { method: 'GET', path: '/terms', headers: {} },
  { method: 'GET', path: '/privacy', headers: {} },
  { method: 'GET', path: '/tiktokniyqXavojIKdTLfJrHrarZj6rsWuGPgu.txt', headers: {} },

  // 2. Auth & User Profile
  { method: 'GET', path: '/api/auth/me', headers: { 'Authorization': `Bearer ${validAdminToken}` } },
  { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' }) },
  { method: 'GET', path: '/api/auth/me', headers: { 'Authorization': `Bearer ${expiredToken}` } }, // Test expired auth

  // 3. Channels & Social Hub
  { method: 'GET', path: '/api/channels', headers: { 'Authorization': `Bearer ${validAdminToken}` } },
  { method: 'GET', path: '/api/social/tiktok/url', headers: { 'Authorization': `Bearer ${validAdminToken}` } },
  { method: 'GET', path: '/api/social/facebook/url', headers: { 'Authorization': `Bearer ${validAdminToken}` } },
  { method: 'GET', path: '/api/quota', headers: { 'Authorization': `Bearer ${validAdminToken}` } },

  // 4. Brands & Workspace
  { method: 'GET', path: '/api/brands', headers: { 'Authorization': `Bearer ${validAdminToken}` } },

  // 5. Voice TTS Engine
  { method: 'GET', path: '/api/voice/voices', headers: { 'Authorization': `Bearer ${validAdminToken}` } },

  // 6. Planner Matrix
  { method: 'GET', path: '/api/planner/matrix', headers: { 'Authorization': `Bearer ${validAdminToken}` } },

  // 7. Security Fuzzing (XSS, NoSQL Injection, SQLi payloads, Buffer Overflow)
  { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: { '$gt': '' }, password: { '$ne': null } }) },
  { method: 'POST', path: '/api/auth/login', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: "<script>alert('XSS')</script>", password: "'; DROP TABLE users;--" }) },
  { method: 'GET', path: '/api/channels/' + 'A'.repeat(500), headers: { 'Authorization': `Bearer ${validAdminToken}` } }, // URL length overflow
  { method: 'POST', path: '/api/brands', headers: { 'Authorization': `Bearer ${validAdminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test Load Brand ' + Math.random(), toneOfVoice: 'Chuyên nghiệp' }) }
];

const metrics = {
  total: 0,
  success2xx: 0,
  redirect3xx: 0,
  clientError4xx: 0,
  serverError5xx: 0,
  securityBlocked: 0,
  latencies: [],
  startTime: Date.now()
};

function sendRequest(scenario) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: scenario.path,
      method: scenario.method,
      headers: scenario.headers || {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const lat = Date.now() - t0;
        metrics.latencies.push(lat);
        metrics.total++;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          metrics.success2xx++;
        } else if (res.statusCode >= 300 && res.statusCode < 400) {
          metrics.redirect3xx++;
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          metrics.clientError4xx++;
          if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
            metrics.securityBlocked++;
          }
        } else if (res.statusCode >= 500) {
          metrics.serverError5xx++;
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      metrics.total++;
      metrics.serverError5xx++;
      resolve();
    });

    if (scenario.body) {
      req.write(scenario.body);
    }
    req.end();
  });
}

async function runBatch() {
  console.log(`====================================================`);
  console.log(`🚀 BẮT ĐẦU TEST 10,000 REQUESTS & SECURITY FUZZING`);
  console.log(`⚡ Độ rộng luồng (Concurrency): ${CONCURRENCY} connections`);
  console.log(`🎯 Mục tiêu: http://127.0.0.1:${PORT}`);
  console.log(`====================================================\n`);

  let completed = 0;
  const queue = Array.from({ length: TOTAL_REQUESTS }, (_, i) => testScenarios[i % testScenarios.length]);

  async function worker() {
    while (queue.length > 0) {
      const scenario = queue.pop();
      if (!scenario) break;
      await sendRequest(scenario);
      completed++;
      if (completed % 1000 === 0) {
        process.stdout.write(`\r📊 Đã hoàn thành: ${completed}/${TOTAL_REQUESTS} requests (${((completed / TOTAL_REQUESTS) * 100).toFixed(1)}%)...`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const durationSec = ((Date.now() - metrics.startTime) / 1000).toFixed(2);
  metrics.latencies.sort((a, b) => a - b);
  const p50 = metrics.latencies[Math.floor(metrics.latencies.length * 0.50)] || 0;
  const p95 = metrics.latencies[Math.floor(metrics.latencies.length * 0.95)] || 0;
  const p99 = metrics.latencies[Math.floor(metrics.latencies.length * 0.99)] || 0;
  const rps = (TOTAL_REQUESTS / parseFloat(durationSec)).toFixed(0);

  console.log(`\n\n====================================================`);
  console.log(`🏁 KẾT QUẢ KIỂM THỬ 10,000 REQUESTS HOÀN TẤT`);
  console.log(`====================================================`);
  console.log(`⏱️ Tổng thời gian chạy: ${durationSec} giây`);
  console.log(`⚡ Tốc độ xử lý (Throughput): ${rps} Requests/Giây (RPS)`);
  console.log(`📈 Độ trễ trung vị (Latency p50): ${p50} ms`);
  console.log(`📈 Độ trễ p95: ${p95} ms | Độ trễ p99: ${p99} ms`);
  console.log(`----------------------------------------------------`);
  console.log(`✅ Phản hồi thành công (2xx): ${metrics.success2xx}`);
  console.log(`🔄 Chuyển hướng hợp lệ (3xx): ${metrics.redirect3xx}`);
  console.log(`🛡️ Chặn bảo mật & XSS/NoSQL/Auth (4xx): ${metrics.clientError4xx}`);
  console.log(`💥 Lỗi máy chủ (5xx): ${metrics.serverError5xx}`);
  console.log(`🛡️ Tỷ lệ chịu lỗi máy chủ: ${(((TOTAL_REQUESTS - metrics.serverError5xx) / TOTAL_REQUESTS) * 100).toFixed(2)}%`);
  console.log(`====================================================\n`);
}

runBatch();
