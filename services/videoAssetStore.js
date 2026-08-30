const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), 'video-assets.json')
  : path.join(__dirname, '..', 'data', 'video-assets.json');

const VIDEO_ASSETS_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads', 'video-assets')
  : path.join(__dirname, '..', 'public', 'uploads', 'video-assets');

class VideoAssetStore {
  constructor(customDataFile, customAssetsDir) {
    this.dataFile = customDataFile || DATA_FILE;
    this.assetsDir = customAssetsDir || VIDEO_ASSETS_DIR;
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
      console.warn('Error reading video-assets.json:', err.message);
      return {};
    }
  }

  saveAll(data) {
    try {
      this.ensureDir();
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing video-assets.json:', err.message);
    }
  }

  saveAsset(asset) {
    if (!asset || !asset.assetId) {
      throw new Error('Cannot save video asset without assetId.');
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

  getStoryVideoAssets(storyId) {
    if (!storyId) return [];
    const all = this.loadAll();
    return Object.values(all).filter(a => a.storyId === storyId);
  }

  getShotVideoAsset(storyId, shotId) {
    const all = this.loadAll();
    const matches = Object.values(all).filter(
      a => a.storyId === storyId && a.type === 'shot_video' && a.targetId === shotId && a.status === 'ready'
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return matches[0];
  }

  getMasterVideoAsset(storyId) {
    const all = this.loadAll();
    const matches = Object.values(all).filter(
      a => a.storyId === storyId && a.type === 'master_video' && a.status === 'ready'
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    return matches[0];
  }
}

const defaultVideoAssetStore = new VideoAssetStore();

module.exports = {
  VideoAssetStore,
  videoAssetStore: defaultVideoAssetStore,
  VIDEO_ASSETS_DIR
};
