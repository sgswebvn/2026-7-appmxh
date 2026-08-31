const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const { validateStoryPlan } = require('./storyPlanValidator');
const store = require('./storyPlanStore');

const STORY_PLAN_JSON_SCHEMA = `{
  "storyId": "story_xxx",
  "topic": "Chủ đề video",
  "title": "Tiêu đề video hấp dẫn",
  "genre": "Thể loại (hài hước / gia đình / công nghệ / kịch tính / đời sống)",
  "style": "Phong cách hình ảnh & kể chuyện (ví dụ: cinematic 9:16 vertical short)",
  "durationTarget": 30,
  "characters": [
    {
      "id": "char_001",
      "name": "Tên nhân vật",
      "age": 25,
      "gender": "male hoặc female",
      "role": "Vai trò (child / teenager / adult / elderly / Grandfather / Vendor / Chef...)",
      "personality": ["Đặc điểm 1", "Đặc điểm 2"],
      "appearance": {
        "face": "Mô tả khuôn mặt, mắt, biểu cảm",
        "hair": "Kiểu tóc, màu tóc",
        "clothing": "Trang phục cụ thể, màu sắc",
        "body": "Dáng người",
        "style": "Phong cách tổng thể"
      },
      "visualPrompt": "Mô tả chi tiết bằng tiếng Anh để sinh ảnh AI nhất quán",
      "voice": {
        "voiceId": "vi-female hoặc vi-male",
        "language": "vi-VN",
        "gender": "female hoặc male",
        "tone": "Ấm áp, nhí nhảnh, trầm ấm hoặc nghiêm nghị"
      }
    }
  ],
  "relationships": [
    {
      "id": "rel_001",
      "fromCharacterId": "char_001",
      "toCharacterId": "char_002",
      "relationship": "Mối quan hệ (ví dụ: Grandfather ↔ Granddaughter)",
      "dynamic": "Tương tác chính giữa hai nhân vật"
    }
  ],
  "scenes": [
    {
      "id": "scene_001",
      "location": "Địa điểm diễn ra cảnh",
      "time": "Thời gian (ban ngày / chiều tà / ban đêm)",
      "environment": "Mô tả không gian, ánh sáng, âm thanh môi trường",
      "characters": ["char_001", "char_002"],
      "action": "Hành động chính diễn ra trong cảnh",
      "emotion": "Cảm xúc chủ đạo của cảnh",
      "dialogueIds": ["dlg_001", "dlg_002"],
      "visualPrompt": "Prompt chi tiết mô tả bối cảnh để tạo ảnh AI"
    }
  ],
  "dialogues": [
    {
      "id": "dlg_001",
      "speakerId": "char_001",
      "sceneId": "scene_001",
      "text": "Câu thoại ngắn gọn, tự nhiên và giàu cảm xúc",
      "emotion": "Cảm xúc khi nói",
      "action": "Hành động, cử chỉ cơ thể đi kèm khi nói",
      "voiceId": "vi-female hoặc vi-male (phải khớp với voice của speakerId)"
    }
  ],
  "shots": [
    {
      "id": "shot_001",
      "sceneId": "scene_001",
      "shotType": "Extreme Close-Up / Over-the-shoulder / Medium Shot / Two-Shot / Macro",
      "camera": "Góc quay và chuyển động camera (ví dụ: Slow Push-in 85mm)",
      "duration": 4,
      "characters": ["char_001"],
      "action": "Hành động cụ thể trong khung hình",
      "dialogueIds": ["dlg_001"],
      "visualPrompt": "Prompt chi tiết cho shot hình ảnh",
      "transition": "Cut / Fade / Whip Pan"
    }
  ]
}`;

function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('LLM output is empty or not text.');
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('LLM output did not contain a valid JSON object.');
  }
  return JSON.parse(match[0]);
}

function referenceProfiles(plan) {
  if (!plan.characters || !Array.isArray(plan.characters)) return [];
  return plan.characters.map(character => ({
    characterId: character.id,
    name: character.name,
    role: character.role,
    canonicalAppearance: character.appearance,
    visualPrompt: character.visualPrompt,
    clothing: character.appearance?.clothing || '',
    hairstyle: character.appearance?.hair || '',
    facialFeatures: character.appearance?.face || '',
    style: character.appearance?.style || '',
    voice: character.voice,
    negativePrompt: 'inconsistent face, changing clothing, deformed anatomy, extra limbs, blur, low quality, watermark'
  }));
}

