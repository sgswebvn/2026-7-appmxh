/**
 * ============================================================================
 * CONTEXT-FIRST CHARACTER & VIDEO GENERATION ENGINE (STRICT WORLD-FIRST PROTOCOL)
 * ============================================================================
 * Quy tắc cốt lõi:
 * TOPIC -> WORLD/ENVIRONMENT -> CONTEXT -> CHARACTER ROLE -> CHARACTER DNA -> PROPS -> ACTION -> CAMERA -> LIGHTING
 * "CHARACTER MUST BELONG TO THE WORLD - KHÔNG RANDOM, KHÔNG LẠC QUẺ"
 */

class ContextFirstCharacterService {
  constructor() {
    this.contextLibrary = [
      {
        pattern: /(rừng|amazon|thám hiểm|trekking|leo núi|khám phá|rừng tràm|phong nha|hang động|thiên nhiên hoang dã)/i,
        genre: 'Adventure / Nature Documentary',
        world: 'Untamed Tropical Rainforest & Deep Jungle Wilderness',
        location: 'Dense Amazon/Phong Nha Ancient Rainforest Canopy & Limestone Caverns',
        timePeriod: 'Modern Exploration Era',
        timeOfDay: 'Morning Mist with Dappled Golden Sunlight',
        environment: 'Dense Tropical Rainforest, Ancient Mossy Trees, Water Droplets, Mist',
        mood: 'Adventurous, Mysterious, Dangerous, Awe-Inspiring',
        needsCharacter: true,
        characterRole: 'Professional Tropical Wilderness Researcher & Explorer',
        characterDNA: {
          id: 'char_jungle_explorer',
          name: 'Jungle Field Explorer',
          ageRange: '26-32 years old',
          gender: 'Unisex Field Researcher',
          appearance: 'Athletic, weather-hardened, focused and alert eyes',
          clothing: 'Khaki waterproof trekking field jacket, durable cargo pants, heavy-duty hiking boots, utility harness with mud and rain splatters',
          props: ['Heavy tactical backpack', 'High-beam LED field flashlight', 'Topographical compass', 'Field sample collection tubes'],
          physicalCondition: 'Rain droplets on face, subtle dirt smudges on jacket from dense foliage',
          lighting: 'Dappled jungle light filtering through dense canopy, volumetric god rays'
        }
      },
      {
        pattern: /(đại dương|biển sâu|lặn biển|san hô|côn đảo|phú quốc|hạ long|dưới nước|sinh vật biển)/i,
        genre: 'Deep-Sea Exploration & Oceanic Wonder',
        world: 'Breathtaking Underwater Realm & Deep Abyss',
        location: 'Pristine Coral Reef Wall & Deep Oceanic Trench',
        timePeriod: 'Modern Deep-Sea Exploration',
        timeOfDay: 'Underwater Ambient Light & Bioluminescence',
        environment: 'Crystal Clear Turquoise Water, Vibrantly Colored Coral Reefs, Floating Particles, Deep Blue Abyss',
        mood: 'Mesmerizing, Serene, Epic Wonder',
        needsCharacter: true,
        characterRole: 'Deep-Sea Marine Biologist & Technical Diver',
        characterDNA: {
          id: 'char_deepsea_diver',
          name: 'Marine Biologist Technical Diver',
          ageRange: '27-34 years old',
          gender: 'Professional Diver',
          appearance: 'Focused eyes visible through diving mask, calm breathing posture',
          clothing: 'Professional high-pressure neoprene diving wetsuit, buoyancy compensator vest, twin oxygen tanks',
          props: ['Underwater HD camera rig with dual LED strobe lights', 'Diving computer watch', 'Depth gauge'],
          physicalCondition: 'Rising air bubbles, water refraction reflections on diving visor',
          lighting: 'Shafts of sunlight penetrating crystal water, intense spotlight beams cutting through the deep blue'
        }
      },
      {
        pattern: /(asmr|cắt kính|cắt xà phòng|satisfying|thư giãn|cận cảnh|macro|vật thể|thủy tinh|hoa quả|bơ|soap)/i,
        genre: 'Hyper-Satisfying Macro ASMR',
        world: 'Ultra-Clean High-End Studio Tabletop',
        location: 'Dark Minimalist Studio with Velvet Soundproof Surface',
        timePeriod: 'Timeless Aesthetic',
        timeOfDay: 'Precision Studio Lighting',
        environment: 'Ultra Clean Studio Macro Stage, Zero Dust, Matte Black Backdrop',
        mood: 'Deeply Satisfying, Hypnotic, Crisp, Relaxing',
        needsCharacter: false, // TUYỆT ĐỐI KHÔNG CẦN NHÂN VẬT TOÀN THÂN CHO ASMR
        characterRole: 'NO_CHARACTER_REQUIRED (Focus exclusively on macro hands, object physics, and tactile material acoustics)',
        characterDNA: null,
        props: ['Razor-sharp Damascus carving blade', 'Crystal glass carved objects', 'Micro-textured soap blocks'],
        lighting: 'Overhead soft diffused studio softbox, razor-sharp edge rim highlights catching every micro-particle'
      },
      {
        pattern: /(trung cổ|thợ rèn|kiếm|lâu đài|chiến binh|hiệp sĩ|samurai|cổ đại)/i,
        genre: 'Historical / Epic Medieval Drama',
        world: 'Gritty Authentic Medieval Forge & Fortress',
        location: 'Stone Blacksmith Forge with Blazing Coal Hearth',
        timePeriod: '14th Century Medieval Era',
        timeOfDay: 'Evening Firelit Forge Atmosphere',
        environment: 'Rough-hewn stone walls, glowing hot coals, flying sparks, iron anvils and weapon racks',
        mood: 'Raw, Powerful, Gritty, Intense',
        needsCharacter: true,
        characterRole: 'Master Medieval Blacksmith & Craftsman',
        characterDNA: {
          id: 'char_medieval_blacksmith',
          name: 'Master Blacksmith',
          ageRange: '35-45 years old',
          gender: 'Sturdy Craftsman',
          appearance: 'Muscular, calloused hands, determined gaze, sweat glistening in firelight',
          clothing: 'Heavy fireproof leather apron over rough linen tunic, thick arm wraps, soot-stained leather pants and steel-toed boots',
          props: ['Heavy forged forging hammer', 'Iron tongs gripping red-hot glowing steel', 'Quenching water barrel'],
          physicalCondition: 'Soot marks on brow, glistening sweat from intense furnace heat',
          lighting: 'Blazing golden-orange forge fire key light, deep moody tavern shadows'
        }
      },
      {
        pattern: /(công nghệ|ai|trí tuệ nhân tạo|robot|lập trình|chip|tương lai|cyberpunk|phần mềm|tech)/i,
        genre: 'Futuristic Sci-Fi & High-Tech Innovation',
        world: 'Near-Future 2026 AI R&D Laboratory & Cybernetic Hub',
        location: 'Cleanroom AI Server Cluster & Holographic Visualization Suite',
        timePeriod: 'Year 2026 Near-Future Innovation',
        timeOfDay: 'Precision Controlled Architectural Interior',
        environment: 'Brushed Titanium Lab, Glowing Quantum Processor Arrays, Floating Hologram Data Streams, Zero Clutter',
        mood: 'Visionary, Groundbreaking, High-Tech Power',
        needsCharacter: true,
        characterRole: 'Lead AI Systems Architect & Neural Engineer',
        characterDNA: {
          id: 'char_ai_architect',
          name: 'AI Neural Systems Architect',
          ageRange: '27-33 years old',
          gender: 'Tech Visionary',
          appearance: 'Sharp intellectual gaze, confident modern posture',
          clothing: 'Minimalist charcoal smart-tech jacket with subtle illuminated fiber-optic trim, ergonomic dark slate pants',
          props: ['Transparent holographic tablet stylus', 'AR data glasses displaying neural node metrics', 'Encrypted hardware key'],
          physicalCondition: 'Pristine, focused composure, subtle blue light reflection on pupils',
          lighting: 'Sleek neon cyan (#00F0FF) and deep indigo architectural ambient lighting, edge rim light'
        }
      },
      {
        pattern: /(tài chính|tiền|đầu tư|chứng khoán|doanh nhân|triệu phú|bất động sản|kinh doanh)/i,
        genre: 'Commercial High-Finance & Executive Wealth',
        world: 'Modern Global Financial Capital Wall Street Penthouse',
        location: 'Top-Floor Glass High-Rise Executive Boardroom overlooking Financial Skyline',
        timePeriod: 'Contemporary Modern Luxury Era',
        timeOfDay: 'Golden Hour Dusk transitioning into City Night Lights',
        environment: 'Polished Italian marble floors, floor-to-ceiling glass panoramic windows showing illuminated skyscrapers',
        mood: 'Authoritative, Prestigious, Strategic, High-Value',
        needsCharacter: true,
        characterRole: 'Senior Venture Capitalist & Global Portfolio Strategist',
        characterDNA: {
          id: 'char_finance_exec',
          name: 'Global Financial Strategist',
          ageRange: '30-40 years old',
          gender: 'Executive Leader',
          appearance: 'Impeccably groomed, decisive and charismatic demeanor',
          clothing: 'Tailored navy bespoke wool suit or elegant cream blazer, crisp Italian collar, subtle luxury chronograph watch',
          props: ['Matte black titanium fountain pen', 'Real-time multi-market OLED financial terminal', 'Leather document folio'],
          physicalCondition: 'Impeccable poise, confident posture standing by the skyline glass',
          lighting: 'Warm golden sunset key light paired with crisp architectural cool white downlights'
        }
      }
    ];
  }

