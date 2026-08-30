/**
 * ============================================================================
 * BRAND PERSONA & MULTI-SCENE AI IMAGE SERVICE
 * ============================================================================
 * - Quản lý nhân vật đại diện thương hiệu (AI Avatar & Persona).
 * - Tự động đồng bộ phong cách, nhân vật, bối cảnh không gian cho từng phân cảnh.
 * - Sinh hình ảnh điện ảnh độ phân giải cao 9:16 / 16:9 với Seed-lock nhất quán.
 */

class BrandPersonaService {
  constructor() {
    this.personas = {
      'alex-tech': {
        id: 'alex-tech',
        name: 'Alex AI (Chuyên Gia Công Nghệ & AI)',
        gender: 'male',
        voiceKey: 'vi-male',
        theme: 'Cyberpunk Tech Studio, Neon Blue & Purple Lighting, Hologram Screens, futuristic high-tech laboratory, 8k resolution, cinematic lighting, photorealistic',
        avatarPrompt: 'Portrait of handsome 28-year-old Vietnamese male tech expert wearing smart casual dark techwear jacket, confident smile, futuristic cyberpunk studio background with neon blue light, photorealistic, 8k',
        avatarUrl: 'https://image.pollinations.ai/prompt/Portrait%20of%20handsome%2028-year-old%20Vietnamese%20male%20tech%20expert%20wearing%20smart%20dark%20techwear%20jacket%20futuristic%20cyberpunk%20studio%20neon%20blue%20photorealistic%208k?width=400&height=400&seed=20261&nologo=true&model=flux'
      },
      'minhanh-finance': {
        id: 'minhanh-finance',
        name: 'Minh Anh (Nữ Doanh Nhân & Chuyên Gia Tài Chính)',
        gender: 'female',
        voiceKey: 'vi-female',
        theme: 'Modern Luxury Executive Penthouse, High-rise Wall Street skyline view, warm golden ambient light, elegant business atmosphere, 8k resolution, cinematic',
        avatarPrompt: 'Portrait of beautiful 27-year-old Vietnamese businesswoman wearing elegant beige blazer, warm confident expression, luxury modern high-rise office glass window, photorealistic, 8k',
        avatarUrl: 'https://image.pollinations.ai/prompt/Portrait%20of%20beautiful%2027-year-old%20Vietnamese%20businesswoman%20wearing%20elegant%20beige%20blazer%20luxury%20modern%20high-rise%20office%20glass%20window%20photorealistic%208k?width=400&height=400&seed=20262&nologo=true&model=flux'
      },
      'travel-eco': {
        id: 'travel-eco',
        name: 'Linh Travel (Đại Sứ Du Lịch Sinh Thái & Trải Nghiệm)',
        gender: 'female',
        voiceKey: 'vi-female',
        theme: 'Breathtaking Vietnam Eco Landscape, Lush Emerald Rainforest, Pristine White Sand Dunes in Mui Ne, Ha Long Bay Karst Waters, Phong Nha Cave, National Geographic cinematic drone shot, 8k photorealistic',
        avatarPrompt: 'Portrait of joyful 25-year-old Vietnamese female travel explorer wearing stylish outdoor trekking jacket and straw hat, stunning emerald mountain valley background in Vietnam, warm natural sunlight, photorealistic, 8k',
        avatarUrl: 'https://image.pollinations.ai/prompt/Portrait%20of%20joyful%2025-year-old%20Vietnamese%20female%20travel%20explorer%20outdoor%20jacket%20stunning%20emerald%20mountain%20valley%20Vietnam%20sunlight%20photorealistic%208k?width=400&height=400&seed=20264&nologo=true&model=flux'
      },
      'kenji-story': {
        id: 'kenji-story',
        name: 'Kenji (Kể Chuyện & Thám Hiểm Bí Ẩn)',
        gender: 'male',
        voiceKey: 'vi-male',
        theme: 'Dark Cinematic Mystery Archive, Vintage wooden study with glowing cosmic maps, moody cinematic shadows, dramatic rim light, 8k resolution',
        avatarPrompt: 'Portrait of charismatic 30-year-old Vietnamese male explorer and storyteller wearing brown trench coat, mysterious atmospheric study library background, photorealistic, 8k',
        avatarUrl: 'https://image.pollinations.ai/prompt/Portrait%20of%20charismatic%2030-year-old%20Vietnamese%20male%20explorer%20storyteller%20mysterious%20study%20library%20photorealistic%208k?width=400&height=400&seed=20263&nologo=true&model=flux'
      }
    };
  }

