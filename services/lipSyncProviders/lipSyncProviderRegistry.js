const ReplicateLipSyncProvider = require('./replicateLipSyncProvider');
const MockLipSyncProvider = require('./mockLipSyncProvider');

/**
 * Lip-Sync Provider Registry & Dynamic Fallback Manager
 */
class LipSyncProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initDefaultProviders();
  }

  initDefaultProviders() {
    this.register(new ReplicateLipSyncProvider());
    this.register(new MockLipSyncProvider());
  }

  register(provider) {
    if (!provider || !provider.id) {
      throw new Error('Cannot register lip-sync provider without a valid id.');
    }
    this.providers.set(provider.id, provider);
  }

  get(providerId) {
    return this.providers.get(providerId) || null;
  }

  async list() {
    const list = [];
    for (const [id, provider] of this.providers.entries()) {
      const status = await provider.getStatus();
      list.push({
        id,
        name: provider.name,
        ready: status.ready,
        details: status.details
      });
    }
    return list;
  }

  getDefaultProviderId() {
    return process.env.LIPSYNC_PROVIDER || 'replicate-lipsync';
  }

  getFallbackChain(primaryId) {
    const envFallbacks = process.env.LIPSYNC_PROVIDER_FALLBACKS;
    if (envFallbacks) {
      const list = envFallbacks.split(',').map(s => s.trim()).filter(Boolean);
      return [primaryId, ...list.filter(id => id !== primaryId)];
    }
    return [primaryId];
  }

  async generateWithFallback(options = {}) {
    const primaryId = options.preferredProvider || this.getDefaultProviderId();
    const chain = this.getFallbackChain(primaryId);

    let lastError = null;
    let fallbackUsed = false;
    let fallbackReason = null;

    for (const providerId of chain) {
      if (providerId === 'mock-test-lipsync-provider') {
        const allowMock = options.preferredProvider === 'mock-test-lipsync-provider' || process.env.ALLOW_MOCK_LIPSYNC === 'true';
        if (!allowMock) continue;
      }

      const provider = this.get(providerId);
      if (!provider) continue;

      const status = await provider.getStatus();
      if (!status.ready) {
        if (!fallbackReason) fallbackReason = `${providerId}: Provider not ready (${status.details})`;
        lastError = { code: 'LIPSYNC_PROVIDER_NOT_CONFIGURED', message: status.details };
        continue;
      }

      try {
        const result = await provider.generateLipSync(options);
        if (result && result.success) {
          return {
            success: true,
            videoBuffer: result.videoBuffer,
            videoPath: result.videoPath,
            videoUrl: result.videoUrl,
            durationMs: result.durationMs,
            requestedProvider: primaryId,
            actualProvider: providerId,
            fallbackUsed,
            fallbackReason,
            isMock: result.isMock || false
          };
        }

        const errMsg = result?.error?.message || 'Lip-sync returned unsuccessful status';
        lastError = result?.error || { code: 'LIPSYNC_FAILED', message: errMsg };
        if (!fallbackReason) {
          fallbackReason = `${providerId} failed: ${lastError.code || errMsg}`;
        }
        fallbackUsed = true;
        console.warn(`[LipSync Provider] ${providerId} failed: ${lastError.code || errMsg}. Trying next in fallback chain...`);
      } catch (err) {
        lastError = { code: 'LIPSYNC_EXCEPTION', message: err.message };
        if (!fallbackReason) {
          fallbackReason = `${providerId} threw exception: ${err.message}`;
        }
        fallbackUsed = true;
        console.warn(`[LipSync Provider] ${providerId} threw exception: ${err.message}. Trying next...`);
      }
    }

    return {
      success: false,
      requestedProvider: primaryId,
      actualProvider: null,
      fallbackUsed,
      fallbackReason,
      error: {
        code: 'LIPSYNC_UNAVAILABLE',
        message: `Tất cả các Lip-Sync Providers (${chain.join(' -> ')}) đều không khả dụng. Lý do: ${fallbackReason || lastError?.message || 'Chưa cấu hình API Key'}`
      }
    };
  }
}

const defaultLipSyncRegistry = new LipSyncProviderRegistry();

module.exports = {
  LipSyncProviderRegistry,
  lipSyncProviderRegistry: defaultLipSyncRegistry
};
