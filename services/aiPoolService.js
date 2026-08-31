const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * ============================================================================
 * MULTI-AI FAILOVER POOL & FREE MODEL ROUTER (0ms DOWNTIME ENGINE)
 * ============================================================================
 * - Tự động định tuyến request qua danh sách Provider miễn phí tốc độ cao.
 * - Khi gặp lỗi Rate Limit (429), Hết Quota, hoặc Lỗi mạng (500/503), tự động
 *   xoay vòng API Key hoặc nhảy sang Model Provider kế tiếp trong 0ms.
 * - Circuit Breaker: Tạm cách ly Provider lỗi trong 60 giây và tự phục hồi.
 * - Chuẩn hóa (Normalize) dữ liệu đầu ra JSON đồng nhất cho mọi Model.
 */

class AIPoolEngine {
  constructor() {
    this.circuitBreakers = new Map(); // providerId -> { disabledUntil, failureCount }
    this.keyPointers = new Map(); // providerId -> currentIndex
  }

  // Lấy danh sách API Keys dạng mảng từ chuỗi cấu hình (hỗ trợ nhiều key cách nhau bằng dấu phẩy)
  getApiKeys(envVarName) {
    const raw = process.env[envVarName] || '';
    return raw.split(',').map(k => k.trim()).filter(Boolean);
  }

  // Lấy Key tiếp theo theo cơ chế Round-Robin Rotation
  getNextKey(providerId, envVarName, customKey = null) {
    if (customKey && customKey.trim().length > 10) return customKey.trim();
    const keys = this.getApiKeys(envVarName);
    if (keys.length === 0) return null;

    let idx = this.keyPointers.get(providerId) || 0;
    const selectedKey = keys[idx % keys.length];
    this.keyPointers.set(providerId, (idx + 1) % keys.length);
    return selectedKey;
  }

