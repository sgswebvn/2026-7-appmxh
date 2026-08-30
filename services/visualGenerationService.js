const { storyPlanStore } = require('./storyPlanStore');
const { visualAssetStore } = require('./visualAssetStore');
const { imageProviderRegistry } = require('./imageProviders/imageProviderRegistry');
const { CharacterPromptBuilder, ScenePromptBuilder, ShotPromptBuilder } = require('./promptBuilders');
const CharacterConsistencyStrategy = require('./characterConsistencyStrategy');

class VisualGenerationService {
  /**
   * Generate canonical character reference portrait
   * @param {Object} params
   * @param {string} params.storyId
   * @param {string} params.characterId
   * @param {string} [params.preferredProvider]
   * @param {boolean} [params.forceRegenerate=false]
   * @returns {Promise<Object>}
   */
  async generateCharacterReference({ storyId, characterId, preferredProvider, forceRegenerate = false }) {
    const storyPlan = storyPlanStore.get(storyId);
    if (!storyPlan) {
      const err = new Error(`StoryPlan ${storyId} not found`);
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    const character = (storyPlan.characters || []).find(c => c.id === characterId);
    if (!character) {
      const err = new Error(`Character ${characterId} not found in StoryPlan ${storyId}`);
      err.code = 'CHARACTER_NOT_FOUND';
      throw err;
    }

    // 1. Check if valid reference already exists unless forceRegenerate is true
    if (!forceRegenerate) {
      const existingAsset = visualAssetStore.getCharacterReferenceAsset(storyId, characterId);
      if (existingAsset && existingAsset.status === 'ready') {
        return {
          cached: true,
          asset: existingAsset
        };
      }
    }

    // 2. Find or build character reference profile
    const refProfile = (storyPlan.characterReferences || []).find(r => r.characterId === characterId) || {};
    const { prompt, negativePrompt } = CharacterPromptBuilder.build({
      ...character,
      negativePrompt: refProfile.negativePrompt
    });

    // 3. Request visual generation with fallback
    const genResult = await imageProviderRegistry.generateWithFallback({
      prompt,
      negativePrompt,
      aspectRatio: '9:16',
      characterReferenceId: characterId,
      preferredProvider,
      metadata: {
        characterId,
        characterName: character.name,
        storyId
      }
    });

    if (!genResult.success) {
      // Record failed visual asset
      const failedAsset = visualAssetStore.saveAsset({
        storyId,
        type: 'character_reference',
        targetId: characterId,
        status: 'failed',
        prompt,
        negativePrompt,
        requestedProvider: genResult.requestedProvider,
        actualProvider: genResult.actualProvider,
        fallbackUsed: genResult.fallbackUsed,
        fallbackReason: genResult.fallbackReason,
        error: genResult.error
      });

      // Update story plan character reference status
      this._updateCharacterReferenceInStoryPlan(storyPlan, characterId, {
        referenceId: failedAsset.assetId,
        status: 'failed',
        error: genResult.error
      });

      const err = new Error(genResult.error?.message || 'Character reference generation failed');
      err.code = genResult.error?.code || 'IMAGE_GENERATION_FAILED';
      err.details = genResult;
      throw err;
    }

    // 4. Save successful visual asset
    const savedAsset = visualAssetStore.saveAsset({
      assetId: genResult.assetId,
      storyId,
      type: 'character_reference',
      targetId: characterId,
      status: 'ready',
      filePath: genResult.filePath,
      imageUrl: genResult.url,
      provider: genResult.actualProvider,
      requestedProvider: genResult.requestedProvider,
      actualProvider: genResult.actualProvider,
      fallbackUsed: genResult.fallbackUsed,
      fallbackReason: genResult.fallbackReason,
      seed: genResult.seed,
      prompt,
      negativePrompt,
      width: genResult.width,
      height: genResult.height,
      metadata: {
        characterName: character.name,
        age: character.age,
        gender: character.gender,
        role: character.role
      }
    });

    // 5. Update character & referenceProfile in StoryPlan
    this._updateCharacterReferenceInStoryPlan(storyPlan, characterId, {
      referenceId: savedAsset.assetId,
      status: 'ready',
      imageUrl: savedAsset.imageUrl,
      imagePath: savedAsset.filePath,
      provider: savedAsset.actualProvider,
      seed: savedAsset.seed,
      prompt,
      negativePrompt,
      width: savedAsset.width,
      height: savedAsset.height
    });

    return {
      cached: false,
      asset: savedAsset
    };
  }

  /**
   * Bulk generate references for all characters in a StoryPlan
   * @param {Object} params
   * @param {string} params.storyId
   * @param {string} [params.preferredProvider]
   * @param {boolean} [params.forceRegenerate=false]
   * @returns {Promise<{ storyId: string, total: number, completed: number, failed: number, results: Array }>}
   */
  async generateAllCharacterReferences({ storyId, preferredProvider, forceRegenerate = false }) {
    const storyPlan = storyPlanStore.get(storyId);
    if (!storyPlan) {
      const err = new Error(`StoryPlan ${storyId} not found`);
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    const characters = storyPlan.characters || [];
    const results = [];
    let completed = 0;
    let failed = 0;

    for (const char of characters) {
      try {
        const res = await this.generateCharacterReference({
          storyId,
          characterId: char.id,
          preferredProvider,
          forceRegenerate
        });
        completed++;
        results.push({
          characterId: char.id,
          characterName: char.name,
          status: 'ready',
          assetId: res.asset.assetId,
          imageUrl: res.asset.imageUrl,
          provider: res.asset.actualProvider,
          cached: res.cached
        });
      } catch (err) {
        failed++;
        results.push({
          characterId: char.id,
          characterName: char.name,
          status: 'failed',
          error: {
            code: err.code || 'IMAGE_GENERATION_FAILED',
            message: err.message
          }
        });
      }
    }

    return {
      storyId,
      total: characters.length,
      completed,
      failed,
      results
    };
  }

  /**
   * Generate Scene Visual Image with Character Consistency
   * @param {Object} params
   * @param {string} params.storyId
   * @param {string} params.sceneId
   * @param {string} [params.preferredProvider]
   */
  async generateSceneVisual({ storyId, sceneId, preferredProvider }) {
    const storyPlan = storyPlanStore.get(storyId);
    if (!storyPlan) {
      const err = new Error(`StoryPlan ${storyId} not found`);
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    const scene = (storyPlan.scenes || []).find(s => s.id === sceneId);
    if (!scene) {
      const err = new Error(`Scene ${sceneId} not found`);
      err.code = 'SCENE_NOT_FOUND';
      throw err;
    }

    // Characters in scene
    const charsInScene = (storyPlan.characters || []).filter(c => (scene.characters || []).includes(c.id));
    const characterAssets = visualAssetStore.getAssetsByStory(storyId).filter(a => a.type === 'character_reference');

    const { prompt, negativePrompt } = ScenePromptBuilder.build(scene, charsInScene);

    const provider = imageProviderRegistry.get(preferredProvider || process.env.IMAGE_PROVIDER || 'google-imagen') || imageProviderRegistry.getDefault();
    const capabilities = provider.getCapabilities();

    const request = CharacterConsistencyStrategy.buildConsistentRequest({
      prompt,
      negativePrompt,
      characters: charsInScene,
      characterAssets,
      providerCapabilities: capabilities,
      aspectRatio: '9:16'
    });

    const genResult = await imageProviderRegistry.generateWithFallback({
      ...request,
      preferredProvider,
      metadata: {
        ...request.metadata,
        storyId,
        sceneId
      }
    });

    if (!genResult.success) {
      const failedAsset = visualAssetStore.saveAsset({
        storyId,
        type: 'scene_visual',
        targetId: sceneId,
        status: 'failed',
        prompt,
        negativePrompt,
        error: genResult.error
      });
      const err = new Error(genResult.error?.message || 'Scene visual generation failed');
      err.code = genResult.error?.code || 'IMAGE_GENERATION_FAILED';
      throw err;
    }

    const savedAsset = visualAssetStore.saveAsset({
      assetId: genResult.assetId,
      storyId,
      type: 'scene_visual',
      targetId: sceneId,
      status: 'ready',
      filePath: genResult.filePath,
      imageUrl: genResult.url,
      provider: genResult.actualProvider,
      requestedProvider: genResult.requestedProvider,
      actualProvider: genResult.actualProvider,
      fallbackUsed: genResult.fallbackUsed,
      fallbackReason: genResult.fallbackReason,
      seed: genResult.seed,
      prompt,
      negativePrompt,
      width: genResult.width,
      height: genResult.height,
      metadata: {
        sceneLocation: scene.location,
        charactersInvolved: charsInScene.map(c => c.id)
      }
    });

    return savedAsset;
  }

  /**
   * Generate Shot Visual Image with Camera Framing and Character Consistency
   * @param {Object} params
   * @param {string} params.storyId
   * @param {string} params.shotId
   * @param {string} [params.preferredProvider]
   */
  async generateShotVisual({ storyId, shotId, preferredProvider }) {
    const storyPlan = storyPlanStore.get(storyId);
    if (!storyPlan) {
      const err = new Error(`StoryPlan ${storyId} not found`);
      err.code = 'STORY_NOT_FOUND';
      throw err;
    }

    const shot = (storyPlan.shots || []).find(s => s.id === shotId);
    if (!shot) {
      const err = new Error(`Shot ${shotId} not found`);
      err.code = 'SHOT_NOT_FOUND';
      throw err;
    }

    const scene = (storyPlan.scenes || []).find(s => s.id === shot.sceneId) || {};
    const charsInShot = (storyPlan.characters || []).filter(c => (shot.characters || []).includes(c.id));
    const characterAssets = visualAssetStore.getAssetsByStory(storyId).filter(a => a.type === 'character_reference');

    const { prompt, negativePrompt } = ShotPromptBuilder.build(shot, scene, charsInShot);

    const provider = imageProviderRegistry.get(preferredProvider || process.env.IMAGE_PROVIDER || 'google-imagen') || imageProviderRegistry.getDefault();
    const capabilities = provider.getCapabilities();

    const request = CharacterConsistencyStrategy.buildConsistentRequest({
      prompt,
      negativePrompt,
      characters: charsInShot,
      characterAssets,
      providerCapabilities: capabilities,
      aspectRatio: '9:16'
    });

    const genResult = await imageProviderRegistry.generateWithFallback({
      ...request,
      preferredProvider,
      metadata: {
        ...request.metadata,
        storyId,
        shotId,
        sceneId: shot.sceneId
      }
    });

    if (!genResult.success) {
      const failedAsset = visualAssetStore.saveAsset({
        storyId,
        type: 'shot_visual',
        targetId: shotId,
        status: 'failed',
        prompt,
        negativePrompt,
        error: genResult.error
      });
      const err = new Error(genResult.error?.message || 'Shot visual generation failed');
      err.code = genResult.error?.code || 'IMAGE_GENERATION_FAILED';
      throw err;
    }

    const savedAsset = visualAssetStore.saveAsset({
      assetId: genResult.assetId,
      storyId,
      type: 'shot_visual',
      targetId: shotId,
      status: 'ready',
      filePath: genResult.filePath,
      imageUrl: genResult.url,
      provider: genResult.actualProvider,
      requestedProvider: genResult.requestedProvider,
      actualProvider: genResult.actualProvider,
      fallbackUsed: genResult.fallbackUsed,
      fallbackReason: genResult.fallbackReason,
      seed: genResult.seed,
      prompt,
      negativePrompt,
      width: genResult.width,
      height: genResult.height,
      metadata: {
        shotType: shot.shotType,
        camera: shot.camera,
        charactersInvolved: charsInShot.map(c => c.id)
      }
    });

    return savedAsset;
  }

  _updateCharacterReferenceInStoryPlan(storyPlan, characterId, updates) {
    if (!storyPlan.characterReferences) {
      storyPlan.characterReferences = [];
    }

    let ref = storyPlan.characterReferences.find(r => r.characterId === characterId);
    if (!ref) {
      ref = { characterId };
      storyPlan.characterReferences.push(ref);
    }

    Object.assign(ref, updates, { updatedAt: new Date().toISOString() });

    // Also update character object avatarUrl / referenceId for convenience
    const character = (storyPlan.characters || []).find(c => c.id === characterId);
    if (character) {
      if (updates.imageUrl) character.avatarUrl = updates.imageUrl;
      if (updates.referenceId) character.referenceId = updates.referenceId;
    }

    storyPlanStore.save(storyPlan);
  }
}

const visualGenerationService = new VisualGenerationService();

module.exports = {
  VisualGenerationService,
  visualGenerationService
};
