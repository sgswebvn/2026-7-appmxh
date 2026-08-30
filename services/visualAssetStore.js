const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class VisualAssetStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'data', 'visual-assets.json');
    this.ensureDataDir();
  }

  ensureDataDir() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({}, null, 2), 'utf-8');
    }
  }

  loadAll() {
    try {
      this.ensureDataDir();
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content || '{}');
    } catch (e) {
      console.error('[VisualAssetStore] Error reading assets:', e);
      return {};
    }
  }

  saveAll(data) {
    try {
      this.ensureDataDir();
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[VisualAssetStore] Error saving assets:', e);
    }
  }

  /**
   * Save or create a new visual asset record
   * @param {Object} asset
   * @returns {Object} saved asset
   */
  saveAsset(asset) {
    const all = this.loadAll();
    const assetId = asset.assetId || `ast_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const record = {
      assetId,
      storyId: asset.storyId || '',
      type: asset.type || 'character_reference', // character_reference | scene_visual | shot_visual
      targetId: asset.targetId || '', // charId, sceneId, or shotId
      status: asset.status || 'ready', // pending | generating | ready | failed
      filePath: asset.filePath || '',
      imageUrl: asset.imageUrl || asset.url || '',
      provider: asset.provider || '',
      requestedProvider: asset.requestedProvider || asset.provider || '',
      actualProvider: asset.actualProvider || asset.provider || '',
      fallbackUsed: Boolean(asset.fallbackUsed),
      fallbackReason: asset.fallbackReason || null,
      seed: asset.seed ?? null,
      prompt: asset.prompt || '',
      negativePrompt: asset.negativePrompt || '',
      width: asset.width || 0,
      height: asset.height || 0,
      createdAt: asset.createdAt || now,
      updatedAt: now,
      metadata: asset.metadata || {},
      error: asset.error || null
    };

    all[assetId] = record;
    this.saveAll(all);
    return record;
  }

  /**
   * Get an asset by its ID
   * @param {string} assetId
   * @returns {Object|null}
   */
  getAsset(assetId) {
    const all = this.loadAll();
    return all[assetId] || null;
  }

  /**
   * Get all assets for a given story
   * @param {string} storyId
   * @returns {Array<Object>}
   */
  getAssetsByStory(storyId) {
    const all = this.loadAll();
    return Object.values(all).filter(a => a.storyId === storyId);
  }

  /**
   * Get character reference asset (most recent ready)
   * @param {string} storyId
   * @param {string} charId
   * @returns {Object|null}
   */
  getCharacterReferenceAsset(storyId, charId) {
    const all = this.loadAll();
    const matches = Object.values(all).filter(
      a => a.storyId === storyId && a.type === 'character_reference' && a.targetId === charId && a.status === 'ready'
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return matches[0];
  }


  /**
   * Update asset status
   * @param {string} assetId
   * @param {string} status
   * @param {Object} [updates]
   */
  updateAssetStatus(assetId, status, updates = {}) {
    const all = this.loadAll();
    if (!all[assetId]) return null;

    all[assetId].status = status;
    all[assetId].updatedAt = new Date().toISOString();
    Object.assign(all[assetId], updates);

    this.saveAll(all);
    return all[assetId];
  }

  /**
   * Remove asset
   * @param {string} assetId
   */
  removeAsset(assetId) {
    const all = this.loadAll();
    if (all[assetId]) {
      delete all[assetId];
      this.saveAll(all);
      return true;
    }
    return false;
  }
}

// Singleton export
const visualAssetStore = new VisualAssetStore();

module.exports = {
  VisualAssetStore,
  visualAssetStore
};
