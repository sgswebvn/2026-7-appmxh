function issuesFor(plan) {
  const issues = [];
  if (!plan || typeof plan !== 'object') return ['StoryPlan must be an object.'];
  const characters = Array.isArray(plan.characters) ? plan.characters : [];
  const relationships = Array.isArray(plan.relationships) ? plan.relationships : [];
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  const shots = Array.isArray(plan.shots) ? plan.shots : [];
  const dialogues = Array.isArray(plan.dialogues) ? plan.dialogues : [];
  if (!plan.storyId || !plan.topic || !plan.title) issues.push('storyId, topic and title are required.');
  if (!characters.length) issues.push('At least one character is required.');
  const ids = new Set();
  for (const character of characters) {
    if (!character.id || ids.has(character.id)) issues.push(`Character ID is missing or duplicated: ${character.id || '(missing)'}.`);
    ids.add(character.id);
    if (!character.voice?.voiceId) issues.push(`Character ${character.id} has no voice assignment.`);
  }
  const sceneIds = new Set(scenes.map(scene => scene.id)); const dialogueIds = new Set(dialogues.map(dialogue => dialogue.id));
  for (const relation of relationships) if (!ids.has(relation.fromCharacterId) || !ids.has(relation.toCharacterId)) issues.push(`Relationship ${relation.id} references an unknown character.`);
  for (const scene of scenes) {
    if (!scene.id || !(scene.characters || []).length) issues.push(`Scene ${scene.id || '(missing)'} has no characters.`);
    for (const id of scene.characters || []) if (!ids.has(id)) issues.push(`Scene ${scene.id} references an unknown character ${id}.`);
    for (const id of scene.dialogueIds || []) if (!dialogueIds.has(id)) issues.push(`Scene ${scene.id} references an unknown dialogue ${id}.`);
  }
  for (const dialogue of dialogues) {
    if (!dialogue.id || !ids.has(dialogue.speakerId)) issues.push(`Dialogue ${dialogue.id || '(missing)'} has an invalid speakerId.`);
    if (!sceneIds.has(dialogue.sceneId)) issues.push(`Dialogue ${dialogue.id || '(missing)'} has an invalid sceneId.`);
    const character = characters.find(item => item.id === dialogue.speakerId);
    if (character && dialogue.voiceId !== character.voice.voiceId) issues.push(`Dialogue ${dialogue.id} voiceId does not match its speaker.`);
  }
  for (const shot of shots) {
    if (!shot.id || !sceneIds.has(shot.sceneId)) issues.push(`Shot ${shot.id || '(missing)'} has an invalid sceneId.`);
    for (const id of shot.characters || []) if (!ids.has(id)) issues.push(`Shot ${shot.id} references an unknown character ${id}.`);
    for (const id of shot.dialogueIds || []) if (!dialogueIds.has(id)) issues.push(`Shot ${shot.id} references an unknown dialogue ${id}.`);
  }
  for (const character of characters) {
    const used = scenes.some(scene => scene.characters?.includes(character.id)) || dialogues.some(dialogue => dialogue.speakerId === character.id);
    if (!used) issues.push(`Character ${character.id} is orphaned.`);
  }
  for (const dialogue of dialogues) if (!scenes.some(scene => scene.dialogueIds?.includes(dialogue.id))) issues.push(`Dialogue ${dialogue.id} is orphaned.`);
  return issues;
}
function validateStoryPlan(plan) { const issues = issuesFor(plan); return { valid: issues.length === 0, issues }; }
module.exports = { validateStoryPlan, issuesFor };