  // Kiểm tra trạng thái Circuit Breaker của Provider
  isProviderAvailable(providerId) {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) return true;
    if (Date.now() > breaker.disabledUntil) {
      this.circuitBreakers.delete(providerId); // Đã hết cooldown -> Mở lại
      return true;
    }
    return false;
  }

  // Ghi nhận lỗi và kích hoạt ngắt mạch nếu vượt ngưỡng
  recordProviderFailure(providerId, errorMsg) {
    const breaker = this.circuitBreakers.get(providerId) || { failureCount: 0, disabledUntil: 0 };
    breaker.failureCount += 1;
    if (breaker.failureCount >= 2) {
      breaker.disabledUntil = Date.now() + 60 * 1000; // Khóa 60 giây
      console.warn(`🚨 [AI Pool Circuit Breaker] Provider "${providerId}" bị tạm khóa 60s do lỗi: ${errorMsg}`);
    }
    this.circuitBreakers.set(providerId, breaker);
  }

  // ==================== PROVIDER 1: GROQ CLOUD (LLAMA 3.3 70B & MIXTRAL) ====================
  async callGroq(prompt, customKey = null) {
    const apiKey = this.getNextKey('groq', 'GROQ_API_KEY', customKey);
    if (!apiKey) throw new Error('GROQ_API_KEY chưa được cấu hình.');

    const models = [
      'openai/gpt-oss-120b',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'allam-2-7b',
      'groq/compound'
    ];
    let lastErr = null;

    for (const model of models) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: 'Bạn là chuyên gia sáng tạo nội dung YouTube hàng đầu. Luôn luôn trả về đúng định dạng JSON thuần túy, không kèm markdown hay văn bản ngoài JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          })
        });

        if (res.status === 429) throw new Error(`Rate limit Groq (429) trên model ${model}`);
        if (!res.ok) {
          const errData = await res.text();
          throw new Error(`Groq HTTP ${res.status}: ${errData}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        return { content, provider: `Groq (${model})` };
      } catch (err) {
        lastErr = err;
        console.warn(`[AI Pool] Groq ${model} gặp lỗi:`, err.message);
      }
    }
    throw lastErr;
  }

  // ==================== PROVIDER 2: GOOGLE GEMINI (2.5 FLASH / 1.5 FLASH) ====================
  async callGemini(prompt, customKey = null) {
    const apiKey = this.getNextKey('gemini', 'GEMINI_API_KEY', customKey);
    if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
    let lastErr = null;

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return { content: text, provider: `Google Gemini (${modelName})` };
      } catch (err) {
        lastErr = err;
        console.warn(`[AI Pool] Gemini ${modelName} gặp lỗi:`, err.message);
      }
    }
    throw lastErr;
  }

  // ==================== PROVIDER 3: OPENROUTER FREE POOL ====================
  async callOpenRouter(prompt, customKey = null) {
    const apiKey = this.getNextKey('openrouter', 'OPENROUTER_API_KEY', customKey);
    if (!apiKey) throw new Error('OPENROUTER_API_KEY chưa được cấu hình.');

    const freeModels = [
      'google/gemma-4-26b-a4b-it:free',
      'liquid/lfm-2.5-2.6b:free',
      'nvidia/nemotron-3.5-lightning:free',
      'z-ai/glm-5.2:free',
      'minimax/minimax-m3:free',
      'inclusionai/ling-3.0-flash-fin:free'
    ];

    let lastErr = null;
    for (const model of freeModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://socialcontentfactory.app',
            'X-Title': 'Social Content Factory'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: 'Chỉ trả về JSON thuần túy hợp lệ.' },
              { role: 'user', content: prompt }
            ]
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        return { content, provider: `OpenRouter Free (${model})` };
      } catch (err) {
        lastErr = err;
        console.warn(`[AI Pool] OpenRouter ${model} gặp lỗi:`, err.message);
      }
    }
    throw lastErr;
  }

  // ==================== PROVIDER 4: POLLINATIONS.AI UNLIMITED FREE GATEWAY ====================
  async callPollinationsFreeAI(prompt) {
    const models = ['openai', 'mistral', 'claude-hybrid', 'qwen-coder', 'deepseek'];
    let lastErr = null;

    for (const model of models) {
      try {
        const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${model}&json=true`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
        const text = await res.text();
        if (text && text.trim().length > 10) {
          return { content: text, provider: `Pollinations Unlimited Free (${model})` };
        }
      } catch (err) {
        lastErr = err;
        console.warn(`[AI Pool] Pollinations ${model} gặp lỗi:`, err.message);
      }
    }
    throw lastErr || new Error('Pollinations Free Engine không phản hồi.');
  }

  // ==================== QUERY RAW PROMPT THÔNG QUA FAILOVER POOL ====================
  async queryActivePool(prompt, customApiKey = null) {
    const providersQueue = [
      { id: 'groq', fn: () => this.callGroq(prompt, customApiKey) },
      { id: 'gemini', fn: () => this.callGemini(prompt, customApiKey) },
      { id: 'openrouter', fn: () => this.callOpenRouter(prompt, customApiKey) },
      { id: 'pollinations_free', fn: () => this.callPollinationsFreeAI(prompt) }
    ];

    let lastError = null;
    for (const provider of providersQueue) {
      if (!this.isProviderAvailable(provider.id)) continue;
      try {
        const result = await provider.fn();
        if (result && result.content) {
          return {
            content: result.content,
            provider: result.provider
          };
        }
      } catch (err) {
        lastError = err;
        this.recordProviderFailure(provider.id, err.message);
      }
    }
    throw lastError || new Error('Tất cả Provider AI trong Pool đều không phản hồi.');
  }

  // ==================== MAIN DISPATCHER: TỰ ĐỘNG CHUYỂN ĐỔI MODEL ====================
  async generateContentWithFailover({
    topic,
    targetAudience = 'Khán giả đại chúng',
    tone = 'Hấp dẫn, kích thích tò mò',
    channels = [],
    brandName = '',
    customApiKey = ''
  }) {
    const channelNames = channels.map(c => c.title || c).join(', ');

    const prompt = `
Bạn là Giám đốc Sáng tạo & Sản xuất Video Triệu View (Chief Content Officer) cho thương hiệu "${brandName || 'Thương hiệu đa kênh'}".
Hãy phân tích chủ đề sau và tạo ra gói kịch bản video CÓ CHIỀU SÂU THƯƠNG MẠI, chứa số liệu thực tế, địa danh/công cụ cụ thể, giữ chân người xem từ giây đầu đến giây cuối:

CHỦ ĐỀ: "${topic}"
ĐỐI TƯỢNG XEM: "${targetAudience}"
GIỌNG VĂN / TONE: "${tone}"
DANH SÁCH KÊNH PHÂN PHỐI: "${channelNames || 'Hệ thống đa kênh'}"

YÊU CẦU NỘI DUNG CHIỀU SÂU & GIÁ TRỊ THƯƠNG MẠI:
1. HOOK (0-3s): Phải trực diện, tạo khoảng trống thông tin bắt buộc phải xem tiếp, nêu rõ số liệu hoặc nghịch lý gây sốc.
2. NỘI DUNG CHÍNH (Body Sections): Tuyệt đối KHÔNG viết chung chung. Phải nêu đích danh tên địa danh/tên công cụ/mức chi phí/số liệu cụ thể và mẹo thực chiến áp dụng được ngay.
3. KÊU GỌI HÀNH ĐỘNG (CTA): Đưa ra lý do hấp dẫn có giá trị thực để người xem like, bình luận và follow kênh.

YÊU CẦU KỸ THUẬT: Trả về ĐÚNG CẤU TRÚC JSON sau (JSON thuần túy, không kèm bất kỳ ký tự nào ngoài JSON):
{
  "viralTitles": [
    { "title": "Tiêu đề giật tít 1 kèm số liệu", "hookType": "Gây tò mò & Số liệu", "clickScore": 98 },
    { "title": "Tiêu đề giật tít 2 bí mật", "hookType": "Cảnh báo / Bí mật", "clickScore": 95 },
    { "title": "Tiêu đề giật tít 3 trải nghiệm thực tế", "hookType": "Hướng dẫn siêu tốc", "clickScore": 93 },
    { "title": "Tiêu đề giật tít 4 giải pháp đột phá", "hookType": "Trải nghiệm thực tế", "clickScore": 91 },
    { "title": "Tiêu đề giật tít 5 câu hỏi tranh luận", "hookType": "Đặt câu hỏi tranh luận", "clickScore": 89 }
  ],
  "script": {
    "hook": "Câu mở đầu 0-3 giây gây bất ngờ kèm số liệu thực tế...",
    "bodySections": [
      { "time": "00:03 - 00:15", "heading": "Phần 1: Điểm nhấn 1 & Dữ liệu thực tế", "content": "Nội dung phân tích sâu sắc kèm tên địa danh hoặc mẹo cụ thể..." },
      { "time": "00:15 - 00:30", "heading": "Phần 2: Bí quyết thực chiến & Trải nghiệm độc bản", "content": "Nội dung hướng dẫn chi tiết từng bước..." },
      { "time": "00:30 - 00:45", "heading": "Phần 3: Sai lầm cần tránh & Tối ưu chi phí", "content": "Lưu ý quan trọng giúp tiết kiệm thời gian/tiền bạc..." }
    ],
    "callToAction": "Lời kêu gọi hành động (CTA) gắn liền với giá trị phần tiếp theo..."
  },
  "seoDescription": "Bản mô tả chuẩn SEO có phần mở đầu hấp dẫn, timestamps mốc thời gian, liên kết và 5-7 hashtag...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12"],
  "channelVariants": [
    {
      "channelTitle": "Tên kênh 1",
      "customTitle": "Tiêu đề riêng biệt chống trùng lặp",
      "customDescription": "Mở đầu mô tả riêng cho kênh này"
    }
  ],
  "contentAdvice": "Lời khuyên làm thumbnail tương phản cao và nhịp độ video (Pacing)."
}
`;

    // Danh sách các Provider theo thứ tự ưu tiên
    const providersQueue = [
      { id: 'groq', fn: () => this.callGroq(prompt, customApiKey) },
      { id: 'gemini', fn: () => this.callGemini(prompt, customApiKey) },
      { id: 'openrouter', fn: () => this.callOpenRouter(prompt, customApiKey) }
    ];

    for (const provider of providersQueue) {
      if (!this.isProviderAvailable(provider.id)) {
        console.log(`[AI Pool] Bỏ qua Provider "${provider.id}" (đang trong thời gian cooldown ngắt mạch).`);
        continue;
      }

      try {
        console.log(`🤖 [AI Pool] Đang điều phối request tới Provider: "${provider.id.toUpperCase()}"...`);
        const result = await provider.fn();
        const parsedData = this.extractAndNormalizeJSON(result.content);

        if (parsedData) {
          console.log(`✅ [AI Pool] Phản hồi thành công từ: ${result.provider}`);
          return {
            success: true,
            isAiGenerated: true,
            provider: result.provider,
            data: parsedData
          };
        }
      } catch (providerErr) {
        console.warn(`⚠️ [AI Pool] Provider "${provider.id}" thất bại (${providerErr.message}). Đang tự động chuyển sang Provider tiếp theo trong 0ms...`);
        this.recordProviderFailure(provider.id, providerErr.message);
      }
    }

    // Nếu tất cả AI Cloud đều gặp sự cố -> Kích hoạt Bộ Thuật Toán SEO Fallback
    console.log('⚡ [AI Pool] Đã kích hoạt Bộ máy Thuật toán SEO Dự phòng cục bộ (Smart Fallback Engine).');
    return {
      success: true,
      isAiGenerated: false,
      provider: 'Smart Fallback Algorithm Engine (Local)',
      data: this.generateSmartFallbackContent(topic, targetAudience, channels)
    };
  }

  // Trích xuất JSON an toàn từ phản hồi văn bản của AI
  extractAndNormalizeJSON(rawText) {
    if (!rawText) return null;
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (e) {
      console.warn('[AI Pool] Không thể parse JSON từ AI output:', e.message);
    }
    return null;
  }

  // Thuật toán SEO Dự phòng khi mất kết nối Internet / Hết Quota toàn bộ
  generateSmartFallbackContent(topic = 'Ý Tưởng Sáng Tạo 2026', targetAudience = 'Khán giả đại chúng', channels = []) {
    const rawTopic = typeof topic === 'string' ? topic : (topic?.topic || 'Ý Tưởng Sáng Tạo 2026');
    const cleanTopic = (rawTopic || 'Ý Tưởng Sáng Tạo 2026').trim();
    const lowerTopic = cleanTopic.toLowerCase();

    return {
      viralTitles: [
        { title: `🔥 BÍ MẬT: ${cleanTopic} - Những Điều Bạn Chưa Từng Được Biết!`, hookType: 'Gây tò mò tột độ', clickScore: 96 },
        { title: `Sự Thật Về ${cleanTopic}: Đừng Bỏ Qua Nếu Không Muốn Hối Hận!`, hookType: 'Cảnh báo & Giật tít', clickScore: 94 },
        { title: `Hướng Dẫn Toàn Diện ${cleanTopic} Từ A-Z Dành Cho ${targetAudience}`, hookType: 'Chuyên gia & Giá trị', clickScore: 91 },
        { title: `Tôi Đã Thử ${cleanTopic} Suốt 30 Ngày Và Cái Kết Bất Ngờ...`, hookType: 'Trải nghiệm cá nhân', clickScore: 93 },
        { title: `Liệu ${cleanTopic} Có Thực Sự Tốt? Đánh Giá Chi Tiết!`, hookType: 'Phân tích & Review', clickScore: 89 }
      ],
      script: {
        hook: `Bạn có bao giờ tự hỏi làm sao để làm chủ "${cleanTopic}" nhanh nhất? Hãy xem hết video này!`,
        bodySections: [
          { time: '00:00 - 00:15', heading: 'Giới thiệu & Vấn đề', content: `Tổng quan về ${cleanTopic} và tại sao nhiều người gặp khó khăn.` },
          { time: '00:15 - 00:40', heading: 'Bí quyết thực hiện', content: `3 bước quan trọng nhất để áp dụng ${cleanTopic} đạt hiệu quả cao.` },
          { time: '00:40 - 00:55', heading: 'Lưu ý vàng', content: `Những sai lầm phổ biến cần tuyệt đối tránh.` }
        ],
        callToAction: `Đừng quên bấm Like, Đăng ký kênh và bình luận cảm nghĩ của bạn về ${cleanTopic} bên dưới nhé!`
      },
      seoDescription: `📌 Trong video hôm nay, chúng ta cùng khám phá chi tiết về "${cleanTopic}". Dành riêng cho ${targetAudience}!\n\n⏱️ TIMESTAMPS:\n00:00 - Mở đầu\n01:15 - Chi tiết quan trọng\n03:30 - Lời khuyên vàng\n\n#${lowerTopic.replace(/\s+/g, '')} #trending #youtube #huongdan #review`,
      tags: [cleanTopic, `huong dan ${cleanTopic}`, `review ${cleanTopic}`, `bi quyet ${cleanTopic}`, 'trending youtube', 'xuhuong', '2026'],
      channelVariants: channels.map((c, i) => ({
        channelTitle: c.title || c,
        customTitle: `[Bản Chuẩn] ${cleanTopic} - Xem Ngay Kẻo Lỡ!`,
        customDescription: `Chào mừng bạn đến với ${c.title || 'kênh'}! Hãy cùng khám phá ${cleanTopic}.`
      })),
      contentAdvice: '💡 Mẹo Thumbnail: Sử dụng ảnh có độ tương phản cao, biểu cảm ấn tượng và text lớn tối đa 4-5 từ.'
    };
  }
}

module.exports = new AIPoolEngine();
