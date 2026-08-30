const ShotPromptEngine = require('./shotPromptEngine');

/**
 * SpeakerAwareShotPlanner (Phase 3D)
 * Converts StoryPlan dialogues, audio timeline, and characters into a cinematic multi-shot plan.
 */
class SpeakerAwareShotPlanner {
  /**
   * Plan cinematic shots for StoryPlan
   * @param {Object} storyPlan - Canonical StoryPlan
   * @returns {Array<Object>} List of structured shot plans
   */
  static planShots(storyPlan) {
    if (!storyPlan || !storyPlan.storyId) {
      throw new Error('StoryPlan is required to plan shots.');
    }

    const characters = storyPlan.characters || [];
    const scenes = storyPlan.scenes || [];
    const dialogues = storyPlan.dialogues || [];
    const audioTimeline = storyPlan.audioTimeline || [];
    const characterReferences = storyPlan.characterReferences || [];

    const plannedShots = [];
    let shotIndex = 1;

    // Default camera motions sequence to create visual variety
    const cameraMotions = ['push_in', 'pan_left', 'pull_out', 'tilt_up', 'pan_right'];

    // Group dialogues by scene
    for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
      const scene = scenes[sIdx];
      const sceneDialogues = dialogues.filter(d => d.sceneId === scene.id);
      const sceneCharacters = characters.filter(c => (scene.characters || []).includes(c.id));

      // 1. Establishing Shot for the scene
      const estShotId = `shot_${String(shotIndex++).padStart(3, '0')}`;
      const estDurationMs = 2500; // 2.5s establishing shot

      const estPrompt = ShotPromptEngine.buildShotPrompt({
        shot: { shotType: 'Wide Two-Shot 35mm', camera: 'Stationary eye-level', cameraMotion: 'pull_out' },
        scene,
        listeners: sceneCharacters,
        style: storyPlan.style
      });

      plannedShots.push({
        shotId: estShotId,
        sceneId: scene.id,
        sceneIndex: sIdx + 1,
        shotType: 'Wide Two-Shot 35mm',
        cameraMotion: 'pull_out',
        activeSpeakerId: null,
        listenerCharacterIds: sceneCharacters.map(c => c.id),
        dialogueId: null,
        isLipSyncRequired: false,
        durationMs: estDurationMs,
        durationSec: parseFloat((estDurationMs / 1000).toFixed(2)),
        prompt: estPrompt.prompt,
        cameraInstruction: estPrompt.cameraInstruction,
        actingInstruction: 'All characters in scene establishing the setting and atmosphere',
        characterReferenceIds: characterReferences.filter(r => sceneCharacters.some(c => c.id === r.characterId)).map(r => r.referenceId)
      });

      // 2. Individual dialogue shots with speaker close-up and listener coverage
      for (let dIdx = 0; dIdx < sceneDialogues.length; dIdx++) {
        const dialogue = sceneDialogues[dIdx];
        const speaker = characters.find(c => c.id === dialogue.speakerId);
        const listeners = sceneCharacters.filter(c => c.id !== dialogue.speakerId);
        const timelineItem = audioTimeline.find(t => t.dialogueId === dialogue.id);

        const durationMs = timelineItem ? timelineItem.durationMs + 300 : 3000;
        const shotId = `shot_${String(shotIndex++).padStart(3, '0')}`;
        const cameraMotion = cameraMotions[(shotIndex - 1) % cameraMotions.length];
        const shotType = (dIdx % 2 === 0) ? 'Close-Up 85mm' : 'Medium Close-Up 50mm';

        const speakerRef = characterReferences.find(r => r.characterId === speaker?.id);

        const shotPrompt = ShotPromptEngine.buildShotPrompt({
          shot: { shotType, camera: 'Focused on speaking character', cameraMotion },
          scene,
          activeSpeaker: speaker,
          listeners,
          dialogue,
          style: storyPlan.style
        });

        plannedShots.push({
          shotId,
          sceneId: scene.id,
          sceneIndex: sIdx + 1,
          dialogueIndex: dIdx + 1,
          shotType,
          cameraMotion,
          activeSpeakerId: speaker ? speaker.id : null,
          activeSpeakerName: speaker ? speaker.name : 'Speaker',
          listenerCharacterIds: listeners.map(l => l.id),
          dialogueId: dialogue.id,
          dialogueText: dialogue.text,
          dialogueEmotion: dialogue.emotion || 'Natural',
          audioUrl: timelineItem?.audioUrl || dialogue.audioUrl || null,
          audioPath: timelineItem?.filePath || dialogue.audioPath || null,
          characterReferenceId: speakerRef ? speakerRef.referenceId : (speaker?.referenceId || null),
          characterReferenceUrl: speakerRef ? speakerRef.imageUrl : (speaker?.avatarUrl || null),
          characterReferencePath: speakerRef ? speakerRef.imagePath : null,
          isLipSyncRequired: true,
          durationMs,
          durationSec: parseFloat((durationMs / 1000).toFixed(2)),
          startMs: timelineItem?.startMs || 0,
          endMs: timelineItem?.endMs || durationMs,
          prompt: shotPrompt.prompt,
          cameraInstruction: shotPrompt.cameraInstruction,
          actingInstruction: shotPrompt.actingInstruction
        });
      }
    }

    return plannedShots;
  }
}

module.exports = SpeakerAwareShotPlanner;
