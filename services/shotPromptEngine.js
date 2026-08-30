/**
 * ShotPromptEngine (Phase 3D)
 * Builds individualized, cinematic acting & camera prompts for each shot.
 */
class ShotPromptEngine {
  /**
   * Build specific shot prompt
   * @param {Object} options
   * @param {Object} options.shot - Shot object
   * @param {Object} options.scene - Scene object
   * @param {Object} [options.activeSpeaker] - Active speaking character object
   * @param {Array<Object>} [options.listeners=[]] - Listening character objects
   * @param {Object} [options.dialogue] - Dialogue line object
   * @param {string} [options.style] - Visual style
   * @returns {{ prompt: string, negativePrompt: string, cameraInstruction: string, actingInstruction: string }}
   */
  static buildShotPrompt(options = {}) {
    const { shot, scene, activeSpeaker, listeners = [], dialogue, style = 'cinematic realism' } = options;

    const shotType = shot?.shotType || 'Two-Shot 50mm';
    const camera = shot?.camera || 'Eye-level stationary shot';
    const cameraMotion = shot?.cameraMotion || 'push_in';
    const location = scene?.location || 'Contemporary setting';
    const time = scene?.time || 'Daytime';
    const environment = scene?.environment || '';

    let promptParts = [];
    let actingParts = [];
    let cameraInstruction = `${shotType}, ${camera}, smooth ${cameraMotion} camera movement, vertical 9:16 aspect ratio.`;

    // 1. Framing & Composition
    promptParts.push(`Cinematic vertical 9:16 frame, ${shotType}`);
    promptParts.push(`Setting: ${location}, ${time}. ${environment}`);

    // 2. Active Speaker
    if (activeSpeaker) {
      const spkAge = activeSpeaker.age ? `${activeSpeaker.age}-year-old` : '';
      const spkGender = activeSpeaker.gender || '';
      const spkFace = activeSpeaker.appearance?.face ? `facial details: ${activeSpeaker.appearance.face}` : '';
      const spkCloth = activeSpeaker.appearance?.clothing ? `wearing ${activeSpeaker.appearance.clothing}` : '';

      promptParts.push(`Active Speaker: ${activeSpeaker.name} (${spkAge} ${spkGender} ${activeSpeaker.role}), ${spkFace}, ${spkCloth}`);

      if (dialogue) {
        actingParts.push(`${activeSpeaker.name} is speaking with ${dialogue.emotion || 'natural'} emotion. Action: ${dialogue.action || 'acting with natural mouth movement'}`);
      } else {
        actingParts.push(`${activeSpeaker.name} performing action: ${shot?.action || 'character performance'}`);
      }
    }

    // 3. Listeners / Other characters present
    if (listeners.length > 0) {
      const listenerDesc = listeners.map(l => `${l.name} (${l.role || ''})`).join(', ');
      promptParts.push(`In frame / background: ${listenerDesc}`);
      actingParts.push(`Listeners (${listenerDesc}) are reacting naturally to the conversation, listening with focused gaze and subtle head tilt.`);
    }

    // 4. Style & Lighting
    promptParts.push(`Atmosphere: ${style}, 8k UHD, masterpiece, highly detailed skin texture, photorealistic lighting, shallow depth of field, anamorphic bokeh.`);

    const fullPrompt = promptParts.join('. ') + '. ' + actingParts.join('. ');
    const negativePrompt = 'blurry, deformed, cartoon, 3d render, duplicate limbs, distorted face, out of focus, low resolution, watermark, text overlay';

    return {
      prompt: fullPrompt,
      negativePrompt,
      cameraInstruction,
      actingInstruction: actingParts.join('. ')
    };
  }
}

module.exports = ShotPromptEngine;
