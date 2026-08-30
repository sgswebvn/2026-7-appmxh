/**
 * Structured Prompt Builders for Visual Generation
 * Builds high-fidelity, photorealistic prompts for Character References, Scenes, and Shots.
 */

class CharacterPromptBuilder {
  /**
   * Build canonical visual portrait prompt for character identity reference sheet
   * @param {Object} character
   * @returns {{ prompt: string, negativePrompt: string }}
   */
  static build(character) {
    const name = character.name || 'Character';
    const age = character.age || 30;
    const gender = character.gender || 'person';
    const role = character.role || 'Protagonist';

    const appearance = character.appearance || {};
    const face = appearance.face || '';
    const hair = appearance.hair || '';
    const clothing = appearance.clothing || '';
    const body = appearance.body || '';
    const style = appearance.style || 'Photorealistic cinematic portrait, 8k resolution, Hasselblad 85mm lens, natural lighting, sharp focus';

    const promptParts = [
      `Canonical identity portrait of ${name}`,
      `${age}-year-old ${gender}`,
      role ? `(${role})` : '',
      face ? `Facial features: ${face}` : '',
      hair ? `Hair: ${hair}` : '',
      clothing ? `Wearing: ${clothing}` : '',
      body ? `Body build: ${body}` : '',
      `Style: ${style}`,
      'Looking at camera, studio neutral lighting, highly detailed skin texture, photorealistic, cinematic masterpiece'
    ].filter(Boolean);

    const negativePrompt = character.negativePrompt || 
      'blurry, deformed, cartoon, 3d render, anime, low quality, bad anatomy, extra limbs, watermark, text, out of frame, distorted face';

    return {
      prompt: promptParts.join(', '),
      negativePrompt
    };
  }
}

class ScenePromptBuilder {
  /**
   * Build visual prompt for a scene environment and context
   * @param {Object} scene
   * @param {Array<Object>} [charactersInScene] - List of character objects with appearance
   * @returns {{ prompt: string, negativePrompt: string }}
   */
  static build(scene, charactersInScene = []) {
    const location = scene.location || 'Interior room';
    const time = scene.time || 'Daytime';
    const environment = scene.environment || 'Cinematic environment with depth of field';
    const action = scene.action || 'Characters interacting';
    const emotion = scene.emotion || 'Natural mood';

    const charDescriptions = (charactersInScene || []).map(c => {
      const cName = c.name || c.id;
      const cApp = c.appearance?.clothing ? `wearing ${c.appearance.clothing}` : '';
      return `${cName} (${c.age}yo ${c.gender}, ${cApp})`;
    }).join(' and ');

    const promptParts = [
      `Cinematic scene: ${location}`,
      `Time of day: ${time}`,
      `Environment: ${environment}`,
      charDescriptions ? `Present characters: ${charDescriptions}` : '',
      `Action: ${action}`,
      `Atmosphere & Emotion: ${emotion}`,
      'Vertical 9:16 aspect ratio, cinematic lighting, movie still, photorealistic 8k, volumetric light, professional color grading'
    ].filter(Boolean);

    const negativePrompt = 'blurry, distorted faces, duplicate bodies, lowres, text, subtitles, watermark, anime, cartoon, CGI';

    return {
      prompt: promptParts.join(', '),
      negativePrompt
    };
  }
}

class ShotPromptBuilder {
  /**
   * Build precise visual prompt for a specific shot
   * @param {Object} shot
   * @param {Object} scene
   * @param {Array<Object>} [charactersInShot]
   * @returns {{ prompt: string, negativePrompt: string }}
   */
  static build(shot, scene, charactersInShot = []) {
    const shotType = shot.shotType || 'Medium Shot 50mm';
    const camera = shot.camera || 'Eye-level stationary shot';
    const action = shot.action || 'Character performing action';
    const location = scene?.location || 'Setting';
    const time = scene?.time || 'Daytime';

    const charDetails = (charactersInShot || []).map(c => {
      const cApp = c.appearance || {};
      return `${c.name} (${c.age}yo ${c.gender}, ${cApp.face || ''}, wearing ${cApp.clothing || 'casual'})`;
    }).join('; ');

    const promptParts = [
      `Cinematic shot composition: ${shotType}`,
      `Camera framing: ${camera}`,
      `Setting: ${location} at ${time}`,
      charDetails ? `Subjects: ${charDetails}` : '',
      `Action & Movement: ${action}`,
      'Vertical 9:16 framing, film grain, cinematic depth of field, photorealistic, sharp focus, 8k movie still'
    ].filter(Boolean);

    const negativePrompt = 'blurry, extra hands, distorted eyes, amateur photo, cartoon, 3d render, watermark, captions';

    return {
      prompt: promptParts.join(', '),
      negativePrompt
    };
  }
}

module.exports = {
  CharacterPromptBuilder,
  ScenePromptBuilder,
  ShotPromptBuilder
};