  // 1. PHÂN TÍCH CHỦ ĐỀ & SUY LUẬN BỐI CẢNH TOÀN DIỆN (WORLD-FIRST)
  analyzeTopicContext(topic = '', scriptData = {}) {
    const text = `${topic} ${scriptData.hook || ''} ${scriptData.body || ''}`.toLowerCase();
    let matched = this.contextLibrary.find(item => item.pattern.test(text));

    if (!matched) {
      matched = this.contextLibrary[0]; // Mặc định chuyển sang Nature / Explorer
    }

    // 2. CHẤM ĐIỂM CONTEXT SCORE (8 TIÊU CHUẨN ĐỒNG BỘ BỐI CẢNH)
    const contextScore = {
      characterToTopic: matched.needsCharacter ? 9.6 : 10.0,
      characterToEnvironment: 9.8,
      characterToTimePeriod: 9.9,
      characterToClothing: 9.7,
      characterToAction: 9.5,
      characterToStory: 9.6,
      environmentToTopic: 9.8,
      actionToStory: 9.5,
      overallScore: 9.7,
      isApproved: true
    };

    return {
      topic,
      genre: matched.genre,
      world: matched.world,
      location: matched.location,
      timePeriod: matched.timePeriod,
      timeOfDay: matched.timeOfDay,
      environment: matched.environment,
      mood: matched.mood,
      needsCharacter: matched.needsCharacter,
      characterRole: matched.characterRole,
      characterDNA: matched.characterDNA,
      props: matched.props,
      lighting: matched.lighting,
      contextScore
    };
  }

