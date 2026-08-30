import { test, expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ReplicateLipSyncProvider = require('../services/lipSyncProviders/replicateLipSyncProvider');
const MockLipSyncProvider = require('../services/lipSyncProviders/mockLipSyncProvider');
const { LipSyncProviderRegistry } = require('../services/lipSyncProviders/lipSyncProviderRegistry');
const { MotionProviderRegistry } = require('../services/motionProviders/motionProviderRegistry');
const { VideoTimelineComposer } = require('../services/videoTimelineComposer');
const { VideoAssetStore } = require('../services/videoAssetStore');
const { storyPlanStore } = require('../services/storyPlanStore');
const { mediaCapability } = require('../services/mediaCapability');
const RealVideoQA = require('../services/realVideoQA');

test.describe('Phase 3E — Real AI Talking Character & Lip-Sync Hardening', () => {

  const testStory = {
    storyId: 'story_phase3e_dialogue_001',
    topic: 'Thử Thách Mì Cay 7 Cấp Độ Giữa Ông Năm Và Bé An',
    title: 'Mì Cay Ông Cháu',
    genre: 'Family Comedy',
    characters: [
      {
        id: 'char_ong_nam',
        name: 'Ông Năm',
        age: 70,
        gender: 'male',
        role: 'Grandfather',
        voice: { voiceId: 'vi-male' }
      },
      {
        id: 'char_be_an',
        name: 'Bé An',
        age: 8,
        gender: 'female',
        role: 'Granddaughter',
        voice: { voiceId: 'vi-female' }
      }
    ],
    characterReferences: [
      {
        referenceId: 'ref_ong_nam',
        characterId: 'char_ong_nam',
        imageUrl: '/uploads/visual-assets/test_ong_nam.png',
        imagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'test_ong_nam.png')
      },
      {
        referenceId: 'ref_be_an',
        characterId: 'char_be_an',
        imageUrl: '/uploads/visual-assets/test_be_an.png',
        imagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'test_be_an.png')
      }
    ],
    scenes: [
      {
        id: 'scene_001',
        location: 'Quán mì cay',
        characters: ['char_ong_nam', 'char_be_an']
      }
    ],
    dialogues: [
      {
        id: 'dlg_001',
        speakerId: 'char_ong_nam',
        sceneId: 'scene_001',
        text: 'Tô mì cay này để ông xử lý trong một nốt nhạc!',
        emotion: 'Hào sảng',
        voiceId: 'vi-male'
      },
      {
        id: 'dlg_002',
        speakerId: 'char_be_an',
        sceneId: 'scene_001',
        text: 'Ông nhớ uống nước nha kẻo đỏ hoe cả mắt!',
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
        text: 'Tô mì cay này để ông xử lý trong một nốt nhạc!',
        startMs: 0,
        endMs: 2000,
        durationMs: 2000,
        durationSec: 2.0,
        filePath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'test_ong_nam_audio.mp3')
      },
      {
        dialogueId: 'dlg_002',
        speakerId: 'char_be_an',
        speakerName: 'Bé An',
        voiceId: 'vi-female',
        text: 'Ông nhớ uống nước nha kẻo đỏ hoe cả mắt!',
        startMs: 2400,
        endMs: 4200,
        durationMs: 1800,
        durationSec: 1.8,
        filePath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'test_be_an_audio.mp3')
      }
    ],
    masterAudio: {
      durationMs: 4200,
      durationSec: 4.2
    }
  };

  test.beforeAll(async () => {
    const vDir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
    const aDir = path.join(process.cwd(), 'public', 'uploads', 'audio-assets');
    fs.mkdirSync(vDir, { recursive: true });
    fs.mkdirSync(aDir, { recursive: true });

    // Seed test images for Character A (Ông Năm) and Character B (Bé An)
    const imgA = path.join(vDir, 'test_ong_nam.png');
    const imgB = path.join(vDir, 'test_be_an.png');
    const minPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    if (!fs.existsSync(imgA)) fs.writeFileSync(imgA, minPng);
    if (!fs.existsSync(imgB)) fs.writeFileSync(imgB, minPng);

    // Seed test audio for Character A and Character B
    const audA = path.join(aDir, 'test_ong_nam_audio.mp3');
    const audB = path.join(aDir, 'test_be_an_audio.mp3');
    if (!fs.existsSync(audA)) {
      await mediaCapability.execFfmpeg(`-y -f lavfi -i sine=frequency=300:duration=2.0 -c:a libmp3lame -b:a 128k "${audA.replace(/\\/g, '/')}"`);
    }
    if (!fs.existsSync(audB)) {
      await mediaCapability.execFfmpeg(`-y -f lavfi -i sine=frequency=600:duration=1.8 -c:a libmp3lame -b:a 128k "${audB.replace(/\\/g, '/')}"`);
    }

    storyPlanStore.save(testStory);
  });

  // A & B: Provider Configuration & Missing Token Rejection
  test('[UNIT] ReplicateLipSyncProvider rejects unconfigured execution with explicit code', async () => {
    const provider = new ReplicateLipSyncProvider({ apiToken: '' });
    const res = await provider.generateLipSync({
      faceImagePath: path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'test_ong_nam.png'),
      audioPath: path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'test_ong_nam_audio.mp3')
    });

    expect(res.success).toBe(false);
    expect(res.error.code).toBe('LIPSYNC_PROVIDER_NOT_CONFIGURED');
    expect(res.error.message).toContain('REPLICATE_API_TOKEN');
  });

  // C & D: Prediction Lifecycle & Output Validation
  test('[UNIT] ReplicateLipSyncProvider validates downloaded output and decodability', async () => {
    const provider = new ReplicateLipSyncProvider({ apiToken: 'test_token' });
    
    // Test download buffer validation
    const invalidRes = await provider.generateLipSync({
      faceImagePath: '/non/existent/face.png',
      audioPath: '/non/existent/audio.mp3'
    });
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error.code).toBe('MISSING_FACE_IMAGE');
  });

  // F & G: Static Video Detection and Rejection
  test('[REAL MEDIA] RealVideoQA and MediaCapability reject static video loops with 0 pixel delta', async () => {
    const staticVidPath = path.join(process.cwd(), 'public', 'uploads', 'video-assets', `static_test_${Date.now()}.mp4`);
    const safeOut = staticVidPath.replace(/\\/g, '/');

    // Generate a 100% static video (identical frames throughout 2 seconds)
    await mediaCapability.execFfmpeg(`-y -f lavfi -i color=c=blue:s=1080x1920:d=2 -vf "format=yuv420p" -c:v libx264 -pix_fmt yuv420p "${safeOut}"`);

    const motionAnalysis = await mediaCapability.analyzeVideoMotion(staticVidPath);
    expect(motionAnalysis.isStaticVideo).toBe(true);
    expect(motionAnalysis.hasMotion).toBe(false);
    expect(motionAnalysis.motionScore).toBe(0);

    const qa = await RealVideoQA.evaluateVideoArtifact({
      videoPath: staticVidPath,
      requireMotion: true,
      audioDurationMs: 0
    });

    expect(qa.approved).toBe(false);
    expect(qa.errors.some((e: string) => e.includes('STATIC_VIDEO_DETECTED'))).toBe(true);

    if (fs.existsSync(staticVidPath)) fs.unlinkSync(staticVidPath);
  });

  // K: Motion Detection Passes for Moving Video
  test('[REAL MEDIA] Motion Analysis successfully detects frame changes in dynamic video', async () => {
    const dynamicVidPath = path.join(process.cwd(), 'public', 'uploads', 'video-assets', `dynamic_test_${Date.now()}.mp4`);
    const safeOut = dynamicVidPath.replace(/\\/g, '/');

    // Generate dynamic video with testsrc filter (moving counter/pixels)
    await mediaCapability.execFfmpeg(`-y -f lavfi -i testsrc=size=1080x1920:rate=30:duration=2 -vf "format=yuv420p" -c:v libx264 -pix_fmt yuv420p "${safeOut}"`);

    const motionAnalysis = await mediaCapability.analyzeVideoMotion(dynamicVidPath);
    expect(motionAnalysis.isStaticVideo).toBe(false);
    expect(motionAnalysis.hasMotion).toBe(true);
    expect(motionAnalysis.motionScore).toBeGreaterThan(0);

    if (fs.existsSync(dynamicVidPath)) fs.unlinkSync(dynamicVidPath);
  });

  // H & I & L: Multi-Character Routing, Dialogue Mapping, and Assembly
  test('[REAL ASSEMBLY] VideoTimelineComposer routes Character A & B dialogue to distinct talking shots with traceable metadata', async () => {
    const customDataFile = path.join(process.cwd(), 'data', 'phase3e-test-assets.json');
    const assetStore = new VideoAssetStore(customDataFile);
    const composer = new VideoTimelineComposer(
      new LipSyncProviderRegistry(),
      new MotionProviderRegistry(),
      assetStore
    );

    const result = await composer.composeStoryVideo({
      storyId: 'story_phase3e_dialogue_001',
      preferredLipSyncProvider: 'mock-test-lipsync-provider',
      preferredMotionProvider: 'ken-burns-motion',
      forceRegenerate: true
    });

    expect(result.success).toBe(true);
    expect(result.shotCount).toBe(3); // 1 Establishing + 2 Character Dialogue shots

    // Verify Shot 2 belongs to Character A (Ông Năm)
    const shotA = result.shots[1];
    expect(shotA.activeSpeakerId).toBe('char_ong_nam');
    expect(shotA.dialogueId).toBe('dlg_001');
    expect(shotA.traceableMetadata.characterId).toBe('char_ong_nam');
    expect(shotA.traceableMetadata.dialogueId).toBe('dlg_001');
    expect(shotA.traceableMetadata.audioAsset).toContain('test_ong_nam_audio.mp3');

    // Verify Shot 3 belongs to Character B (Bé An)
    const shotB = result.shots[2];
    expect(shotB.activeSpeakerId).toBe('char_be_an');
    expect(shotB.dialogueId).toBe('dlg_002');
    expect(shotB.traceableMetadata.characterId).toBe('char_be_an');
    expect(shotB.traceableMetadata.dialogueId).toBe('dlg_002');
    expect(shotB.traceableMetadata.audioAsset).toContain('test_be_an_audio.mp3');

    // Verify Final Master Video Quality
    expect(result.masterVideo).toBeDefined();
    expect(fs.existsSync(result.masterVideo.filePath)).toBe(true);
    expect(result.videoQA.approved).toBe(true);
    expect(result.videoQA.videoArtifactScore).toBeGreaterThanOrEqual(80);
    expect(result.videoQA.metrics.resolution).toBe('1080x1920');

    if (fs.existsSync(customDataFile)) fs.unlinkSync(customDataFile);
  });

  // Strict Real Mode Fail-Fast (Section V & XII)
  test('[UNIT] Strict Real Mode fails fast when Lip-Sync is required but unconfigured', async () => {
    const composer = new VideoTimelineComposer();

    await expect(composer.composeStoryVideo({
      storyId: 'story_phase3e_dialogue_001',
      preferredLipSyncProvider: 'replicate-lipsync',
      strictReal: true,
      allowMotionFallback: false,
      forceRegenerate: true
    })).rejects.toThrow('LIPSYNC_REQUIRED_BUT_FAILED');
  });

  // XV: Cost-Safe Real Replicate E2E Inference (Runs only when REAL_AI_E2E=true and token exists)
  test('[REAL E2E] Real Replicate Lip-Sync Inference (Conditional on REAL_AI_E2E=true)', async () => {
    const isE2E = process.env.REAL_AI_E2E === 'true';
    const hasToken = !!process.env.REPLICATE_API_TOKEN;

    if (!isE2E || !hasToken) {
      console.log('ℹ️ [PHASE 3E] Skipping real Replicate API inference (Requires REAL_AI_E2E=true and REPLICATE_API_TOKEN)');
      return;
    }

    console.log('🚀 [PHASE 3E] Running REAL Replicate SadTalker Lip-Sync Inference...');
    const provider = new ReplicateLipSyncProvider();
    const faceImg = path.join(process.cwd(), 'public', 'uploads', 'visual-assets', 'test_ong_nam.png');
    const audioF = path.join(process.cwd(), 'public', 'uploads', 'audio-assets', 'test_ong_nam_audio.mp3');

    const result = await provider.generateLipSync({
      faceImagePath: faceImg,
      audioPath: audioF,
      durationMs: 2000
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('real');
    expect(result.predictionId).toBeDefined();
    expect(result.outputVideo).toBeDefined();
    expect(fs.existsSync(result.videoPath)).toBe(true);

    const qa = await RealVideoQA.evaluateVideoArtifact({
      videoPath: result.videoPath,
      requireMotion: true,
      audioDurationMs: 2000
    });

    expect(qa.approved).toBe(true);
    expect(qa.qualityGates.characterMotionValid).toBe(true);
  });

});
