const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SpeakerAwareShotPlanner = require('./speakerAwareShotPlanner');
const SubtitleGenerator = require('./subtitleGenerator');
const RealVideoQA = require('./realVideoQA');
const { lipSyncProviderRegistry } = require('./lipSyncProviders/lipSyncProviderRegistry');
const { motionProviderRegistry } = require('./motionProviders/motionProviderRegistry');
const { videoAssetStore, VIDEO_ASSETS_DIR } = require('./videoAssetStore');
const { visualAssetStore } = require('./visualAssetStore');
const { audioAssetStore } = require('./audioAssetStore');
const { storyPlanStore } = require('./storyPlanStore');
const { mediaCapability } = require('./mediaCapability');

/**
 * VideoTimelineComposer (Phase 3D.1)
 * Main video assembly engine that renders individual shots and composes the final vertical 9:16 master MP4.
 */
class VideoTimelineComposer {
  constructor(
    lipSyncRegistry = lipSyncProviderRegistry,
    motionRegistry = motionProviderRegistry,
    assetStore = videoAssetStore,
    mediaCap = mediaCapability
  ) {
    this.lipSyncRegistry = lipSyncRegistry;
    this.motionRegistry = motionRegistry;
    this.assetStore = assetStore;
    this.mediaCapability = mediaCap;
  }

  async checkFFmpeg() {
    const caps = await this.mediaCapability.checkMediaCapabilities();
    return caps.ffmpegAvailable;
  }

