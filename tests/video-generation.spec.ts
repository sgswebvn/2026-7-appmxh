import { test, expect } from '@playwright/test';
const ShotPromptEngine = require('../services/shotPromptEngine');
const SpeakerAwareShotPlanner = require('../services/speakerAwareShotPlanner');
const SubtitleGenerator = require('../services/subtitleGenerator');
const KenBurnsMotionProvider = require('../services/motionProviders/kenBurnsMotionProvider');
const MockLipSyncProvider = require('../services/lipSyncProviders/mockLipSyncProvider');
const ReplicateLipSyncProvider = require('../services/lipSyncProviders/replicateLipSyncProvider');
const { LipSyncProviderRegistry } = require('../services/lipSyncProviders/lipSyncProviderRegistry');
const { MotionProviderRegistry } = require('../services/motionProviders/motionProviderRegistry');
const RealVideoQA = require('../services/realVideoQA');
const { VideoTimelineComposer } = require('../services/videoTimelineComposer');
const { VideoAssetStore } = require('../services/videoAssetStore');
const { storyPlanStore } = require('../services/storyPlanStore');
const { mediaCapability } = require('../services/mediaCapability');
const fs = require('fs');
const path = require('path');

test.describe('Real Character Motion, Lip-Sync & Video Assembly Engine (Phase 3D.1)', () => {

  const testStoryPlan = {
    storyId: 'story_phase3d_test_001',
    topic: 'Một ông già 70 tuổi ăn mì cay cùng cô cháu gái 8 tuổi',
    title: 'Thử Thách Mì Cay Ông Cháu',
    genre: 'Family Comedy',
    style: 'cinematic vertical 9:16 realism',
    characters: [
      {
        id: 'char_ong_nam',
        name: 'Ông Năm',
        age: 70,
        gender: 'male',
        role: 'Grandfather',
        appearance: { face: 'weathered joyful Vietnamese elder', clothing: 'traditional linen shirt' },
        avatarUrl: '/uploads/visual-assets/sample_ong_nam.png',
        voice: { voiceId: 'vi-male' }
      },
      {
        id: 'char_be_an',
        name: 'Bé An',
        age: 8,
        gender: 'female',
        role: 'Granddaughter',
        appearance: { face: 'cute 8yo girl with ponytail', clothing: 'bright yellow dress' },
        avatarUrl: '/uploads/visual-assets/sample_ong_nam.png',
        voice: { voiceId: 'vi-female' }
      }
    ],
    characterReferences: [
      {
        referenceId: 'ref_char_ong_nam',
        characterId: 'char_ong_nam',
        imageUrl: '/uploads/visual-assets/sample_ong_nam.png',
        imagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'sample_ong_nam.png')
      },
      {
        referenceId: 'ref_char_be_an',
        characterId: 'char_be_an',
        imageUrl: '/uploads/visual-assets/sample_ong_nam.png',
        imagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'sample_ong_nam.png')
      }
    ],
    scenes: [
      {
        id: 'scene_001',
        location: 'Quán mì cay Hàn Quốc',
        time: 'Chiều tối',
        environment: 'Khói bốc nghi ngút từ hai tô mì cay cấp 7',
        characters: ['char_ong_nam', 'char_be_an']
      }
    ],
    dialogues: [
      {
        id: 'dlg_001',
        speakerId: 'char_ong_nam',
        sceneId: 'scene_001',
        text: 'Nước dùng cay thế này ông ăn cái vèo là hết!',
        emotion: 'Hào sảng',
        voiceId: 'vi-male'
      },
      {
        id: 'dlg_002',
        speakerId: 'char_be_an',
        sceneId: 'scene_001',
        text: 'Ông cẩn thận kẻo bỏng lưỡi nha ông!',
        emotion: 'Lém lỉnh',
        voiceId: 'vi-female'
      }
    ],
    audioTimeline: [
      {
        dialogueId: 'dlg_001',
        speakerId: 'char_ong_nam',
        speakerName: 'Ông Năm',
        voiceId: 'vi-male',
        text: 'Nước dùng cay thế này ông ăn cái vèo là hết!',
        startMs: 0,
        endMs: 1680,
        durationMs: 1680,
        durationSec: 1.68,
        audioUrl: '/uploads/audio-assets/sample_audio_test.mp3',
        filePath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'sample_audio_test.mp3')
      },
      {
        dialogueId: 'dlg_002',
        speakerId: 'char_be_an',
        speakerName: 'Bé An',
        voiceId: 'vi-female',
        text: 'Ông cẩn thận kẻo bỏng lưỡi nha ông!',
        startMs: 2080,
        endMs: 3568,
        durationMs: 1488,
        durationSec: 1.49,
        audioUrl: '/uploads/audio-assets/sample_audio_test.mp3',
        filePath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'sample_audio_test.mp3')
      }
    ],
    masterAudio: {
      audioUrl: '/uploads/audio-assets/sample_audio_test.mp3',
      filePath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'sample_audio_test.mp3'),
      durationMs: 3568,
      durationSec: 3.57
    }
  };

  test.beforeAll(() => {
    const vDir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
    const aDir = path.join(process.cwd(), 'public', 'uploads', 'audio-assets');
    fs.mkdirSync(vDir, { recursive: true });
    fs.mkdirSync(aDir, { recursive: true });

    // Seed dummy visual asset
    const imgPath = path.join(vDir, 'sample_ong_nam.png');
    if (!fs.existsSync(imgPath)) {
      const minPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(imgPath, minPng);
    }

    // Seed valid audio asset
    const audioPath = path.join(aDir, 'sample_audio_test.mp3');
    if (!fs.existsSync(audioPath)) {
      const safeAudio = audioPath.replace(/\\/g, '/');
      mediaCapability.execFfmpeg(`-y -f lavfi -i sine=frequency=440:duration=3.5 -c:a libmp3lame -b:a 128k "${safeAudio}"`);
    }

    storyPlanStore.save(testStoryPlan);
  });

  // 1. ShotPromptEngine builds tailored prompts
  test('ShotPromptEngine generates individualized shot prompt and camera instructions', () => {
    const promptData = ShotPromptEngine.buildShotPrompt({
      shot: { shotType: 'Close-Up 85mm', cameraMotion: 'push_in' },
      scene: testStoryPlan.scenes[0],
      activeSpeaker: testStoryPlan.characters[0],
      listeners: [testStoryPlan.characters[1]],
      dialogue: testStoryPlan.dialogues[0]
    });

    expect(promptData.prompt).toContain('Ông Năm');
    expect(promptData.prompt).toContain('Bé An');
    expect(promptData.prompt).toContain('Quán mì cay');
    expect(promptData.cameraInstruction).toContain('Close-Up 85mm');
    expect(promptData.cameraInstruction).toContain('push_in');
  });

  // 2. SpeakerAwareShotPlanner plans multi-shot coverage
  test('SpeakerAwareShotPlanner plans establishing shot, speaker close-up, and listener turns', () => {
    const shots = SpeakerAwareShotPlanner.planShots(testStoryPlan);

    expect(shots.length).toBe(3); // 1 Establishing + 2 Dialogue shots
    const [estShot, shot1, shot2] = shots;

    expect(estShot.shotType).toContain('Wide Two-Shot');
    expect(estShot.isLipSyncRequired).toBe(false);

    expect(shot1.activeSpeakerId).toBe('char_ong_nam');
    expect(shot1.dialogueId).toBe('dlg_001');
    expect(shot1.isLipSyncRequired).toBe(true);

    expect(shot2.activeSpeakerId).toBe('char_be_an');
    expect(shot2.dialogueId).toBe('dlg_002');
    expect(shot2.isLipSyncRequired).toBe(true);
  });

  // 3. SubtitleGenerator generates exact SRT & ASS formatting
  test('SubtitleGenerator generates formatted SRT and ASS subtitles matching timeline', () => {
    const subs = SubtitleGenerator.generateSubtitles(testStoryPlan.audioTimeline);

    expect(subs.srt).toContain('Ông Năm: Nước dùng cay thế này');
    expect(subs.srt).toContain('Bé An: Ông cẩn thận');
    expect(subs.ass).toContain('PlayResX: 1080');
    expect(subs.ass).toContain('PlayResY: 1920');
    expect(subs.ass).toContain('SpeakerMale');
    expect(subs.ass).toContain('SpeakerFemale');
    expect(subs.events.length).toBe(2);
  });

  // 4. KenBurnsMotionProvider generates real 1080x1920 H.264 video
  test('KenBurnsMotionProvider synthesizes real 60fps camera motion MP4', async () => {
    const ken = new KenBurnsMotionProvider();
    const imgPath = path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'sample_ong_nam.png');

    const result = await ken.generateMotion({
      imagePath: imgPath,
      cameraMotion: 'push_in',
      durationMs: 1500
    });

    expect(result.success).toBe(true);
    expect(result.videoBuffer.length).toBeGreaterThan(5000);
    expect(fs.existsSync(result.videoPath)).toBe(true);
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.codec).toBe('h264');
  });

  // 5. KenBurnsMotionProvider returns FFMPEG_NOT_AVAILABLE when FFmpeg is absent
  test('KenBurnsMotionProvider returns FFMPEG_NOT_AVAILABLE when FFmpeg is unavailable', async () => {
    const fakeMediaCap = {
      checkMediaCapabilities: async () => ({ ffmpegAvailable: false, ffprobeAvailable: false })
    };
    const ken = new KenBurnsMotionProvider({ mediaCapability: fakeMediaCap });
    const imgPath = path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'sample_ong_nam.png');

    const result = await ken.generateMotion({
      imagePath: imgPath,
      cameraMotion: 'push_in',
      durationMs: 1500
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('FFMPEG_NOT_AVAILABLE');
  });

  // 6. LipSync Provider Registry fallback
  test('LipSyncProviderRegistry routes to working provider and flags fallback', async () => {
    const registry = new LipSyncProviderRegistry();
    const failingMock = new MockLipSyncProvider({ shouldFail: true, failReason: 'NETWORK_TIMEOUT' });
    failingMock.id = 'primary-failing-lipsync';
    registry.register(failingMock);

    const workingMock = new MockLipSyncProvider();
    workingMock.id = 'secondary-working-lipsync';
    registry.register(workingMock);

    process.env.LIPSYNC_PROVIDER = 'primary-failing-lipsync';
    process.env.LIPSYNC_PROVIDER_FALLBACKS = 'secondary-working-lipsync';
    process.env.ALLOW_MOCK_LIPSYNC = 'true';

    const result = await registry.generateWithFallback({
      faceImagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'sample_ong_nam.png'),
      audioPath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'sample_audio_test.mp3'),
      durationMs: 1500,
      preferredProvider: 'primary-failing-lipsync'
    });

    expect(result.success).toBe(true);
    expect(result.requestedProvider).toBe('primary-failing-lipsync');
    expect(result.actualProvider).toBe('secondary-working-lipsync');
    expect(result.fallbackUsed).toBe(true);
  });

  // 7. Unconfigured ReplicateLipSyncProvider returns explicit error without silent mock
  test('ReplicateLipSyncProvider without token returns explicit LIPSYNC_PROVIDER_NOT_CONFIGURED error', async () => {
    const provider = new ReplicateLipSyncProvider({ apiToken: '' });
    const result = await provider.generateLipSync({
      faceImagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'sample_ong_nam.png'),
      audioPath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'sample_audio_test.mp3')
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('LIPSYNC_PROVIDER_NOT_CONFIGURED');
  });

  // 8. RealVideoQA evaluates real MP4 stream and approves valid file
  test('RealVideoQA deeply evaluates MP4 stream, resolution, and A/V sync score', async () => {
    const ken = new KenBurnsMotionProvider();
    const res = await ken.generateMotion({
      imagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'sample_ong_nam.png'),
      cameraMotion: 'pull_out',
      durationMs: 2000
    });

    const qa = await RealVideoQA.evaluateVideoArtifact({
      videoPath: res.videoPath,
      audioDurationMs: 0,
      shots: [{ shotId: 'shot_001' }]
    });

    expect(qa.approved).toBe(true);
    expect(qa.videoArtifactScore).toBeGreaterThanOrEqual(80);
    expect(qa.metrics.aspectRatio).toBe('9:16');
    expect(qa.metrics.resolution).toBe('1080x1920');
    expect(qa.metrics.videoCodec).toBe('h264');
  });

  // 9. RealVideoQA rejects dummy / fake container buffer
  test('RealVideoQA rejects dummy/fake container buffer (< 1000 bytes or corrupt payload)', async () => {
    const dummyPath = path.join(process.cwd(), 'public', 'uploads', 'video-assets', 'fake_dummy_test.mp4');
    fs.writeFileSync(dummyPath, Buffer.from('ftypisom' + 'fake'.repeat(10)));

    const qa = await RealVideoQA.evaluateVideoArtifact({
      videoPath: dummyPath,
      audioDurationMs: 2000
    });

    expect(qa.approved).toBe(false);
    expect(qa.videoArtifactScore).toBe(0);
    expect(qa.errors.length).toBeGreaterThan(0);

    if (fs.existsSync(dummyPath)) fs.unlinkSync(dummyPath);
  });

  // 10. Full Video Assembly & Master MP4 Composition with Traceable Metadata
  test('VideoTimelineComposer renders all shots and composes master 9:16 MP4 with traceable metadata', async () => {
    const customDataFile = path.join(process.cwd(), 'data', 'test-video-assets.json');
    const assetStore = new VideoAssetStore(customDataFile);
    const composer = new VideoTimelineComposer(
      new LipSyncProviderRegistry(),
      new MotionProviderRegistry(),
      assetStore
    );

    const result = await composer.composeStoryVideo({
      storyId: 'story_phase3d_test_001',
      preferredLipSyncProvider: 'mock-test-lipsync-provider',
      preferredMotionProvider: 'ken-burns-motion',
      forceRegenerate: true
    });

    expect(result.success).toBe(true);
    expect(result.shotCount).toBe(3);
    expect(result.shots.length).toBe(3);
    expect(result.masterVideo).toBeDefined();
    expect(result.masterVideo.videoUrl).toContain('/uploads/video-assets/story_final_');
    expect(fs.existsSync(result.masterVideo.filePath)).toBe(true);

    // Verify traceable shot metadata
    for (const shot of result.shots) {
      expect(shot.traceableMetadata).toBeDefined();
      expect(shot.traceableMetadata.storyId).toBe('story_phase3d_test_001');
      expect(shot.traceableMetadata.shotId).toBe(shot.shotId);
      expect(shot.traceableMetadata.outputVideoAssetId).toBeDefined();
    }

    expect(result.videoQA.approved).toBe(true);

    if (fs.existsSync(customDataFile)) fs.unlinkSync(customDataFile);
  });

});
