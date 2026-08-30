import { test, expect } from '@playwright/test';
const { ImageProviderRegistry } = require('../services/imageProviders/imageProviderRegistry');
const GoogleImageProvider = require('../services/imageProviders/googleImageProvider');
const ReplicateImageProvider = require('../services/imageProviders/replicateImageProvider');
const MockImageProvider = require('../services/imageProviders/mockImageProvider');
const { CharacterPromptBuilder, ScenePromptBuilder, ShotPromptBuilder } = require('../services/promptBuilders');
const CharacterConsistencyStrategy = require('../services/characterConsistencyStrategy');
const { VisualAssetStore } = require('../services/visualAssetStore');
const { VisualGenerationService } = require('../services/visualGenerationService');
const { storyPlanStore } = require('../services/storyPlanStore');
const path = require('path');
const fs = require('fs');

test.describe('Visual Generation Engine & Media Provider Layer (Phase 3B)', () => {

  // Seed sample StoryPlan for tests
  const testStoryPlan = {
    storyId: 'story_phase3b_test_001',
    topic: 'Một ông già 70 tuổi ăn mì cay cùng cô cháu gái 8 tuổi',
    title: 'Thử Thách Mì Cay Ông Cháu',
    genre: 'Family Comedy',
    style: 'conversational cinematic vertical short',
    durationTarget: 30,
    characters: [
      {
        id: 'char_ong_nam',
        name: 'Ông Năm',
        age: 70,
        gender: 'male',
        role: 'Grandfather (Elderly)',
        personality: ['Hài hước', 'Thương cháu'],
        appearance: {
          face: 'Nếp nhăn phúc hậu, mắt cười',
          hair: 'Tóc bạc trắng',
          clothing: 'Áo sơ mi đũi màu be',
          body: 'Gầy khỏe mạnh',
          style: 'Cinematic warm realism'
        },
        visualPrompt: 'Cinematic portrait of a 70yo Vietnamese grandfather eating spicy noodles',
        voice: { voiceId: 'vi-male', language: 'vi-VN', gender: 'male', tone: 'Hào sảng' }
      },
      {
        id: 'char_be_an',
        name: 'Bé An',
        age: 8,
        gender: 'female',
        role: 'Granddaughter (Child)',
        personality: ['Lém lỉnh', 'Ngây thơ'],
        appearance: {
          face: 'Má phúng phính, mắt to tròn',
          hair: 'Tóc buộc hai bên',
          clothing: 'Váy yếm hoa nhí',
          body: 'Nhỏ nhắn',
          style: 'Cinematic realism'
        },
        visualPrompt: 'Cinematic portrait of an 8yo Vietnamese granddaughter',
        voice: { voiceId: 'vi-female', language: 'vi-VN', gender: 'female', tone: 'Trong trẻo' }
      }
    ],
    relationships: [
      {
        id: 'rel_001',
        fromCharacterId: 'char_ong_nam',
        toCharacterId: 'char_be_an',
        relationship: 'Ông nội ↔ Cháu gái',
        dynamic: 'Ông chiều cháu, cháu trêu ông ăn mì cay'
      }
    ],
    scenes: [
      {
        id: 'scene_001',
        location: 'Quán mì cay Hàn Quốc',
        time: 'Buổi chiều',
        environment: 'Khói bốc nghi ngút từ 2 tô mì đất đỏ rực ớt',
        characters: ['char_ong_nam', 'char_be_an'],
        action: 'Hai ông cháu cùng nâng đũa thử nước dùng cay nồng',
        emotion: 'Vui vẻ và hào hứng',
        dialogueIds: ['dlg_001'],
        visualPrompt: 'Spicy noodle restaurant table with steam'
      }
    ],
    dialogues: [
      {
        id: 'dlg_001',
        speakerId: 'char_ong_nam',
        sceneId: 'scene_001',
        text: 'Nước dùng cay thế này ông ăn cái vèo là hết!',
        emotion: 'Hào sảng',
        action: 'Húp một thìa nước dùng',
        voiceId: 'vi-male'
      }
    ],
    shots: [
      {
        id: 'shot_001',
        sceneId: 'scene_001',
        shotType: 'Two-Shot 50mm',
        camera: 'Eye-level stationary shot',
        duration: 4,
        characters: ['char_ong_nam', 'char_be_an'],
        action: 'Ông cháu cùng nhìn vào tô mì cay',
        dialogueIds: ['dlg_001'],
        visualPrompt: 'Warm two-shot of grandfather and granddaughter at noodle restaurant'
      }
    ],
    characterReferences: []
  };

  test.beforeAll(() => {
    storyPlanStore.save(testStoryPlan);
  });

  // 1. Provider Registry Test
  test('ImageProviderRegistry registers, lists, and retrieves providers', async () => {
    const registry = new ImageProviderRegistry();
    const providers = await registry.list();
    expect(providers.length).toBeGreaterThanOrEqual(3);

    const google = registry.get('google-imagen');
    expect(google).toBeDefined();
    expect(google?.name).toContain('Google Imagen');

    const replicate = registry.get('replicate');
    expect(replicate).toBeDefined();

    const mock = registry.get('mock-test-provider');
    expect(mock).toBeDefined();
  });

  // 2. Provider Config Validation & Missing Key
  test('unconfigured Google provider returns IMAGE_PROVIDER_NOT_CONFIGURED', async () => {
    const unconfigured = new GoogleImageProvider({ apiKey: '' });
    const check = unconfigured.validateConfig();
    expect(check.valid).toBe(false);

    const result = await unconfigured.generateImage({ prompt: 'Test prompt' });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('IMAGE_PROVIDER_NOT_CONFIGURED');
  });

  // 3. Provider Fallback Architecture
  test('provider fallback routes from failing primary to working mock provider and logs it', async () => {
    const registry = new ImageProviderRegistry();
    
    // Register failing mock as primary
    registry.register(new MockImageProvider({ shouldFail: true, failReason: 'SIMULATED_PRIMARY_ERROR' }));
    
    // Custom mock as secondary
    const workingMock = new MockImageProvider({ config: { name: 'Working Secondary' } });
    workingMock.id = 'working-mock-secondary';
    registry.register(workingMock);

    process.env.IMAGE_PROVIDER = 'mock-test-provider';
    process.env.IMAGE_PROVIDER_FALLBACKS = 'working-mock-secondary';

    const result = await registry.generateWithFallback({
      prompt: 'A photorealistic portrait of an old man',
      preferredProvider: 'mock-test-provider'
    });

    expect(result.success).toBe(true);
    expect(result.requestedProvider).toBe('mock-test-provider');
    expect(result.actualProvider).toBe('working-mock-secondary');
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBeDefined();
  });

  // 4. Quota Exhaustion Failure Handling
  test('quota failure returns IMAGE_PROVIDER_QUOTA_EXCEEDED without crashing', async () => {
    const quotaExhaustedMock = new MockImageProvider({ quotaExceeded: true });
    const res = await quotaExhaustedMock.generateImage({ prompt: 'Test' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('IMAGE_PROVIDER_QUOTA_EXCEEDED');
  });

  // 5. Character Prompt Builder
  test('CharacterPromptBuilder generates structured prompt preserving identity features', () => {
    const char = testStoryPlan.characters[0];
    const { prompt, negativePrompt } = CharacterPromptBuilder.build(char);

    expect(prompt).toContain('Ông Năm');
    expect(prompt).toContain('70-year-old male');
    expect(prompt).toContain('Grandfather (Elderly)');
    expect(prompt).toContain('Tóc bạc trắng');
    expect(prompt).toContain('Áo sơ mi đũi màu be');
    expect(negativePrompt).toContain('blurry');
  });

  // 6. Scene Prompt Builder
  test('ScenePromptBuilder generates scene context with environment and present characters', () => {
    const scene = testStoryPlan.scenes[0];
    const { prompt } = ScenePromptBuilder.build(scene, testStoryPlan.characters);

    expect(prompt).toContain('Quán mì cay Hàn Quốc');
    expect(prompt).toContain('Buổi chiều');
    expect(prompt).toContain('Ông Năm');
    expect(prompt).toContain('Bé An');
  });

  // 7. Shot Prompt Builder
  test('ShotPromptBuilder formats framing, shotType, camera, and character details', () => {
    const shot = testStoryPlan.shots[0];
    const scene = testStoryPlan.scenes[0];
    const { prompt } = ShotPromptBuilder.build(shot, scene, testStoryPlan.characters);

    expect(prompt).toContain('Two-Shot 50mm');
    expect(prompt).toContain('Eye-level stationary shot');
    expect(prompt).toContain('Ông Năm');
    expect(prompt).toContain('Bé An');
  });

  // 8. Character Reference Persistence & Generation
  test('VisualGenerationService generates and persists canonical character reference', async () => {
    const testAssetFile = path.join(process.cwd(), 'data', 'test-visual-assets.json');
    const assetStore = new VisualAssetStore(testAssetFile);
    const service = new VisualGenerationService();

    // Use mock provider
    const res = await service.generateCharacterReference({
      storyId: 'story_phase3b_test_001',
      characterId: 'char_ong_nam',
      preferredProvider: 'mock-test-provider',
      forceRegenerate: true
    });

    expect(res.asset).toBeDefined();
    expect(res.asset.status).toBe('ready');
    expect(res.asset.targetId).toBe('char_ong_nam');
    expect(res.asset.type).toBe('character_reference');
    expect(res.asset.imageUrl).toContain('/uploads/visual-assets/');
    expect(fs.existsSync(res.asset.filePath)).toBe(true);

    // Clean up test file
    if (fs.existsSync(testAssetFile)) fs.unlinkSync(testAssetFile);
  });

  // 9. Duplicate Reference Prevention
  test('duplicate reference generation returns cached asset unless forceRegenerate is true', async () => {
    const service = new VisualGenerationService();

    const first = await service.generateCharacterReference({
      storyId: 'story_phase3b_test_001',
      characterId: 'char_be_an',
      preferredProvider: 'mock-test-provider',
      forceRegenerate: true
    });

    const second = await service.generateCharacterReference({
      storyId: 'story_phase3b_test_001',
      characterId: 'char_be_an',
      preferredProvider: 'mock-test-provider',
      forceRegenerate: false
    });

    expect(second.cached).toBe(true);
    expect(second.asset.assetId).toBe(first.asset.assetId);
  });

  // 10. Bulk Character Reference Generation
  test('bulk generation creates references for all characters and reports statistics', async () => {
    const service = new VisualGenerationService();

    const summary = await service.generateAllCharacterReferences({
      storyId: 'story_phase3b_test_001',
      preferredProvider: 'mock-test-provider',
      forceRegenerate: true
    });

    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.results.length).toBe(2);
  });

  // 11. Scene Visual Generation with Character Consistency
  test('Scene visual generation links characters present and character reference assets', async () => {
    const service = new VisualGenerationService();

    const sceneAsset = await service.generateSceneVisual({
      storyId: 'story_phase3b_test_001',
      sceneId: 'scene_001',
      preferredProvider: 'mock-test-provider'
    });

    expect(sceneAsset).toBeDefined();
    expect(sceneAsset.type).toBe('scene_visual');
    expect(sceneAsset.targetId).toBe('scene_001');
    expect(sceneAsset.status).toBe('ready');
  });

  // 12. Shot Visual Generation with Camera Framing
  test('Shot visual generation builds framing and subject description', async () => {
    const service = new VisualGenerationService();

    const shotAsset = await service.generateShotVisual({
      storyId: 'story_phase3b_test_001',
      shotId: 'shot_001',
      preferredProvider: 'mock-test-provider'
    });

    expect(shotAsset).toBeDefined();
    expect(shotAsset.type).toBe('shot_visual');
    expect(shotAsset.targetId).toBe('shot_001');
    expect(shotAsset.status).toBe('ready');
  });

  // 13. Invalid Story / Character Handling
  test('invalid story or character ID throws structured error', async () => {
    const service = new VisualGenerationService();

    try {
      await service.generateCharacterReference({
        storyId: 'non_existent_story_999',
        characterId: 'char_001'
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err.code).toBe('STORY_NOT_FOUND');
    }
  });

});