  /**
   * Compose complete Story Video
   */
  async composeStoryVideo(options = {}) {
    const {
      storyId,
      preferredLipSyncProvider,
      preferredMotionProvider,
      forceRegenerate = false,
      enableSubtitles = true
    } = options;

    const storyPlan = storyPlanStore.get(storyId);
    if (!storyPlan) {
      const err = new Error(`Không tìm thấy StoryPlan với id: ${storyId}`);
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    // 1. Check real FFmpeg capabilities
    const hasFFmpeg = await this.checkFFmpeg();
    if (!hasFFmpeg) {
      const err = new Error('Hệ thống yêu cầu cài đặt binary FFmpeg để render video thực tế.');
      err.code = 'FFMPEG_NOT_AVAILABLE';
      throw err;
    }

    // 2. Plan cinematic shots
    const plannedShots = SpeakerAwareShotPlanner.planShots(storyPlan);
    if (plannedShots.length === 0) {
      const err = new Error('Không thể lập kế hoạch góc quay cho StoryPlan.');
      err.code = 'NO_SHOTS_PLANNED';
      throw err;
    }

    const renderedShotArtifacts = [];
    const characters = storyPlan.characters || [];
    const characterReferences = storyPlan.characterReferences || [];

    // 3. Render each shot artifact independently
    for (let i = 0; i < plannedShots.length; i++) {
      const shot = plannedShots[i];
      let shotAsset = null;

      if (!forceRegenerate) {
        shotAsset = this.assetStore.getShotVideoAsset(storyId, shot.shotId);
      }

      if (!shotAsset || !fs.existsSync(shotAsset.filePath)) {
        // Resolve source image for this shot
        let visualImagePath = null;
        let sourceImageAssetId = null;

        if (shot.characterReferencePath && fs.existsSync(shot.characterReferencePath)) {
          visualImagePath = shot.characterReferencePath;
        } else if (shot.activeSpeakerId) {
          const speaker = characters.find(c => c.id === shot.activeSpeakerId);
          const ref = characterReferences.find(r => r.characterId === speaker?.id);
          if (ref?.imagePath && fs.existsSync(ref.imagePath)) {
            visualImagePath = ref.imagePath;
            sourceImageAssetId = ref.assetId || null;
          }
        }

        // Fallback to sample image if needed in development
        if (!visualImagePath) {
          const sampleDir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
          fs.mkdirSync(sampleDir, { recursive: true });
          visualImagePath = path.join(sampleDir, 'sample_ong_nam.png');
          if (!fs.existsSync(visualImagePath)) {
            const minPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
            fs.writeFileSync(visualImagePath, minPng);
          }
        }

        let shotResult;
        let isLipSync = false;
        let motionProviderUsed = null;
        let lipSyncProviderUsed = null;

        // Route: Lip-sync for speaking shots vs Motion for wide/reaction shots
        if (shot.isLipSyncRequired && shot.audioPath && fs.existsSync(shot.audioPath)) {
          shotResult = await this.lipSyncRegistry.generateWithFallback({
            faceImagePath: visualImagePath,
            audioPath: shot.audioPath,
            durationMs: shot.durationMs,
            preferredProvider: preferredLipSyncProvider
          });
          if (shotResult && shotResult.success) {
            isLipSync = true;
            lipSyncProviderUsed = shotResult.actualProvider;
          }
        }

        // If LipSync was not requested or returned a graceful fallback/not configured
        if (!shotResult || !shotResult.success) {
          isLipSync = false;
          shotResult = await this.motionRegistry.generateWithFallback({
            imagePath: visualImagePath,
            cameraMotion: shot.cameraMotion,
            durationMs: shot.durationMs,
            preferredProvider: preferredMotionProvider
          });
          motionProviderUsed = shotResult?.actualProvider || 'ken-burns-motion';
        }

        if (!shotResult || !shotResult.success || !shotResult.videoPath) {
          const err = new Error(`Lỗi render góc quay [${shot.shotId}]: ${shotResult?.error?.message || 'Không thể tạo video'}`);
          err.code = shotResult?.error?.code || 'SHOT_RENDER_FAILED';
          throw err;
        }

        const assetId = `video_${shot.shotId}_${crypto.randomBytes(4).toString('hex')}`;
        shotAsset = this.assetStore.saveAsset({
          assetId,
          storyId,
          sceneId: shot.sceneId,
          type: 'shot_video',
          targetId: shot.shotId,
          shotId: shot.shotId,
          shotType: shot.shotType,
          cameraMotion: shot.cameraMotion,
          characterIds: shot.activeSpeakerId ? [shot.activeSpeakerId] : [],
          activeSpeakerId: shot.activeSpeakerId,
          activeSpeakerName: shot.activeSpeakerName,
          dialogueId: shot.dialogueId,
          dialogueIds: shot.dialogueId ? [shot.dialogueId] : [],
          sourceImageAssetId: sourceImageAssetId || null,
          audioAssetIds: shot.audioPath ? [shot.audioPath] : [],
          motionProvider: motionProviderUsed,
          lipSyncProvider: lipSyncProviderUsed,
          outputVideoAssetId: assetId,
          durationMs: shot.durationMs,
          durationSec: shot.durationSec,
          width: 1080,
          height: 1920,
          aspectRatio: '9:16',
          filePath: shotResult.videoPath,
          videoUrl: shotResult.videoUrl,
          provider: shotResult.requestedProvider,
          actualProvider: shotResult.actualProvider,
          isLipSync,
          status: 'ready',
          createdAt: new Date().toISOString()
        });
      }

      shot.videoUrl = shotAsset.videoUrl;
      shot.videoPath = shotAsset.filePath;
      shot.traceableMetadata = {
        storyId,
        sceneId: shot.sceneId,
        shotId: shot.shotId,
        characterIds: shot.activeSpeakerId ? [shot.activeSpeakerId] : [],
        dialogueIds: shot.dialogueId ? [shot.dialogueId] : [],
        sourceImageAssetId: shotAsset.sourceImageAssetId,
        audioAssetIds: shotAsset.audioAssetIds,
        motionProvider: shotAsset.motionProvider,
        lipSyncProvider: shotAsset.lipSyncProvider,
        outputVideoAssetId: shotAsset.assetId
      };

      renderedShotArtifacts.push(shotAsset);
    }

    // 4. Generate Subtitles from Audio Timeline
    const subtitles = SubtitleGenerator.generateSubtitles(storyPlan.audioTimeline || []);

    // 5. Compose Final Master Video via FFmpeg Concat & Muxer
    const totalDurationMs = plannedShots.reduce((sum, s) => sum + s.durationMs, 0);
    const masterFileName = `story_final_${storyId}_${crypto.randomBytes(4).toString('hex')}.mp4`;
    const masterFilePath = path.join(VIDEO_ASSETS_DIR, masterFileName);

    const concatListPath = path.join(VIDEO_ASSETS_DIR, `concat_${storyId}_${Date.now()}.txt`);
    const concatContent = renderedShotArtifacts.map(a => `file '${path.basename(a.filePath)}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    try {
      const safeConcatPath = concatListPath.replace(/\\/g, '/');
      const safeMasterPath = masterFilePath.replace(/\\/g, '/');

      // Build aligned master audio track matching shot sequence
      const audioConcatListPath = path.join(VIDEO_ASSETS_DIR, `audio_concat_${storyId}_${Date.now()}.txt`);
      const audioConcatEntries = [];
      const tempAudioFiles = [];

      for (let sIdx = 0; sIdx < plannedShots.length; sIdx++) {
        const s = plannedShots[sIdx];
        const shotAudioFile = path.join(VIDEO_ASSETS_DIR, `shot_audio_${s.shotId}_${Date.now()}.aac`);
        tempAudioFiles.push(shotAudioFile);
        const safeShotAudioOut = shotAudioFile.replace(/\\/g, '/');
        const shotDurationSec = (s.durationMs / 1000).toFixed(2);

        if (s.audioPath && fs.existsSync(s.audioPath)) {
          const safeAudioIn = s.audioPath.replace(/\\/g, '/');
          await this.mediaCapability.execFfmpeg(`-y -t ${shotDurationSec} -i "${safeAudioIn}" -c:a aac -b:a 192k "${safeShotAudioOut}"`);
        } else {
          // Generate precise silence segment for shots without dialogue (e.g. establishing shot)
          await this.mediaCapability.execFfmpeg(`-y -f lavfi -i anullsrc=r=24000:cl=mono -t ${shotDurationSec} -c:a aac -b:a 192k "${safeShotAudioOut}"`);
        }

        audioConcatEntries.push(`file '${path.basename(shotAudioFile)}'`);
      }

      fs.writeFileSync(audioConcatListPath, audioConcatEntries.join('\n'));
      const safeAudioConcatPath = audioConcatListPath.replace(/\\/g, '/');
      const alignedAudioPath = path.join(VIDEO_ASSETS_DIR, `aligned_audio_${storyId}_${Date.now()}.aac`);
      const safeAlignedAudioPath = alignedAudioPath.replace(/\\/g, '/');

      try {
        await this.mediaCapability.execFfmpeg(`-y -f concat -safe 0 -i "${safeAudioConcatPath}" -c:a copy "${safeAlignedAudioPath}"`);

        // Mux video and aligned audio together
        const cmdArgs = `-y -f concat -safe 0 -i "${safeConcatPath}" -i "${safeAlignedAudioPath}" -c:v copy -c:a aac -shortest -pix_fmt yuv420p "${safeMasterPath}"`;
        await this.mediaCapability.execFfmpeg(cmdArgs);
      } finally {
        if (fs.existsSync(audioConcatListPath)) fs.unlinkSync(audioConcatListPath);
        if (fs.existsSync(alignedAudioPath)) fs.unlinkSync(alignedAudioPath);
        tempAudioFiles.forEach(f => {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        });
      }

      if (!fs.existsSync(masterFilePath) || fs.statSync(masterFilePath).size < 1000) {
        throw new Error('Master video file created by FFmpeg is missing or empty.');
      }
    } finally {
      if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
    }

    const masterAssetId = `video_master_${storyId}_${crypto.randomBytes(4).toString('hex')}`;
    const masterVideoAsset = this.assetStore.saveAsset({
      assetId: masterAssetId,
      storyId,
      type: 'master_video',
      targetId: storyId,
      durationMs: totalDurationMs,
      durationSec: parseFloat((totalDurationMs / 1000).toFixed(2)),
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      filePath: masterFilePath,
      videoUrl: `/uploads/video-assets/${masterFileName}`,
      shotCount: plannedShots.length,
      hasSubtitles: enableSubtitles,
      status: 'ready',
      createdAt: new Date().toISOString()
    });

    // 6. Run Deep Real Video QA
    const qaResult = await RealVideoQA.evaluateVideoArtifact({
      videoPath: masterFilePath,
      audioDurationMs: totalDurationMs,
      shots: plannedShots
    });

    // 7. Synchronize into StoryPlan
    storyPlan.videoShots = plannedShots;
    storyPlan.masterVideo = {
      assetId: masterAssetId,
      videoUrl: masterVideoAsset.videoUrl,
      filePath: masterVideoAsset.filePath,
      durationMs: totalDurationMs,
      durationSec: parseFloat((totalDurationMs / 1000).toFixed(2)),
      width: 1080,
      height: 1920,
      aspectRatio: '9:16'
    };
    storyPlan.subtitles = subtitles;
    storyPlan.videoQA = qaResult;

    storyPlanStore.save(storyPlan);

    return {
      success: true,
      storyId,
      totalDurationMs,
      totalDurationSec: parseFloat((totalDurationMs / 1000).toFixed(2)),
      shotCount: plannedShots.length,
      shots: plannedShots,
      masterVideo: storyPlan.masterVideo,
      subtitles: storyPlan.subtitles,
      videoQA: qaResult
    };
  }
}

const defaultVideoComposer = new VideoTimelineComposer();

module.exports = {
  VideoTimelineComposer,
  videoTimelineComposer: defaultVideoComposer
};
