const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const factoryService = require('../services/videoDirectorFactory');
const storyPlanService = require('../services/storyPlanService');

// ==================== STORYPLAN CANONICAL ENDPOINTS (PHASE 3A) ====================

// 1. Sinh StoryPlan qua LLM
router.post('/story-plan/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, style, durationTarget, apiKey } = req.body;
    const effectiveKey = apiKey || req.user?.geminiApiKey || process.env.GEMINI_API_KEY;

    const plan = await storyPlanService.generateStoryPlan({
      topic,
      style: style || 'conversational cinematic vertical short',
      durationTarget: parseInt(durationTarget) || 30,
      apiKey: effectiveKey
    });

    res.json({
      success: true,
      data: plan
    });
  } catch (err) {
    const statusCode = err.code === 'INVALID_TOPIC' ? 400 : (err.code === 'GENERATION_UNAVAILABLE' ? 503 : 500);
    res.status(statusCode).json({
      success: false,
      code: err.code || 'GENERATION_FAILED',
      message: err.message,
      validation: err.validation || null
    });
  }
});

// 2. Lấy danh sách StoryPlans
router.get('/story-plan/list', authenticateToken, (req, res) => {
  try {
    const plans = storyPlanService.getAllStories();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Lấy chi tiết 1 StoryPlan
router.get('/story-plan/:storyId', authenticateToken, (req, res) => {
  try {
    const plan = storyPlanService.getStory(req.params.storyId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'StoryPlan không tồn tại.' });
    }
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Cập nhật Character trong StoryPlan
router.put('/story-plan/:storyId/character/:charId', authenticateToken, (req, res) => {
  try {
    const { storyId, charId } = req.params;
    const patch = req.body;
    const updated = storyPlanService.updateCharacter(storyId, charId, patch);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'StoryPlan hoặc Character không tồn tại.' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Thêm Character mới vào StoryPlan
router.post('/story-plan/:storyId/character', authenticateToken, (req, res) => {
  try {
    const { storyId } = req.params;
    const character = req.body;
    const updated = storyPlanService.createCharacter(storyId, character);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'StoryPlan không tồn tại.' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Thêm Relationship vào StoryPlan
router.post('/story-plan/:storyId/relationship', authenticateToken, (req, res) => {
  try {
    const { storyId } = req.params;
    const relationship = req.body;
    const updated = storyPlanService.createRelationship(storyId, relationship);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'StoryPlan không tồn tại.' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Xác thực tính toàn vẹn của StoryPlan
router.post('/story-plan/validate', authenticateToken, (req, res) => {
  try {
    const validation = storyPlanService.validate(req.body);
    res.json({
      success: true,
      valid: validation.valid,
      issues: validation.issues
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== EXISTING FACTORY ENDPOINTS ====================

// Tạo và Khởi chạy Dự Án Autonomous Video Factory
router.post('/project/create', authenticateToken, async (req, res) => {
  try {
    const { topic, mode, qualityThreshold, maxAttempts } = req.body;
    const project = await factoryService.createAndRunAutonomousProject(
      topic || 'Chủ đề video',
      mode || 'CONVERSATION',
      parseInt(qualityThreshold) || 85,
      parseInt(maxAttempts) || 6
    );

    res.json({
      success: true,
      data: project
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khởi chạy Factory Project: ' + err.message });
  }
});

// Sửa lỗi từng phân đoạn (Partial Regeneration)
router.post('/project/partial-fix', authenticateToken, async (req, res) => {
  try {
    const { projectId, targetType, targetId, instructions } = req.body;
    const result = await factoryService.partialRegenerateComponent(projectId, {
      targetType: targetType || 'SHOT',
      targetId: targetId || '1',
      instructions: instructions || ''
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi sửa phân đoạn: ' + err.message });
  }
});

// Lấy thông tin chi tiết dự án và danh sách phiên bản
router.get('/project/:id', authenticateToken, (req, res) => {
  try {
    const project = factoryService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dự án' });
    }
    res.json({
      success: true,
      data: project
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải dự án: ' + err.message });
  }
});

// ============================================================================
// PHASE 3B: VISUAL GENERATION & CHARACTER CONSISTENCY ROUTES
// ============================================================================
const { visualGenerationService } = require('../services/visualGenerationService');
const { imageProviderRegistry } = require('../services/imageProviders/imageProviderRegistry');
const { visualAssetStore } = require('../services/visualAssetStore');

// 1. Danh sách Image Providers & Capabilities
router.get('/image-providers', authenticateToken, async (req, res) => {
  try {
    const list = await imageProviderRegistry.list();
    const defaultProvider = imageProviderRegistry.getDefault();
    res.json({
      success: true,
      data: {
        defaultProviderId: defaultProvider.id,
        providers: list
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách provider: ' + err.message });
  }
});

// 2. Sinh ảnh nhận diện nhân vật (Character Reference Portrait)
router.post('/story-plan/:storyId/character/:charId/reference/generate', authenticateToken, async (req, res) => {
  try {
    const { storyId, charId } = req.params;
    const { preferredProvider, forceRegenerate } = req.body || {};

    const result = await visualGenerationService.generateCharacterReference({
      storyId,
      characterId: charId,
      preferredProvider,
      forceRegenerate: Boolean(forceRegenerate)
    });

    res.json({
      success: true,
      message: result.cached ? 'Lấy ảnh nhận diện từ cache thành công' : 'Đã sinh ảnh nhận diện nhân vật mới',
      data: result.asset,
      cached: result.cached
    });
  } catch (err) {
    res.status(err.code === 'STORY_NOT_FOUND' || err.code === 'CHARACTER_NOT_FOUND' ? 404 : 500).json({
      success: false,
      code: err.code || 'IMAGE_GENERATION_FAILED',
      message: err.message,
      details: err.details || null
    });
  }
});

// 3. Sinh ảnh nhận diện hàng loạt cho toàn bộ diễn viên trong StoryPlan
router.post('/story-plan/:storyId/character-references/generate', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { preferredProvider, forceRegenerate } = req.body || {};

    const summary = await visualGenerationService.generateAllCharacterReferences({
      storyId,
      preferredProvider,
      forceRegenerate: Boolean(forceRegenerate)
    });

    res.json({
      success: true,
      message: `Đã xử lý sinh ảnh cho ${summary.total} nhân vật (Thành công: ${summary.completed}, Thất bại: ${summary.failed})`,
      data: summary
    });
  } catch (err) {
    res.status(err.code === 'STORY_NOT_FOUND' ? 404 : 500).json({
      success: false,
      code: err.code || 'IMAGE_GENERATION_FAILED',
      message: err.message
    });
  }
});

// 4. Sinh ảnh cho phân cảnh (Scene Visual Generation with Consistency)
router.post('/story-plan/:storyId/scene/:sceneId/image/generate', authenticateToken, async (req, res) => {
  try {
    const { storyId, sceneId } = req.params;
    const { preferredProvider } = req.body || {};

    const asset = await visualGenerationService.generateSceneVisual({
      storyId,
      sceneId,
      preferredProvider
    });

    res.json({
      success: true,
      message: 'Đã sinh ảnh phân cảnh thành công',
      data: asset
    });
  } catch (err) {
    res.status(err.code === 'STORY_NOT_FOUND' || err.code === 'SCENE_NOT_FOUND' ? 404 : 500).json({
      success: false,
      code: err.code || 'IMAGE_GENERATION_FAILED',
      message: err.message
    });
  }
});

// 5. Sinh ảnh cho góc quay (Shot Visual Generation with Camera Framing & Consistency)
router.post('/story-plan/:storyId/shot/:shotId/image/generate', authenticateToken, async (req, res) => {
  try {
    const { storyId, shotId } = req.params;
    const { preferredProvider } = req.body || {};

    const asset = await visualGenerationService.generateShotVisual({
      storyId,
      shotId,
      preferredProvider
    });

    res.json({
      success: true,
      message: 'Đã sinh ảnh góc quay thành công',
      data: asset
    });
  } catch (err) {
    res.status(err.code === 'STORY_NOT_FOUND' || err.code === 'SHOT_NOT_FOUND' ? 404 : 500).json({
      success: false,
      code: err.code || 'IMAGE_GENERATION_FAILED',
      message: err.message
    });
  }
});

// 6. Lấy danh sách Visual Assets của StoryPlan
router.get('/story-plan/:storyId/visual-assets', authenticateToken, (req, res) => {
  try {
    const { storyId } = req.params;
    const assets = visualAssetStore.getAssetsByStory(storyId);
    res.json({
      success: true,
      data: assets
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải visual assets: ' + err.message });
  }
});

// ============================================================================
// PHASE 3C: MULTI-SPEAKER VOICE & AUDIO TIMELINE ENGINE ROUTES
// ============================================================================
const { multiSpeakerAudioComposer } = require('../services/multiSpeakerAudioComposer');
const { defaultVoiceRegistry } = require('../services/voiceProviders/voiceProviderRegistry');
const { audioAssetStore } = require('../services/audioAssetStore');

// 1. Danh sách Voice Providers & Voices
router.get('/voice-providers', authenticateToken, async (req, res) => {
  try {
    const list = await defaultVoiceRegistry.list();
    res.json({
      success: true,
      defaultProvider: defaultVoiceRegistry.getDefaultProviderId(),
      data: list
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách voice providers: ' + err.message });
  }
});

// 2. Sinh Audio Multi-Speaker toàn bộ StoryPlan
router.post('/story-plan/:storyId/audio/generate', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { preferredProvider, pauseDurationMs, forceRegenerate } = req.body;

    const result = await multiSpeakerAudioComposer.composeStoryAudio({
      storyId,
      preferredProvider,
      pauseDurationMs: pauseDurationMs ? parseInt(pauseDurationMs) : 350,
      forceRegenerate: forceRegenerate === true
    });

    res.json({
      success: true,
      message: 'Đã sinh Audio và Timeline đa nhân vật thành công',
      data: result
    });
  } catch (err) {
    const statusCode = err.code === 'STORY_NOT_FOUND' ? 404 : (err.code === 'VOICE_GENERATION_UNAVAILABLE' ? 503 : 400);
    res.status(statusCode).json({
      success: false,
      code: err.code || 'AUDIO_COMPOSITION_FAILED',
      message: err.message
    });
  }
});

// 3. Lấy thông tin Audio Timeline và Master Track
router.get('/story-plan/:storyId/audio', authenticateToken, (req, res) => {
  try {
    const { storyId } = req.params;
    const { storyPlanStore } = require('../services/storyPlanStore');
    const plan = storyPlanStore.get(storyId);

    if (!plan) {
      return res.status(404).json({ success: false, code: 'STORY_NOT_FOUND', message: 'Không tìm thấy StoryPlan' });
    }

    const assets = audioAssetStore.getStoryAudioAssets(storyId);
    res.json({
      success: true,
      data: {
        storyId,
        audioTimeline: plan.audioTimeline || [],
        masterAudio: plan.masterAudio || null,
        assets
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải audio timeline: ' + err.message });
  }
});

// 4. Preview giọng thoại đơn lẻ
router.post('/story-plan/:storyId/audio/preview', authenticateToken, async (req, res) => {
  try {
    const { text, voiceId, gender, age, emotion } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Thiếu nội dung text để preview' });
    }

    const result = await defaultVoiceRegistry.synthesizeWithFallback({
      text,
      voiceId: voiceId || 'vi-male',
      gender,
      age,
      emotion
    });

    if (!result.success || !result.audioBuffer) {
      return res.status(500).json({
        success: false,
        code: result.error?.code || 'PREVIEW_FAILED',
        message: result.error?.message || 'Không thể tạo preview giọng đọc'
      });
    }

    res.set('Content-Type', 'audio/mpeg');
    res.send(result.audioBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi preview audio: ' + err.message });
  }
});

// 5. Sinh lại âm thanh cho 1 câu thoại cụ thể
router.post('/story-plan/:storyId/dialogue/:dialogueId/audio/regenerate', authenticateToken, async (req, res) => {
  try {
    const { storyId, dialogueId } = req.params;
    const { preferredProvider } = req.body;

    const result = await multiSpeakerAudioComposer.regenerateSingleDialogue(storyId, dialogueId, { preferredProvider });
    res.json({
      success: true,
      message: 'Đã sinh lại giọng thoại và cập nhật Master Track thành công',
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      code: err.code || 'REGENERATE_FAILED',
      message: err.message
    });
  }
});

// ============================================================================
// PHASE 3D: REAL CHARACTER MOTION + LIP-SYNC + VIDEO ASSEMBLY ENGINE ROUTES
// ============================================================================
const { videoTimelineComposer } = require('../services/videoTimelineComposer');
const { lipSyncProviderRegistry } = require('../services/lipSyncProviders/lipSyncProviderRegistry');
const { motionProviderRegistry } = require('../services/motionProviders/motionProviderRegistry');
const { videoAssetStore } = require('../services/videoAssetStore');
const RealVideoQA = require('../services/realVideoQA');

// 1. Danh sách Video Providers (LipSync & Motion)
router.get('/video-providers', authenticateToken, async (req, res) => {
  try {
    const lipsyncList = await lipSyncProviderRegistry.list();
    const motionList = await motionProviderRegistry.list();
    res.json({
      success: true,
      data: {
        lipSyncProviders: lipsyncList,
        motionProviders: motionList,
        defaultLipSync: lipSyncProviderRegistry.getDefaultProviderId(),
        defaultMotion: motionProviderRegistry.getDefaultProviderId()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải video providers: ' + err.message });
  }
});

// 2. Sinh Video Assembly hoàn chỉnh cho StoryPlan
router.post('/story-plan/:storyId/video/generate', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { preferredLipSyncProvider, preferredMotionProvider, forceRegenerate, enableSubtitles } = req.body || {};

    const result = await videoTimelineComposer.composeStoryVideo({
      storyId,
      preferredLipSyncProvider,
      preferredMotionProvider,
      forceRegenerate: Boolean(forceRegenerate),
      enableSubtitles: enableSubtitles !== false
    });

    res.json({
      success: true,
      message: 'Đã hoàn tất Render & Assembly Video 9:16 thành công',
      data: result
    });
  } catch (err) {
    res.status(err.code === 'STORY_NOT_FOUND' ? 404 : 500).json({
      success: false,
      code: err.code || 'VIDEO_ASSEMBLY_FAILED',
      message: err.message
    });
  }
});

// 3. Lấy thông tin Video và Shots của StoryPlan
router.get('/story-plan/:storyId/video', authenticateToken, (req, res) => {
  try {
    const { storyId } = req.params;
    const { storyPlanStore } = require('../services/storyPlanStore');
    const plan = storyPlanStore.get(storyId);

    if (!plan) {
      return res.status(404).json({ success: false, code: 'STORY_NOT_FOUND', message: 'Không tìm thấy StoryPlan' });
    }

    const assets = videoAssetStore.getStoryVideoAssets(storyId);
    res.json({
      success: true,
      data: {
        storyId,
        videoShots: plan.videoShots || [],
        masterVideo: plan.masterVideo || null,
        subtitles: plan.subtitles || null,
        videoQA: plan.videoQA || null,
        assets
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải thông tin video: ' + err.message });
  }
});

// 4. Lấy báo cáo kiểm định Real Video QA
router.get('/story-plan/:storyId/video/qa', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { storyPlanStore } = require('../services/storyPlanStore');
    const plan = storyPlanStore.get(storyId);

    if (!plan || !plan.masterVideo?.filePath) {
      return res.status(404).json({ success: false, code: 'NO_VIDEO_TO_QA', message: 'Chưa có file Master Video để thẩm định QA' });
    }

    const qaResult = await RealVideoQA.evaluateVideoArtifact({
      videoPath: plan.masterVideo.filePath,
      audioDurationMs: plan.masterAudio?.durationMs || 0,
      shots: plan.videoShots || []
    });

    res.json({
      success: true,
      data: qaResult
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi thẩm định Video QA: ' + err.message });
  }
});

module.exports = router;



