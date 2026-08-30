/**
 * Character Consistency Strategy
 * Enforces visual identity continuity across multi-scene and multi-shot generations.
 */
class CharacterConsistencyStrategy {
  /**
   * Evaluate provider capability against consistency requirements
   * @param {Object} providerCapabilities
   * @returns {{ supportedFeatures: string[], unsupportedFeatures: string[], mode: 'reference_image'|'seed_prompt'|'prompt_only' }}
   */
  static evaluateCapabilities(providerCapabilities = {}) {
    const supportedFeatures = [];
    const unsupportedFeatures = [];

    if (providerCapabilities.referenceImage) supportedFeatures.push('referenceImage');
    else unsupportedFeatures.push('referenceImage');

    if (providerCapabilities.seed) supportedFeatures.push('seed');
    else unsupportedFeatures.push('seed');

    if (providerCapabilities.ipAdapter) supportedFeatures.push('ipAdapter');
    else unsupportedFeatures.push('ipAdapter');

    if (providerCapabilities.lora) supportedFeatures.push('lora');
    else unsupportedFeatures.push('lora');

    let mode = 'prompt_only';
    if (providerCapabilities.referenceImage || providerCapabilities.ipAdapter) {
      mode = 'reference_image';
    } else if (providerCapabilities.seed) {
      mode = 'seed_prompt';
    }

    return {
      supportedFeatures,
      unsupportedFeatures,
      mode
    };
  }

  /**
   * Build consistent visual generation request for a Scene or Shot
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} params.negativePrompt
   * @param {Array<Object>} params.characters - List of characters appearing in this shot/scene
   * @param {Array<Object>} params.characterAssets - Visual assets of the characters
   * @param {Object} params.providerCapabilities
   * @param {number} [params.seed]
   * @returns {Object} Request object prepared for ImageProvider
   */
  static buildConsistentRequest({
    prompt,
    negativePrompt,
    characters = [],
    characterAssets = [],
    providerCapabilities = {},
    seed,
    aspectRatio = '9:16'
  }) {
    const evalResult = this.evaluateCapabilities(providerCapabilities);
    const referenceImages = [];
    const characterReferenceIds = [];

    for (const char of characters) {
      const asset = characterAssets.find(a => a.targetId === char.id && a.status === 'ready');
      if (asset) {
        if (asset.filePath) referenceImages.push(asset.filePath);
        else if (asset.imageUrl) referenceImages.push(asset.imageUrl);
        characterReferenceIds.push(asset.assetId);
      }
    }

    const request = {
      prompt,
      negativePrompt,
      aspectRatio,
      width: aspectRatio === '9:16' ? 768 : 1024,
      height: aspectRatio === '9:16' ? 1344 : 1024,
      seed: seed || undefined,
      metadata: {
        consistencyMode: evalResult.mode,
        supportedFeatures: evalResult.supportedFeatures,
        unsupportedFeatures: evalResult.unsupportedFeatures,
        characterCount: characters.length,
        characterIds: characters.map(c => c.id),
        characterReferenceIds
      }
    };

    if (evalResult.mode === 'reference_image' && referenceImages.length > 0) {
      request.referenceImages = referenceImages;
      request.characterReferenceId = characterReferenceIds[0] || null;
    }

    return request;
  }
}

module.exports = CharacterConsistencyStrategy;