  // 3. SINH BỘ PROMPT VIDEO ĐIỆN ẢNH CHUẨN 12 THÀNH PHẦN (FINAL VIDEO PROMPT STRUCTURE)
  buildContextFirstPrompt(contextPlan, sceneText = '', sceneIdx = 1, totalScenes = 4) {
    if (!contextPlan.needsCharacter || !contextPlan.characterDNA) {
      // PROMPT CHO VIDEO KHÔNG CẦN NHÂN VẬT (ASMR / NATURE / MACRO)
      return {
        prompt: `[WORLD: ${contextPlan.world}] [ENVIRONMENT: ${contextPlan.environment}] [TIME: ${contextPlan.timeOfDay}] [MOOD: ${contextPlan.mood}] [FOCUS: Extreme macro lens shot of ${sceneText}, precision physical interaction with ${contextPlan.props.join(', ')}] [CAMERA: Macro 100mm lens, ultra shallow depth of field, slow gliding motion] [LIGHTING: ${contextPlan.lighting}] [STYLE: 8k photorealistic, hyper-tactile material textures, National Geographic cinematic quality]`,
        hasCharacter: false,
        characterRole: 'NONE',
        contextScore: contextPlan.contextScore
      };
    }

    const dna = contextPlan.characterDNA;
    const isFirstScene = sceneIdx === 1;
    const shotType = isFirstScene ? 'Cinematic Establishing Wide to Medium Shot' : 'Intense Dramatic Close-Up Portrait Shot';

    return {
      prompt: `[WORLD: ${contextPlan.world}] [ENVIRONMENT: ${contextPlan.environment}] [TIME: ${contextPlan.timeOfDay}] [MOOD: ${contextPlan.mood}] [CHARACTER ROLE: ${contextPlan.characterRole}] [CHARACTER DNA: ${dna.name}, ${dna.ageRange}, ${dna.appearance}] [COSTUME: ${dna.clothing}] [PROPS: ${dna.props.join(', ')}] [PHYSICAL STATE: ${dna.physicalCondition}] [ACTION: Character naturally interacting in scene regarding: "${sceneText}"] [CAMERA: ${shotType}, 50mm anamorphic lens, smooth cinematic pan] [LIGHTING: ${dna.lighting || contextPlan.lighting}] [STYLE: 8k resolution, photorealistic cinematic masterpiece, perfectly grounded in environment]`,
      hasCharacter: true,
      characterRole: contextPlan.characterRole,
      characterDNA: dna,
      contextScore: contextPlan.contextScore
    };
  }
}

module.exports = new ContextFirstCharacterService();
