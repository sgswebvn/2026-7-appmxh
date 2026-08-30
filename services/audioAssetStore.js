const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), 'audio-assets.json')
  : path.join(__dirname, '..', 'data', 'audio-assets.json');

const AUDIO_ASSETS_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads', 'audio-assets')
  : path.join(__dirname, '..', 'public', 'uploads', 'audio-assets');

class AudioAssetStore {
  constructor(customDataFile, customAssetsDir) {
    this.dataFile = customDataFile || DATA_FILE;
    this.assetsDir = customAssetsDir || AUDIO_ASSETS_DIR;
    this.ensureDir();
  }

  ensureDir() {
    try {
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      if (!fs.existsSync(this.assetsDir)) fs.mkdirSync(this.assetsDir, { recursive: true });
    } catch (e) {}
  }

  loadAll() {
    try {
      if (!fs.existsSync(this.dataFile)) return {};
      const raw = fs.readFileSync(this.dataFile, 'utf8');
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.warn('Error reading audio-assets.json:', err.message);
      return {};
    }
  }

  saveAll(data) {
    try {
      this.ensureDir();
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing audio-assets.json:', err.message);
    }
  }

  saveAsset(asset) {
    if (!asset || !asset.assetId) {
      throw new Error('Cannot save audio asset without assetId.');
    }
    const all = this.loadAll();
    all[asset.assetId] = {
      ...asset,
      updatedAt: new Date().toISOString()
    };
    this.saveAll(all);
    return all[asset.assetId];
  }

  getAsset(assetId) {
    if (!assetId) return null;
    const all = this.loadAll();
    return all[assetId] || null;
  }

  getStoryAudioAssets(storyId) {
    if (!storyId) return [];
    const all = this.loadAll();
    return Object.values(all).filter(a => a.storyId === storyId);
  }

  getDialogueAsset(storyId, dialogueId) {
    const all = this.loadAll();
    const matches = Object.values(all).filter(
      a => a.storyId === storyId && a.type === 'dialogue_audio' && a.targetId === dialogueId && a.status === 'ready'
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return matches[0];
  }

  getMasterAudioAsset(storyId) {
    const all = this.loadAll();
    const matches = Object.values(all).filter(
      a => a.storyId === storyId && a.type === 'master_audio' && a.status === 'ready'
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return matches[0];
  }
}

const defaultAudioAssetStore = new AudioAssetStore();

module.exports = {
  AudioAssetStore,
  audioAssetStore: defaultAudioAssetStore,
  AUDIO_ASSETS_DIR
};
