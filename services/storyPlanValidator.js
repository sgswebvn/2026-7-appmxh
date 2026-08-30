/**
 * ============================================================================
 * CANONICAL STORYPLAN VALIDATOR
 * ============================================================================
 * Enforces rigorous relational integrity across:
 * TOPIC -> CHARACTERS -> RELATIONSHIPS -> SCENES -> SHOTS -> DIALOGUE -> VOICE
 */

function issuesFor(plan) {
  const issues = [];
  if (!plan || typeof plan !== 'object') {
    return ['StoryPlan must be a valid JSON object.'];
  }

  // 1. Top-level metadata
  if (!plan.storyId || typeof plan.storyId !== 'string') issues.push('storyId is required and must be a string.');
  if (!plan.topic || typeof plan.topic !== 'string' || !plan.topic.trim()) issues.push('topic is required and must be a non-empty string.');
  if (!plan.title || typeof plan.title !== 'string' || !plan.title.trim()) issues.push('title is required and must be a non-empty string.');

  const characters = Array.isArray(plan.characters) ? plan.characters : [];
  const relationships = Array.isArray(plan.relationships) ? plan.relationships : [];
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  const shots = Array.isArray(plan.shots) ? plan.shots : [];
  const dialogues = Array.isArray(plan.dialogues) ? plan.dialogues : [];

  if (characters.length < 1) {
    issues.push('At least one character is required.');
  }

  // 2. Character validation & unique IDs
  const characterIds = new Set();
  const characterVoiceMap = new Map();

  for (const char of characters) {
    if (!char.id || typeof char.id !== 'string') {
      issues.push(`Character is missing a valid id: ${JSON.stringify(char)}.`);
      continue;
    }
    if (characterIds.has(char.id)) {
      issues.push(`Duplicate character ID: ${char.id}.`);
    }
    characterIds.add(char.id);

    if (!char.name || typeof char.name !== 'string') {
      issues.push(`Character ${char.id} is missing a name.`);
    }

    const voiceId = char.voice?.voiceId || (typeof char.voice === 'string' ? char.voice : null);
    if (!voiceId) {
      issues.push(`Character ${char.id} has no valid voice assignment.`);
    } else {
      characterVoiceMap.set(char.id, voiceId);
    }
  }

  // 3. Relationships validation
  const relIds = new Set();
  for (const rel of relationships) {
    if (!rel.id) issues.push(`Relationship is missing an ID.`);
    if (rel.id && relIds.has(rel.id)) issues.push(`Duplicate relationship ID: ${rel.id}.`);
    if (rel.id) relIds.add(rel.id);

    if (!rel.fromCharacterId || !characterIds.has(rel.fromCharacterId)) {
      issues.push(`Relationship ${rel.id || '(unknown)'} references invalid fromCharacterId: ${rel.fromCharacterId}.`);
    }
    if (!rel.toCharacterId || !characterIds.has(rel.toCharacterId)) {
      issues.push(`Relationship ${rel.id || '(unknown)'} references invalid toCharacterId: ${rel.toCharacterId}.`);
    }
  }

  // 4. Scenes validation
  const sceneIds = new Set();
  if (scenes.length < 1) {
    issues.push('At least one scene is required.');
  }

  for (const scene of scenes) {
    if (!scene.id || typeof scene.id !== 'string') {
      issues.push(`Scene is missing a valid id.`);
      continue;
    }
    if (sceneIds.has(scene.id)) {
      issues.push(`Duplicate scene ID: ${scene.id}.`);
    }
    sceneIds.add(scene.id);

    const sceneChars = Array.isArray(scene.characters) ? scene.characters : [];
    if (sceneChars.length === 0) {
      issues.push(`Scene ${scene.id} has no characters assigned.`);
    }
    for (const cId of sceneChars) {
      if (!characterIds.has(cId)) {
        issues.push(`Scene ${scene.id} references non-existent character ID: ${cId}.`);
      }
    }
  }

  // 5. Dialogues validation
  const dialogueIds = new Set();
  for (const dlg of dialogues) {
    if (!dlg.id || typeof dlg.id !== 'string') {
      issues.push(`Dialogue is missing a valid id.`);
      continue;
    }
    if (dialogueIds.has(dlg.id)) {
      issues.push(`Duplicate dialogue ID: ${dlg.id}.`);
    }
    dialogueIds.add(dlg.id);

    if (!dlg.speakerId || !characterIds.has(dlg.speakerId)) {
      issues.push(`Dialogue ${dlg.id} has an invalid or missing speakerId: ${dlg.speakerId}.`);
    }

    if (!dlg.sceneId || !sceneIds.has(dlg.sceneId)) {
      issues.push(`Dialogue ${dlg.id} has an invalid or missing sceneId: ${dlg.sceneId}.`);
    }

    if (!dlg.text || typeof dlg.text !== 'string' || !dlg.text.trim()) {
      issues.push(`Dialogue ${dlg.id} has empty text.`);
    }

    const expectedVoice = characterVoiceMap.get(dlg.speakerId);
    if (!dlg.voiceId) {
      issues.push(`Dialogue ${dlg.id} is missing a voiceId.`);
    } else if (expectedVoice && dlg.voiceId !== expectedVoice) {
      issues.push(`Dialogue ${dlg.id} voiceId (${dlg.voiceId}) does not match speaker ${dlg.speakerId} voice (${expectedVoice}).`);
    }
  }

  // 6. Shots validation
  const shotIds = new Set();
  if (shots.length < 1) {
    issues.push('At least one shot is required.');
  }

  for (const shot of shots) {
    if (!shot.id || typeof shot.id !== 'string') {
      issues.push(`Shot is missing a valid id.`);
      continue;
    }
    if (shotIds.has(shot.id)) {
      issues.push(`Duplicate shot ID: ${shot.id}.`);
    }
    shotIds.add(shot.id);

    if (!shot.sceneId || !sceneIds.has(shot.sceneId)) {
      issues.push(`Shot ${shot.id} references an invalid sceneId: ${shot.sceneId}.`);
    }

    const shotChars = Array.isArray(shot.characters) ? shot.characters : [];
    for (const cId of shotChars) {
      if (!characterIds.has(cId)) {
        issues.push(`Shot ${shot.id} references non-existent character ID: ${cId}.`);
      }
    }

    const shotDlgs = Array.isArray(shot.dialogueIds) ? shot.dialogueIds : [];
    for (const dId of shotDlgs) {
      if (!dialogueIds.has(dId)) {
        issues.push(`Shot ${shot.id} references non-existent dialogue ID: ${dId}.`);
      }
    }
  }

  // 7. Orphan Checks
  // A. Orphan Characters: must appear in at least one scene or speak in a dialogue
  for (const cId of characterIds) {
    const appearsInScene = scenes.some(s => Array.isArray(s.characters) && s.characters.includes(cId));
    const speaksDialogue = dialogues.some(d => d.speakerId === cId);
    if (!appearsInScene && !speaksDialogue) {
      issues.push(`Character ${cId} is orphaned (not used in any scene or dialogue).`);
    }
  }

  // B. Orphan Scenes: must have at least one shot
  for (const sId of sceneIds) {
    const hasShot = shots.some(shot => shot.sceneId === sId);
    if (!hasShot) {
      issues.push(`Scene ${sId} is orphaned (no shots belong to this scene).`);
    }
  }

  // C. Orphan Dialogues: must be attached to a scene's dialogueIds or a shot's dialogueIds
  for (const dId of dialogueIds) {
    const inScene = scenes.some(s => Array.isArray(s.dialogueIds) && s.dialogueIds.includes(dId));
    const inShot = shots.some(sh => Array.isArray(sh.dialogueIds) && sh.dialogueIds.includes(dId));
    if (!inScene && !inShot) {
      issues.push(`Dialogue ${dId} is orphaned (not linked to any scene or shot dialogue list).`);
    }
  }

  return issues;
}

function validateStoryPlan(plan) {
  const issues = issuesFor(plan);
  return {
    valid: issues.length === 0,
    issues
  };
}

module.exports = {
  validateStoryPlan,
  issuesFor
};