function normalizeStoryPlan(rawPlan, topic, style, durationTarget) {
  const storyId = rawPlan.storyId || `story_${uuidv4().substring(0, 8)}`;
  const cleanTopic = (topic || rawPlan.topic || 'Chủ đề video').trim();
  const cleanTitle = (rawPlan.title || cleanTopic).trim();

  // Normalize Characters
  const characters = (Array.isArray(rawPlan.characters) ? rawPlan.characters : []).map((c, idx) => {
    const id = c.id || `char_${String(idx + 1).padStart(3, '0')}`;
    const gender = (c.gender || 'female').toLowerCase().includes('male') && !(c.gender || '').toLowerCase().includes('female') ? 'male' : 'female';
    const voiceId = c.voice?.voiceId || (typeof c.voice === 'string' ? c.voice : (gender === 'male' ? 'vi-male' : 'vi-female'));
    
    return {
      id,
      name: c.name || `Nhân vật ${idx + 1}`,
      age: Number(c.age) || (c.role?.toLowerCase().includes('elderly') || c.role?.toLowerCase().includes('ông') || c.role?.toLowerCase().includes('bà') ? 68 : 25),
      gender,
      role: c.role || 'Main Character',
      personality: Array.isArray(c.personality) ? c.personality : [c.personality || 'Tự nhiên, biểu cảm'],
      appearance: typeof c.appearance === 'object' && c.appearance ? c.appearance : {
        face: 'Biểu cảm chân thực, mắt sáng',
        hair: 'Gọn gàng',
        clothing: 'Trang phục phù hợp bối cảnh',
        body: 'Vừa vặn',
        style: 'Cinematic realism'
      },
      visualPrompt: c.visualPrompt || `A cinematic portrait of ${c.name || 'a character'}, highly detailed, 8k, photorealistic`,
      voice: {
        voiceId,
        language: c.voice?.language || 'vi-VN',
        gender,
        tone: c.voice?.tone || 'Tự nhiên'
      }
    };
  });

  const charMap = new Map(characters.map(c => [c.id, c]));

  // Normalize Scenes
  const scenes = (Array.isArray(rawPlan.scenes) ? rawPlan.scenes : []).map((s, idx) => {
    const sId = s.id || `scene_${String(idx + 1).padStart(3, '0')}`;
    const sceneChars = (Array.isArray(s.characters) ? s.characters : []).filter(id => charMap.has(id));
    if (sceneChars.length === 0 && characters.length > 0) {
      sceneChars.push(characters[0].id);
    }
    return {
      id: sId,
      location: s.location || 'Bối cảnh câu chuyện',
      time: s.time || 'Ban ngày',
      environment: s.environment || 'Không gian ấm cúng, ánh sáng tự nhiên',
      characters: sceneChars,
      action: s.action || 'Diễn biến tình huống',
      emotion: s.emotion || 'Chân thật',
      dialogueIds: Array.isArray(s.dialogueIds) ? s.dialogueIds : [],
      visualPrompt: s.visualPrompt || `A cinematic scene at ${s.location || 'location'}, photorealistic, 8k`
    };
  });

  const sceneMap = new Map(scenes.map(s => [s.id, s]));

  // Normalize Dialogues
  const dialogues = (Array.isArray(rawPlan.dialogues) ? rawPlan.dialogues : []).map((d, idx) => {
    const dId = d.id || `dlg_${String(idx + 1).padStart(3, '0')}`;
    let speakerId = d.speakerId;
    if (!charMap.has(speakerId)) {
      speakerId = characters[idx % characters.length]?.id || characters[0]?.id;
    }
    let sceneId = d.sceneId;
    if (!sceneMap.has(sceneId)) {
      sceneId = scenes[0]?.id || 'scene_001';
    }
    const speaker = charMap.get(speakerId);
    const voiceId = speaker?.voice?.voiceId || (speaker?.gender === 'male' ? 'vi-male' : 'vi-female');

    return {
      id: dId,
      speakerId,
      sceneId,
      text: (d.text || '').trim() || '...',
      emotion: d.emotion || 'Tự nhiên',
      action: d.action || 'Biểu cảm cử chỉ',
      voiceId
    };
  });

  const dialogueMap = new Map(dialogues.map(d => [d.id, d]));

  // Attach dialogue IDs back into scenes if missing
  scenes.forEach(scene => {
    const sceneDlgs = dialogues.filter(d => d.sceneId === scene.id).map(d => d.id);
    scene.dialogueIds = Array.from(new Set([...(scene.dialogueIds || []), ...sceneDlgs]));
  });

  // Normalize Shots
  const shots = (Array.isArray(rawPlan.shots) ? rawPlan.shots : []).map((sh, idx) => {
    const shotId = sh.id || `shot_${String(idx + 1).padStart(3, '0')}`;
    let sceneId = sh.sceneId;
    if (!sceneMap.has(sceneId)) {
      sceneId = scenes[0]?.id || 'scene_001';
    }
    const shotChars = (Array.isArray(sh.characters) ? sh.characters : []).filter(id => charMap.has(id));
    if (shotChars.length === 0 && characters.length > 0) {
      shotChars.push(characters[idx % characters.length]?.id || characters[0].id);
    }
    const shotDlgs = (Array.isArray(sh.dialogueIds) ? sh.dialogueIds : []).filter(id => dialogueMap.has(id));

    return {
      id: shotId,
      sceneId,
      shotType: sh.shotType || (idx === 0 ? 'Extreme Close-Up 85mm' : idx === 1 ? 'Over-the-shoulder 50mm' : 'Two-Shot 35mm'),
      camera: sh.camera || 'Slow push-in cinematic camera motion',
      duration: Number(sh.duration) || 4,
      characters: shotChars,
      action: sh.action || 'Hành động nhân vật trong shot',
      dialogueIds: shotDlgs,
      visualPrompt: sh.visualPrompt || `A vertical 9:16 cinematic shot, ${sh.shotType || 'Medium shot'}, photorealistic, 8k`,
      transition: sh.transition || 'Cut'
    };
  });

  // Normalize Relationships
  const relationships = (Array.isArray(rawPlan.relationships) ? rawPlan.relationships : []).map((rel, idx) => {
    const relId = rel.id || `rel_${String(idx + 1).padStart(3, '0')}`;
    let fromId = rel.fromCharacterId;
    let toId = rel.toCharacterId;
    if (!charMap.has(fromId)) fromId = characters[0]?.id;
    if (!charMap.has(toId)) toId = characters[1]?.id || characters[0]?.id;

    return {
      id: relId,
      fromCharacterId: fromId,
      toCharacterId: toId,
      relationship: rel.relationship || 'Companions / Interact',
      dynamic: rel.dynamic || 'Tương tác đối thoại gắn kết'
    };
  });

  const normalized = {
    storyId,
    topic: cleanTopic,
    title: cleanTitle,
    genre: rawPlan.genre || 'Mini-Drama & Entertainment',
    style: style || rawPlan.style || 'conversational cinematic vertical short',
    durationTarget: Number(durationTarget) || 30,
    characters,
    relationships,
    scenes,
    dialogues,
    shots
  };

  normalized.characterReferences = referenceProfiles(normalized);
  return normalized;
}

