const GoogleImageProvider = require('./googleImageProvider');
const ReplicateImageProvider = require('./replicateImageProvider');
const MockImageProvider = require('./mockImageProvider');

class ImageProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initDefaultProviders();
  }

  initDefaultProviders() {
    // 1. Register Google Imagen
    this.register(new GoogleImageProvider());
    // 2. Register Replicate
    this.register(new ReplicateImageProvider());
    // 3. Register Mock Provider for testing
    this.register(new MockImageProvider());
  }

  /**
   * Register an image provider
   * @param {import('./baseImageProvider')} provider
   */
  register(provider) {
    if (!provider || !provider.id) {
      throw new Error('Provider must have an id');
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * Get provider by ID
   * @param {string} providerId
   * @returns {import('./baseImageProvider')|null}
   */
  get(providerId) {
    return this.providers.get(providerId) || null;
  }

  /**
   * List all registered providers with status & capabilities
   */
  async list() {
    const list = [];
    for (const [id, provider] of this.providers.entries()) {
      const status = await provider.getStatus();
      const capabilities = provider.getCapabilities();
      list.push({
        id,
        name: provider.name,
        status: status.status,
        available: status.available,
        message: status.message,
        capabilities
      });
    }
    return list;
  }

  /**
   * Get the primary default provider from environment
   * @returns {import('./baseImageProvider')}
   */
  getDefault() {
    const preferredId = process.env.IMAGE_PROVIDER || 'google-imagen';
    const provider = this.get(preferredId);
    if (provider) return provider;

    // Fallback to first available provider
    for (const p of this.providers.values()) {
      return p;
    }
    throw new Error('No image providers registered in registry');
  }

  /**
   * Health check all registered providers
   */
  async healthCheck() {
    const health = {};
    for (const [id, provider] of this.providers.entries()) {
      health[id] = await provider.getStatus();
    }
    return health;
  }

  /**
   * Generate an image with structured fallback support
   * @param {Object} request
   * @param {string} [request.preferredProvider]
   * @returns {Promise<{
   *   success: boolean,
   *   requestedProvider: string,
   *   actualProvider: string,
   *   fallbackUsed: boolean,
   *   fallbackReason: string|null,
   *   assetId?: string,
   *   filePath?: string,
   *   url?: string,
   *   width?: number,
   *   height?: number,
   *   seed?: number,
   *   metadata?: Object,
   *   error?: { code: string, message: string }
   * }>}
   */
  async generateWithFallback(request) {
    const requestedProviderId = request.preferredProvider || process.env.IMAGE_PROVIDER || 'google-imagen';
    
    // Parse fallback chain from env or defaults
    const fallbackEnv = process.env.IMAGE_PROVIDER_FALLBACKS || '';
    const fallbackIds = fallbackEnv
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Build chain: requested -> env fallbacks -> all other providers in registry
    const providerChain = [requestedProviderId];
    for (const fb of fallbackIds) {
      if (!providerChain.includes(fb)) providerChain.push(fb);
    }
    for (const id of this.providers.keys()) {
      if (!providerChain.includes(id) && id !== 'mock-test-provider') {
        providerChain.push(id);
      }
    }

    let lastError = null;
    let fallbackReason = null;
    let attemptCount = 0;

    for (const providerId of providerChain) {
      const provider = this.get(providerId);
      if (!provider) continue;

      attemptCount++;
      const isFallback = providerId !== requestedProviderId;

      try {
        const result = await provider.generateImage(request);
        if (result.success) {
          return {
            ...result,
            requestedProvider: requestedProviderId,
            actualProvider: providerId,
            fallbackUsed: isFallback,
            fallbackReason: isFallback ? fallbackReason || 'PRIMARY_PROVIDER_FAILED' : null
          };
        } else {
          lastError = result.error;
          fallbackReason = result.error?.code || result.error?.message || 'GENERATION_FAILED';
          console.warn(`[Image Provider] ${providerId} failed: ${fallbackReason}. Attempting fallback...`);
        }
      } catch (err) {
        lastError = { code: 'IMAGE_GENERATION_FAILED', message: err.message };
        fallbackReason = err.message;
        console.warn(`[Image Provider] ${providerId} thrown error: ${err.message}`);
      }
    }

    return {
      success: false,
      requestedProvider: requestedProviderId,
      actualProvider: null,
      fallbackUsed: attemptCount > 1,
      fallbackReason,
      error: lastError || {
        code: 'IMAGE_GENERATION_UNAVAILABLE',
        message: 'No image providers were able to fulfill the request.'
      }
    };
  }
}

// Global Singleton Registry
const registry = new ImageProviderRegistry();

module.exports = {
  ImageProviderRegistry,
  imageProviderRegistry: registry
};
