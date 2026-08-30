import { test, expect } from '@playwright/test';
const { VoiceProviderRegistry } = require('../services/voiceProviders/voiceProviderRegistry');
const EdgeTTSProvider = require('../services/voiceProviders/edgeTtsProvider');
const GoogleTTSProvider = require('../services/voiceProviders/googleTtsProvider');
const MockVoiceProvider = require('../services/voiceProviders/mockVoiceProvider');
const AudioDurationParser = require('../services/audioDurationParser');
const { MultiSpeakerAudioComposer } = require('../services/multiSpeakerAudioComposer');
const { AudioAssetStore } = require('../services/audioAssetStore');
const { storyPlanStore } = require('../services/storyPlanStore');
const path = require('path');
const fs = require('fs');

test.describe('Real Multi-Speaker Voice & Audio Timeline Engine (Phase 3C)', () => {

  // Seed sample multi-speaker StoryPlan
  const testStoryPlan = {
    storyId: 'story_phase3c_test_001',
    topic: 'Một ông già 70 tuổi ăn mì cay cùng cô cháu gái 8 tuổi và người bán quán',
    title: 'Thử Thách Mì Cay 3 Nhân Vật',
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
        voice: { voiceId: 'vi-male', language: 'vi-VN', gender: 'male', tone: 'Hào sảng' }
      },
      {
        id: 'char_be_an',
        name: 'Bé An',
        age: 8,
        gender: 'female',
        role: 'Granddaughter (Child)',
        voice: { voiceId: 'vi-female', language: 'vi-VN', gender: 'female', tone: 'Trong trẻo' }
      },
      {
        id: 'char_chu_quan',
        name: 'Chủ Quán',
        age: 40,
        gender: 'male',
        role: 'Restaurant Owner (Vendor)',
        voice: { voiceId: 'vi-male', language: 'vi-VN', gender: 'male', tone: 'Nhiệt tình' }
      }
    ],
    scenes: [
      {
        id: 'scene_001',
        location: 'Quán mì cay Hàn Quốc',
        time: 'Buổi chiều',
        environment: 'Hai tô mì đất đỏ rực ớt',
        characters: ['char_ong_nam', 'char_be_an', 'char_chu_quan'],
        action: 'Hai ông cháu ngồi vào bàn gọi mì cay cấp độ 7'
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
      },
      {
        id: 'dlg_002',
        speakerId: 'char_be_an',
        sceneId: 'scene_001',
        text: 'Ông cẩn thận kẻo bỏng lưỡi nha ông!',
        emotion: 'Lém lỉnh',
        action: 'Cười tươi nhắc ông',
        voiceId: 'vi-female'
      },
      {
        id: 'dlg_003',
        speakerId: 'char_chu_quan',
        sceneId: 'scene_001',
        text: 'Hai ông cháu ăn từ từ thôi, nước súp cay cấp 7 đấy ạ!',
        emotion: 'Nhiệt tình',
        action: 'Bưng thêm cốc nước đá',
        voiceId: 'vi-male'
      }
    ]
  };

  test.beforeAll(() => {
    storyPlanStore.save(testStoryPlan);
  });

  // 1. AudioDurationParser validation
  test('AudioDurationParser correctly detects valid MPEG-1 Layer 3 frames and computes duration', () => {
    const mock = new MockVoiceProvider();
    const buf = mock.createMpegFrameBuffer(3.0); // 3 seconds
    const parsed = AudioDurationParser.parse(buf);

    expect(parsed.valid).toBe(true);
    expect(parsed.durationMs).toBeGreaterThanOrEqual(2800);
    expect(parsed.durationMs).toBeLessThanOrEqual(3200);
    expect(parsed.durationSec).toBeCloseTo(3.0, 1);
    expect(parsed.bitrate).toBe(128);
    expect(parsed.sampleRate).toBe(44100);
    expect(parsed.frameCount).toBeGreaterThan(100);
  });

  // 2. Voice Provider Registry Registration & Listing
  test('VoiceProviderRegistry registers EdgeTTS, GoogleTTS, and MockVoiceProvider', async () => {
    const registry = new VoiceProviderRegistry();
    const list = await registry.list();

    expect(list.length).toBeGreaterThanOrEqual(3);
    const edge = registry.get('edge-tts');
    expect(edge).toBeDefined();
    expect(edge?.name).toContain('Edge Neural');

    const google = registry.get('google-tts');
    expect(google).toBeDefined();
    expect(google?.name).toContain('Google Natural');
  });

  // 3. Pitch & Rate Modulation for Age Differentiation
  test('EdgeTTSProvider calculates appropriate pitch and rate for 70yo elder vs 8yo child', () => {
    const edge = new EdgeTTSProvider();
    const elder = edge.calculatePitchAndRate({ age: 70 });
    const child = edge.calculatePitchAndRate({ age: 8 });

    expect(elder.pitch).toBe('-6Hz'); // deeper pitch
    expect(child.pitch).toBe('+12Hz'); // higher pitch
  });

  // 4. Multi-Speaker Voice Synthesis & Fallback Execution
  test('VoiceProviderRegistry executes fallback when primary provider is unavailable', async () => {
    const registry = new VoiceProviderRegistry();

    // Register a failing primary
    const failingMock = new MockVoiceProvider({ shouldFail: true, failReason: 'NETWORK_TIMEOUT' });
    failingMock.id = 'primary-failing-tts';
    registry.register(failingMock);

    // Register working secondary
    const workingMock = new MockVoiceProvider();
    workingMock.id = 'secondary-working-tts';
    registry.register(workingMock);

    process.env.VOICE_PROVIDER = 'primary-failing-tts';
    process.env.VOICE_PROVIDER_FALLBACKS = 'secondary-working-tts';
    process.env.ALLOW_MOCK_VOICE = 'true';

    const result = await registry.synthesizeWithFallback({
      text: 'Xin chào các bạn',
      voiceId: 'vi-male',
      preferredProvider: 'primary-failing-tts'
    });

    expect(result.success).toBe(true);
    expect(result.requestedProvider).toBe('primary-failing-tts');
    expect(result.actualProvider).toBe('secondary-working-tts');
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toContain('primary-failing-tts');
  });

  // 5. MultiSpeakerAudioComposer rejects invalid StoryPlans (orphan speakers, missing scene)
  test('MultiSpeakerAudioComposer rejects StoryPlan with invalid or orphan speaker', () => {
    const composer = new MultiSpeakerAudioComposer();
    const invalidPlan = {
      storyId: 'invalid_story_001',
      characters: [{ id: 'char_01', name: 'A', role: 'Role A' }],
      scenes: [{ id: 'scene_01' }],
      dialogues: [{ id: 'dlg_01', speakerId: 'ghost_speaker_999', sceneId: 'scene_01', text: 'Hello' }]
    };

    try {
      composer.validateStoryPlan(invalidPlan);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('SPEAKER_NOT_FOUND');
    }
  });

  // 6. Multi-Speaker Full Composition & Audio Timeline Calculation (3 Speakers)
  test('MultiSpeakerAudioComposer renders 3 speakers with exact timestamps and natural pauses', async () => {
    const customDataFile = path.join(process.cwd(), 'data', 'test-audio-assets.json');
    const assetStore = new AudioAssetStore(customDataFile);
    const registry = new VoiceProviderRegistry();
    const composer = new MultiSpeakerAudioComposer(registry, assetStore);

    const result = await composer.composeStoryAudio({
      storyId: 'story_phase3c_test_001',
      preferredProvider: 'mock-test-voice-provider',
      pauseDurationMs: 400,
      forceRegenerate: true
    });

    expect(result.success).toBe(true);
    expect(result.dialogueCount).toBe(3);
    expect(result.timeline.length).toBe(3);
    expect(result.totalDurationMs).toBeGreaterThan(0);

    // Verify chronological ordering & pauses
    const [dlg1, dlg2, dlg3] = result.timeline;
    expect(dlg1.speakerId).toBe('char_ong_nam');
    expect(dlg1.startMs).toBe(0);
    expect(dlg1.endMs).toBe(dlg1.durationMs);

    expect(dlg2.speakerId).toBe('char_be_an');
    expect(dlg2.startMs).toBe(dlg1.endMs + 400); // 400ms pause
    expect(dlg2.endMs).toBe(dlg2.startMs + dlg2.durationMs);

    expect(dlg3.speakerId).toBe('char_chu_quan');
    expect(dlg3.startMs).toBe(dlg2.endMs + 400); // 400ms pause

    // Verify individual files on disk
    expect(fs.existsSync(dlg1.filePath)).toBe(true);
    expect(fs.existsSync(dlg2.filePath)).toBe(true);
    expect(fs.existsSync(dlg3.filePath)).toBe(true);

    // Verify master track on disk
    expect(result.masterAudio).toBeDefined();
    expect(result.masterAudio.audioUrl).toContain('/uploads/audio-assets/master_');

    // Clean up test file
    if (fs.existsSync(customDataFile)) fs.unlinkSync(customDataFile);
  });

  // 7. Single Dialogue Regeneration & Master Track Update
  test('regenerateSingleDialogue updates specific dialogue and recompiles master audio', async () => {
    const composer = new MultiSpeakerAudioComposer();

    const regenResult = await composer.regenerateSingleDialogue('story_phase3c_test_001', 'dlg_002', {
      preferredProvider: 'mock-test-voice-provider'
    });

    expect(regenResult.success).toBe(true);
    expect(regenResult.dialogueCount).toBe(3);
    expect(regenResult.timeline[1].dialogueId).toBe('dlg_002');
  });

});