async function callLlmForStoryPlan(topic, style, durationTarget, apiKey) {
  const prompt = `Bạn là một Đạo diễn & Biên kịch video AI hàng đầu chuyên về YouTube Shorts, TikTok, và Instagram Reels.
Hãy tạo ra một bản Kế hoạch Kịch bản (StoryPlan) đối thoại đa nhân vật hoàn chỉnh, chặt chẽ, cuốn hút cho chủ đề sau:

CHỦ ĐỀ: "${topic}"
PHONG CÁCH: "${style}"
THỜI LƯỢNG MỤC TIÊU: ${durationTarget} giây

YÊU CẦU BẮT BUỘC:
1. Tạo ít nhất 2 nhân vật (characters) có tính cách, vai trò, độ tuổi, ngoại hình rõ ràng và giọng đọc phù hợp (vi-female hoặc vi-male).
2. Thiết lập mối quan hệ rõ ràng giữa các nhân vật (relationships).
3. Chia thành các phân cảnh (scenes) và các góc quay/shot (shots) với mô tả hành động, góc máy và prompt hình ảnh trực quan.
4. Lời thoại (dialogues) phải phân định rõ người nói (speakerId), cảm xúc, hành động khi nói và giọng đọc (voiceId).
5. Đảm bảo tính nhất quán tuyệt đối về ID (storyId, character IDs, relationship IDs, scene IDs, shot IDs, dialogue IDs).
6. TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON THUẦN TÚY theo schema sau (không kèm văn bản ngoài JSON):

${STORY_PLAN_JSON_SCHEMA}`;

  // 1. Try Groq Cloud (Ultra fast, high rate limit)
  const groqKey = apiKey || process.env.GROQ_API_KEY;
  if (groqKey && groqKey.trim().length > 10) {
    try {
      const aiPool = require('./aiPoolService');
      console.log('🤖 [StoryPlan Service] Đang tạo kịch bản qua Groq AI...');
      const groqRes = await aiPool.callGroq(prompt, groqKey);
      if (groqRes && groqRes.content) {
        const parsed = extractJson(groqRes.content);
        if (parsed) return parsed;
      }
    } catch (gErr) {
      console.warn('[StoryPlan Service] Groq failed:', gErr.message);
    }
  }

  // 2. Try OpenRouter
  const openRouterKey = apiKey || process.env.OPENROUTER_API_KEY;
  if (openRouterKey && openRouterKey.trim().length > 10) {
    try {
      const aiPool = require('./aiPoolService');
      console.log('🤖 [StoryPlan Service] Đang tạo kịch bản qua OpenRouter AI...');
      const orRes = await aiPool.callOpenRouter(prompt, openRouterKey);
      if (orRes && orRes.content) {
        const parsed = extractJson(orRes.content);
        if (parsed) return parsed;
      }
    } catch (orErr) {
      console.warn('[StoryPlan Service] OpenRouter failed:', orErr.message);
    }
  }

  // 3. Try Gemini (if valid AI Studio key starts with AIzaSy)
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
  if (effectiveKey && effectiveKey.trim().startsWith('AIzaSy')) {
    try {
      const genAI = new GoogleGenerativeAI(effectiveKey.trim());
      const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' }
          });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          const rawPlan = extractJson(text);
          if (rawPlan) return rawPlan;
        } catch (mErr) {
          console.warn(`[StoryPlan Service] Gemini ${modelName} failed:`, mErr.message);
        }
      }
    } catch (geminiErr) {
      console.warn('[StoryPlan Service] Gemini init error:', geminiErr.message);
    }
  }

  throw new Error('Tất cả các mô hình AI (Groq, OpenRouter, Gemini) đều không thể xử lý. Vui lòng kiểm tra lại API Key trong .env.');
}