  getPersonas() {
    return Object.values(this.personas);
  }

  getPersonaById(id) {
    return this.personas[id] || this.personas['alex-tech'];
  }

  // Tự động phân tách kịch bản thành 3-5 phân cảnh hình ảnh đồng bộ
  generateScenesFromScript(scriptData = {}, personaId = 'alex-tech', aspectRatio = '9:16') {
    const persona = this.getPersonaById(personaId);
    const isVertical = aspectRatio === '9:16';
    const width = isVertical ? 720 : 1280;
    const height = isVertical ? 1280 : 720;
    const baseSeed = Math.floor(Math.random() * 80000) + 10000;

    const scenes = [];

    const topicFirstEngine = require('./topicFirstImageEngine');
    const contextFirstService = require('./contextFirstCharacterService');

    // 1. Phân tích bối cảnh toàn diện theo nguyên tắc Topic-First & World-First
    const topicText = scriptData.topic || scriptData.hook || scriptData.body || 'Chủ đề video';
    const contextPlan = contextFirstService.analyzeTopicContext(topicText, scriptData);

    // Scene 1: Hook (Mở đầu bùng nổ)
    const hookText = scriptData.hook || 'Bí mật quan trọng nhất bạn cần biết ngay hôm nay.';
    const hookPromptData = contextFirstService.buildContextFirstPrompt(contextPlan, hookText, 1, 4);
    const hookImgData = topicFirstEngine.matchTopicAndSceneImage(topicText, hookText, 0);

    scenes.push({
      index: 1,
      type: 'HOOK',
      title: 'Phân cảnh 1: Hook Thu Hút 3s Đầu',
      text: hookText,
      durationSec: 4,
      prompt: hookPromptData.prompt,
      hasCharacter: hookPromptData.hasCharacter,
      characterRole: hookImgData.characterProfile?.role || hookPromptData.characterRole,
      imageUrl: hookImgData.imageUrl,
      personaAvatarUrl: hookPromptData.hasCharacter ? (hookImgData.imageUrl || persona.avatarUrl) : null,
      personaName: hookImgData.characterProfile?.role ? hookImgData.characterProfile.role.split('/')[0].trim() : (hookPromptData.characterDNA?.name || persona.name)
    });

    // Scene 2 & 3: Body Sections (Nội dung chính)
    const sections = (scriptData.bodySections && scriptData.bodySections.length > 0)
      ? scriptData.bodySections
      : [{ heading: 'Nội dung cốt lõi', content: scriptData.body || 'Chi tiết các bước thực hiện tự động hóa tăng trưởng.' }];

    sections.slice(0, 3).forEach((sec, idx) => {
      const secContent = sec.content || sec.heading || '';
      const bodyPromptData = contextFirstService.buildContextFirstPrompt(contextPlan, secContent, idx + 2, sections.length + 2);
      const bodyImgData = topicFirstEngine.matchTopicAndSceneImage(topicText, secContent, idx + 1);

      scenes.push({
        index: idx + 2,
        type: 'BODY',
        title: `Phân cảnh ${idx + 2}: ${sec.heading || 'Nội dung chính ' + (idx + 1)}`,
        text: secContent,
        durationSec: 5,
        prompt: bodyPromptData.prompt,
        hasCharacter: bodyPromptData.hasCharacter,
        characterRole: bodyImgData.characterProfile?.role || bodyPromptData.characterRole,
        imageUrl: bodyImgData.imageUrl,
        personaAvatarUrl: bodyPromptData.hasCharacter ? (bodyImgData.imageUrl || persona.avatarUrl) : null,
        personaName: bodyImgData.characterProfile?.role ? bodyImgData.characterProfile.role.split('/')[0].trim() : (bodyPromptData.characterDNA?.name || persona.name)
      });
    });

    // Final Scene: Call To Action (Kêu gọi hành động)
    const ctaText = scriptData.callToAction || scriptData.cta || 'Nhấn theo dõi kênh để không bỏ lỡ các bí quyết tiếp theo!';
    const ctaPromptData = contextFirstService.buildContextFirstPrompt(contextPlan, ctaText, scenes.length + 1, scenes.length + 1);
    const ctaImgData = topicFirstEngine.matchTopicAndSceneImage(topicText, ctaText, 4);

    scenes.push({
      index: scenes.length + 1,
      type: 'CTA',
      title: `Phân cảnh ${scenes.length + 1}: Kêu Gọi Hành Động (CTA)`,
      text: ctaText,
      durationSec: 4,
      prompt: ctaPromptData.prompt,
      hasCharacter: ctaPromptData.hasCharacter,
      characterRole: ctaImgData.characterProfile?.role || ctaPromptData.characterRole,
      imageUrl: ctaImgData.imageUrl,
      personaAvatarUrl: ctaPromptData.hasCharacter ? (ctaImgData.imageUrl || persona.avatarUrl) : null,
      personaName: ctaImgData.characterProfile?.role ? ctaImgData.characterProfile.role.split('/')[0].trim() : (ctaPromptData.characterDNA?.name || persona.name)
    });

    return {
      persona,
      baseSeed,
      aspectRatio,
      totalScenes: scenes.length,
      estimatedDurationSec: scenes.reduce((acc, s) => acc + s.durationSec, 0),
      scenes
    };
  }

