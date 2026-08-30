const KenBurnsMotionProvider = require('./kenBurnsMotionProvider');
const MockMotionProvider = require('./mockMotionProvider');

/**
 * Motion Provider Registry & Fallback Manager
 */
class MotionProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initDefaultProviders();
  }

  initDefaultProviders() {
    this.register(new KenBurnsMotionProvider());
    this.register(new MockMotionProvider());
  }

  register(provider) {
    if (!provider || !provider.id) {
      throw new Error('Cannot register motion provider without a valid id.');
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
    return process.env.MOTION_PROVIDER || 'ken-burns-motion';
  }

  getFallbackChain(primaryId) {
    const envFallbacks = process.env.MOTION_PROVIDER_FALLBACKS;
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
      if (providerId === 'mock-test-motion-provider' && options.preferredProvider !== 'mock-test-motion-provider' && process.env.ALLOW_MOCK_MOTION !== 'true') {
        continue;
      }

      const provider = this.get(providerId);
      if (!provider) continue;

      const status = await provider.getStatus();
      if (!status.ready) {
        if (!fallbackReason) fallbackReason = `${providerId}: Provider not ready (${status.details})`;
        continue;
      }

      try {
        const result = await provider.generateMotion(options);
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

        const errMsg = result?.error?.message || 'Motion returned unsuccessful status';
        lastError = result?.error || { code: 'MOTION_FAILED', message: errMsg };
        if (!fallbackReason) {
          fallbackReason = `${providerId} failed: ${lastError.code || errMsg}`;
        }
        fallbackUsed = true;
      } catch (err) {
        lastError = { code: 'MOTION_EXCEPTION', message: err.message };
        if (!fallbackReason) {
          fallbackReason = `${providerId} threw exception: ${err.message}`;
        }
        fallbackUsed = true;
      }
    }

    return {
      success: false,
      requestedProvider: primaryId,
      actualProvider: null,
      fallbackUsed,
      fallbackReason,
      error: {
        code: 'MOTION_UNAVAILABLE',
        message: `Tất cả các Motion Providers (${chain.join(' -> ')}) đều không khả dụng. Lý do: ${fallbackReason || lastError?.message || 'Lỗi xử lý motion'}`
      }
    };
  }
}

const defaultMotionRegistry = new MotionProviderRegistry();

module.exports = {
  MotionProviderRegistry,
  motionProviderRegistry: defaultMotionRegistry
};