async function generateStoryPlan({
  topic,
  style = 'conversational cinematic vertical short',
  durationTarget = 30,
  apiKey,
  generate
}) {
  if (!topic || !topic.trim()) {
    const error = new Error('Chủ đề video (topic) là bắt buộc.');
    error.code = 'INVALID_TOPIC';
    throw error;
  }

  let rawPlan;
  try {
    if (generate && typeof generate === 'function') {
      rawPlan = await generate({
        topic: topic.trim(),
        style,
        durationTarget,
        schema: STORY_PLAN_JSON_SCHEMA
      });
    } else {
      rawPlan = await callLlmForStoryPlan(topic.trim(), style, durationTarget, apiKey);
    }
  } catch (err) {
    if (err.code === 'GENERATION_UNAVAILABLE') throw err;
    const error = new Error(`Tạo StoryPlan bằng AI thất bại: ${err.message}`);
    error.code = 'GENERATION_FAILED';
    error.originalError = err.message;
    throw error;
  }

  const normalized = normalizeStoryPlan(rawPlan, topic, style, durationTarget);
  const validation = validateStoryPlan(normalized);

  if (!validation.valid) {
    const error = new Error(`StoryPlan được tạo không hợp lệ: ${validation.issues.join(' | ')}`);
    error.code = 'VALIDATION_FAILED';
    error.validation = validation;
    throw error;
  }

  return store.save(normalized);
}

function validate(plan) {
  return validateStoryPlan(plan);
}

function getStory(storyId) {
  return store.get(storyId);
}

function getAllStories() {
  return store.getAll();
}

function updateStory(storyId, mutateFn) {
  return store.update(storyId, plan => {
    mutateFn(plan);
    plan.characterReferences = referenceProfiles(plan);
  });
}

function createCharacter(storyId, character) {
  return store.update(storyId, plan => {
    const newId = character.id || `char_${String((plan.characters || []).length + 1).padStart(3, '0')}`;
    const newChar = {
      ...character,
      id: newId,
      voice: typeof character.voice === 'object' && character.voice ? character.voice : {
        voiceId: character.voice || 'vi-female',
        language: 'vi-VN',
        gender: character.gender || 'female',
        tone: 'Tự nhiên'
      }
    };
    plan.characters.push(newChar);
    plan.characterReferences = referenceProfiles(plan);
  });
}

function updateCharacter(storyId, characterId, patch) {
  return store.update(storyId, plan => {
    const char = (plan.characters || []).find(c => c.id === characterId);
    if (!char) throw new Error(`Không tìm thấy nhân vật với ID: ${characterId}`);
    Object.assign(char, patch, { id: characterId });
    if (patch.voice) {
      char.voice = typeof patch.voice === 'object' ? patch.voice : {
        voiceId: patch.voice,
        language: 'vi-VN',
        gender: char.gender || 'female',
        tone: 'Tự nhiên'
      };
      // Update voiceId on dialogues where this character is speaker
      (plan.dialogues || []).forEach(d => {
        if (d.speakerId === characterId) {
          d.voiceId = char.voice.voiceId;
        }
      });
    }
    plan.characterReferences = referenceProfiles(plan);
  });
}

function createRelationship(storyId, relationship) {
  return store.update(storyId, plan => {
    const relId = relationship.id || `rel_${String((plan.relationships || []).length + 1).padStart(3, '0')}`;
    plan.relationships.push({
      ...relationship,
      id: relId
    });
  });
}

module.exports = {
  generateStoryPlan,
  validate,
  getStory,
  getAllStories,
  updateStory,
  createCharacter,
  updateCharacter,
  createRelationship,
  referenceProfiles,
  normalizeStoryPlan,
  STORY_PLAN_JSON_SCHEMA
};
