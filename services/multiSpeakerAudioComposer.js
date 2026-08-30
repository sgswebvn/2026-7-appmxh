const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { defaultVoiceRegistry } = require('./voiceProviders/voiceProviderRegistry');
const AudioDurationParser = require('./audioDurationParser');
const { audioAssetStore, AUDIO_ASSETS_DIR } = require('./audioAssetStore');
const { storyPlanStore } = require('./storyPlanStore');

/**
 * MultiSpeakerAudioComposer
 * Orchestrates multi-speaker synthesis, audio timeline calculation, and master track composition.
 */
class MultiSpeakerAudioComposer {
  constructor(voiceRegistry = defaultVoiceRegistry, assetStore = audioAssetStore) {
    this.voiceRegistry = voiceRegistry;
    this.assetStore = assetStore;
  }

  /**
   * Validate StoryPlan dialogues and speaker mapping
   */
  validateStoryPlan(storyPlan) {
    if (!storyPlan || !storyPlan.storyId) {
      const err = new Error('StoryPlan không hợp lệ hoặc thiếu storyId.');
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    const characters = storyPlan.characters || [];
    if (characters.length === 0) {
      const err = new Error('StoryPlan chưa có nhân vật nào được thiết lập.');
      err.code = 'NO_CHARACTERS_FOUND';
      throw err;
    }

    const scenes = storyPlan.scenes || [];
    const dialogues = storyPlan.dialogues || [];
    if (dialogues.length === 0) {
      const err = new Error('StoryPlan chưa có danh sách lời thoại (dialogues) để lồng tiếng.');
      err.code = 'NO_DIALOGUES_FOUND';
      throw err;
    }

    // Verify all dialogues
    for (const [idx, d] of dialogues.entries()) {
      if (!d.speakerId) {
        const err = new Error(`Hội thoại số ${idx + 1} thiếu speakerId.`);
        err.code = 'MISSING_SPEAKER_ID';
        throw err;
      }

      const char = characters.find(c => c.id === d.speakerId);
      if (!char) {
        const err = new Error(`Nhân vật [${d.speakerId}] trong câu thoại số ${idx + 1} không tồn tại trong danh sách diễn viên.`);
        err.code = 'SPEAKER_NOT_FOUND';
        throw err;
      }

      if (d.sceneId && scenes.length > 0) {
        const scene = scenes.find(s => s.id === d.sceneId);
        if (!scene) {
          const err = new Error(`Phân cảnh [${d.sceneId}] của câu thoại số ${idx + 1} không tồn tại.`);
          err.code = 'SCENE_NOT_FOUND';
          throw err;
        }
      }

      if (!d.text || !d.text.trim()) {
        const err = new Error(`Câu thoại số ${idx + 1} của [${char.name}] bị trống văn bản.`);
        err.code = 'EMPTY_DIALOGUE_TEXT';
        throw err;
      }
    }

    return true;
  }

  /**
   * Compose multi-speaker audio and timeline for entire StoryPlan
   */
  async composeStoryAudio(options = {}) {
    const { storyId, preferredProvider, pauseDurationMs = 350, forceRegenerate = false } = options;
    const storyPlan = storyPlanStore.get(storyId);
    if (!storyPlan) {
      const err = new Error(`Không tìm thấy StoryPlan với id: ${storyId}`);
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    this.validateStoryPlan(storyPlan);

    const characters = storyPlan.characters;
    const dialogues = storyPlan.dialogues;
    const timeline = [];
    const audioChunkBuffers = [];

    let currentTimestampMs = 0;

    for (let i = 0; i < dialogues.length; i++) {
      const d = dialogues[i];
      const speaker = characters.find(c => c.id === d.speakerId);
      const voiceId = d.voiceId || speaker.voice?.voiceId || (speaker.gender === 'female' ? 'vi-female' : 'vi-male');

      let dialogueAsset = null;
      if (!forceRegenerate) {
        dialogueAsset = this.assetStore.getDialogueAsset(storyId, d.id);
      }

      let audioBuffer;
      let durationMs = 0;
      let actualProvider = 'edge-tts';
      let fallbackUsed = false;
      let fallbackReason = null;

      if (dialogueAsset && fs.existsSync(dialogueAsset.filePath)) {
        audioBuffer = fs.readFileSync(dialogueAsset.filePath);
        durationMs = dialogueAsset.durationMs;
        actualProvider = dialogueAsset.actualProvider || dialogueAsset.provider;
      } else {
        // Synthesize single dialogue
        const synthRes = await this.voiceRegistry.synthesizeWithFallback({
          text: d.text,
          voiceId,
          gender: speaker.gender,
          age: speaker.age,
          emotion: d.emotion,
          speed: d.speed || '+0%',
          preferredProvider
        });

        if (!synthRes.success || !synthRes.audioBuffer) {
          const err = new Error(`Lỗi sinh giọng thoại cho [${speaker.name}]: ${synthRes.error?.message || 'Không thể tạo âm thanh'}`);
          err.code = synthRes.error?.code || 'DIALOGUE_SYNTHESIS_FAILED';
          throw err;
        }

        audioBuffer = synthRes.audioBuffer;
        actualProvider = synthRes.actualProvider;
        fallbackUsed = synthRes.fallbackUsed;
        fallbackReason = synthRes.fallbackReason;

        // Parse duration
        const durationInfo = AudioDurationParser.parse(audioBuffer);
        durationMs = durationInfo.durationMs || Math.round((d.text.split(/\s+/).length / 3.0) * 1000);

        // Save individual file
        const chunkFileName = `dlg_${d.id}_${crypto.randomBytes(4).toString('hex')}.mp3`;
        const chunkFilePath = path.join(AUDIO_ASSETS_DIR, chunkFileName);
        fs.writeFileSync(chunkFilePath, audioBuffer);

        const assetId = `audio_${d.id}_${crypto.randomBytes(4).toString('hex')}`;
        dialogueAsset = this.assetStore.saveAsset({
          assetId,
          storyId,
          type: 'dialogue_audio',
          targetId: d.id,
          speakerId: speaker.id,
          speakerName: speaker.name,
          voiceId,
          text: d.text,
          durationMs,
          durationSec: parseFloat((durationMs / 1000).toFixed(2)),
          filePath: chunkFilePath,
          audioUrl: `/uploads/audio-assets/${chunkFileName}`,
          fileSize: audioBuffer.length,
          format: 'mp3',
          provider: synthRes.requestedProvider,
          actualProvider,
          fallbackUsed,
          fallbackReason,
          isMock: synthRes.isMock || false,
          status: 'ready',
          createdAt: new Date().toISOString()
        });
      }

      // Append audio buffer to master composition list
      audioChunkBuffers.push(audioBuffer);

      // Insert pause buffer between dialogues if not the last one
      const isLast = (i === dialogues.length - 1);
      const pauseMs = isLast ? 0 : pauseDurationMs;
      if (pauseMs > 0) {
        audioChunkBuffers.push(AudioDurationParser.createSilenceBuffer(pauseMs));
      }

      // Add to timeline
      const startMs = currentTimestampMs;
      const endMs = startMs + durationMs;
      currentTimestampMs = endMs + pauseMs;

      // Update dialogue in StoryPlan
      d.audioUrl = dialogueAsset.audioUrl;
      d.audioPath = dialogueAsset.filePath;
      d.durationMs = durationMs;
      d.durationSec = parseFloat((durationMs / 1000).toFixed(2));
      d.voiceId = voiceId;

      timeline.push({
        dialogueId: d.id,
        speakerId: speaker.id,
        speakerName: speaker.name,
        voiceId,
        text: d.text,
        emotion: d.emotion || 'Tự nhiên',
        action: d.action || '',
        sceneId: d.sceneId || '',
        startMs,
        endMs,
        durationMs,
        durationSec: parseFloat((durationMs / 1000).toFixed(2)),
        audioUrl: dialogueAsset.audioUrl,
        filePath: dialogueAsset.filePath,
        pauseAfterMs: pauseMs
      });
    }

    // 4. Compose Master Dialogue Track
    const masterBuffer = Buffer.concat(audioChunkBuffers);
    const masterDurationMs = currentTimestampMs;
    const masterFileName = `master_${storyId}_${crypto.randomBytes(4).toString('hex')}.mp3`;
    const masterFilePath = path.join(AUDIO_ASSETS_DIR, masterFileName);
    fs.writeFileSync(masterFilePath, masterBuffer);

    const masterAssetId = `audio_master_${storyId}_${crypto.randomBytes(4).toString('hex')}`;
    const masterAsset = this.assetStore.saveAsset({
      assetId: masterAssetId,
      storyId,
      type: 'master_audio',
      targetId: storyId,
      durationMs: masterDurationMs,
      durationSec: parseFloat((masterDurationMs / 1000).toFixed(2)),
      filePath: masterFilePath,
      audioUrl: `/uploads/audio-assets/${masterFileName}`,
      fileSize: masterBuffer.length,
      format: 'mp3',
      dialogueCount: dialogues.length,
      status: 'ready',
      createdAt: new Date().toISOString()
    });

    // 5. Sync into StoryPlan
    storyPlan.audioTimeline = timeline;
    storyPlan.masterAudio = {
      assetId: masterAssetId,
      audioUrl: masterAsset.audioUrl,
      durationMs: masterDurationMs,
      durationSec: parseFloat((masterDurationMs / 1000).toFixed(2))
    };

    storyPlanStore.save(storyPlan);

    return {
      success: true,
      storyId,
      totalDurationMs: masterDurationMs,
      totalDurationSec: parseFloat((masterDurationMs / 1000).toFixed(2)),
      dialogueCount: dialogues.length,
      timeline,
      masterAudio: storyPlan.masterAudio
    };
  }

  /**
   * Regenerate audio for a single dialogue line and re-compose master track
   */
  async regenerateSingleDialogue(storyId, dialogueId, options = {}) {
    const storyPlan = storyPlanStore.get(storyId);
    if (!storyPlan) {
      const err = new Error(`Không tìm thấy StoryPlan với id: ${storyId}`);
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    const dialogue = (storyPlan.dialogues || []).find(d => d.id === dialogueId);
    if (!dialogue) {
      const err = new Error(`Không tìm thấy lời thoại với id: ${dialogueId}`);
      err.code = 'DIALOGUE_NOT_FOUND';
      throw err;
    }

    const speaker = (storyPlan.characters || []).find(c => c.id === dialogue.speakerId);
    if (!speaker) {
      const err = new Error(`Nhân vật [${dialogue.speakerId}] không tồn tại.`);
      err.code = 'SPEAKER_NOT_FOUND';
      throw err;
    }

    const voiceId = dialogue.voiceId || speaker.voice?.voiceId || (speaker.gender === 'female' ? 'vi-female' : 'vi-male');
    const synthRes = await this.voiceRegistry.synthesizeWithFallback({
      text: dialogue.text,
      voiceId,
      gender: speaker.gender,
      age: speaker.age,
      emotion: dialogue.emotion,
      preferredProvider: options.preferredProvider
    });

    if (!synthRes.success || !synthRes.audioBuffer) {
      const err = new Error(`Lỗi sinh lại giọng thoại: ${synthRes.error?.message || 'Không thể tạo âm thanh'}`);
      err.code = synthRes.error?.code || 'DIALOGUE_SYNTHESIS_FAILED';
      throw err;
    }

    const audioBuffer = synthRes.audioBuffer;
    const durationInfo = AudioDurationParser.parse(audioBuffer);
    const durationMs = durationInfo.durationMs || Math.round((dialogue.text.split(/\s+/).length / 3.0) * 1000);

    const chunkFileName = `dlg_${dialogue.id}_${crypto.randomBytes(4).toString('hex')}.mp3`;
    const chunkFilePath = path.join(AUDIO_ASSETS_DIR, chunkFileName);
    fs.writeFileSync(chunkFilePath, audioBuffer);

    const assetId = `audio_${dialogue.id}_${crypto.randomBytes(4).toString('hex')}`;
    const dialogueAsset = this.assetStore.saveAsset({
      assetId,
      storyId,
      type: 'dialogue_audio',
      targetId: dialogue.id,
      speakerId: speaker.id,
      speakerName: speaker.name,
      voiceId,
      text: dialogue.text,
      durationMs,
      durationSec: parseFloat((durationMs / 1000).toFixed(2)),
      filePath: chunkFilePath,
      audioUrl: `/uploads/audio-assets/${chunkFileName}`,
      fileSize: audioBuffer.length,
      format: 'mp3',
      provider: synthRes.requestedProvider,
      actualProvider: synthRes.actualProvider,
      fallbackUsed: synthRes.fallbackUsed,
      fallbackReason: synthRes.fallbackReason,
      isMock: synthRes.isMock || false,
      status: 'ready',
      createdAt: new Date().toISOString()
    });

    dialogue.audioUrl = dialogueAsset.audioUrl;
    dialogue.audioPath = dialogueAsset.filePath;
    dialogue.durationMs = durationMs;
    dialogue.durationSec = parseFloat((durationMs / 1000).toFixed(2));

    // Re-compose master audio with the updated chunk
    return this.composeStoryAudio({ storyId, preferredProvider: options.preferredProvider, forceRegenerate: false });
  }
}

const defaultAudioComposer = new MultiSpeakerAudioComposer();

module.exports = {
  MultiSpeakerAudioComposer,
  multiSpeakerAudioComposer: defaultAudioComposer
};