  translateContextToEnglish(vietnameseText = '') {
    // Trích xuất các từ khóa ngữ cảnh chính sang tiếng Anh để AI vẽ chính xác
    const lower = vietnameseText.toLowerCase();
    const keywords = [];

    if (lower.includes('mũi né') || lower.includes('cồn cát') || lower.includes('đồi cát')) keywords.push('golden sand dunes in Mui Ne Vietnam at sunrise with soft shadows');
    if (lower.includes('phong nha') || lower.includes('hang động') || lower.includes('sơn đoòng')) keywords.push('Phong Nha cave subterranean river glowing sunlight through cave ceiling');
    if (lower.includes('côn đảo') || lower.includes('phú quốc') || lower.includes('biển')) keywords.push('crystal turquoise ocean beach with palm trees and limestone islands in Vietnam');
    if (lower.includes('rừng tràm') || lower.includes('sinh thái') || lower.includes('trà sư')) keywords.push('Tra Su cajuput forest emerald green duckweed waterway with traditional wooden boat');
    if (lower.includes('hạ long') || lower.includes('cát bà')) keywords.push('Ha Long Bay emerald green water with towering limestone karsts in golden hour');
    if (lower.includes('sa pa') || lower.includes('hà giang') || lower.includes('ruộng bậc thang')) keywords.push('magnificent terraced rice fields in Mu Cang Chai Vietnam with misty mountain peaks');
    if (lower.includes('du lịch xanh') || lower.includes('môi trường') || lower.includes('sinh thái')) keywords.push('sustainable eco tourism Vietnam pristine green nature preservation');

    if (lower.includes('ai') || lower.includes('trí tuệ nhân tạo') || lower.includes('công nghệ')) keywords.push('artificial intelligence glowing neural network data matrix');
    if (lower.includes('tiền') || lower.includes('doanh thu') || lower.includes('tài chính') || lower.includes('giàu')) keywords.push('exponential financial growth digital gold currency graph');
    if (lower.includes('lỗi') || lower.includes('sai lầm') || lower.includes('nguy hiểm') || lower.includes('cảnh báo')) keywords.push('dramatic warning hazard glowing danger shield breakdown');
    if (lower.includes('bí mật') || lower.includes('khám phá') || lower.includes('bất ngờ')) keywords.push('mysterious glowing treasure chest glowing quantum core reveal');
    if (lower.includes('tự động') || lower.includes('nhanh') || lower.includes('tăng trưởng')) keywords.push('supersonic high speed warp automation light trails');
    if (lower.includes('kênh') || lower.includes('video') || lower.includes('triệu view')) keywords.push('viral video broadcast screen with millions of viewers floating likes');

    if (keywords.length === 0) keywords.push('cinematic modern aesthetic visual atmosphere storytelling');
    return keywords.join(', ');
  }
}

module.exports = new BrandPersonaService();
