const EdgeTTSProvider = require('./edgeTtsProvider');
const GoogleTTSProvider = require('./googleTtsProvider');
const MockVoiceProvider = require('./mockVoiceProvider');

/**
 * Voice Provider Registry & Dynamic Fallback Execution Layer
 */
class VoiceProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initDefaultProviders();
  }

  initDefaultProviders() {
    this.register(new EdgeTTSProvider());
    this.register(new GoogleTTSProvider());
    this.register(new MockVoiceProvider());
  }

  register(provider) {
    if (!provider || !provider.id) {
      throw new Error('Cannot register voice provider without a valid id.');
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
        details: status.details,
        voices: provider.getAvailableVoices()
      });
    }
    return list;
  }

  getDefaultProviderId() {
    return process.env.VOICE_PROVIDER || 'edge-tts';
  }

  getFallbackChain(primaryId) {
    const envFallbacks = process.env.VOICE_PROVIDER_FALLBACKS;
    if (envFallbacks) {
      const list = envFallbacks.split(',').map(s => s.trim()).filter(Boolean);
      return [primaryId, ...list.filter(id => id !== primaryId)];
    }

    // Default production fallback order: edge-tts -> google-tts
    if (primaryId === 'edge-tts') {
      return ['edge-tts', 'google-tts'];
    } else if (primaryId === 'google-tts') {
      return ['google-tts', 'edge-tts'];
    }
    return [primaryId, 'edge-tts', 'google-tts'];
  }

  /**
   * Synthesize with provider fallback and audit trail
   */
  async synthesizeWithFallback(options = {}) {
    const primaryId = options.preferredProvider || this.getDefaultProviderId();
    const chain = this.getFallbackChain(primaryId);

    let lastError = null;
    let fallbackUsed = false;
    let fallbackReason = null;

    for (const providerId of chain) {
      // Security rule: never silently invoke mock provider unless requested or in explicit test mode
      if (providerId === 'mock-test-voice-provider' && options.preferredProvider !== 'mock-test-voice-provider' && process.env.ALLOW_MOCK_VOICE !== 'true') {
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
        const result = await provider.synthesize(options);
        if (result && result.success && result.audioBuffer && result.audioBuffer.length > 0) {
          return {
            success: true,
            audioBuffer: result.audioBuffer,
            format: result.format || 'mp3',
            requestedProvider: primaryId,
            actualProvider: providerId,
            fallbackUsed,
            fallbackReason,
            isMock: result.isMock || false
          };
        }

        const errMsg = result?.error?.message || 'Synthesis returned unsuccessful status';
        lastError = result?.error || { code: 'VOICE_SYNTHESIS_FAILED', message: errMsg };
        if (!fallbackReason) {
          fallbackReason = `${providerId} failed: ${lastError.code || errMsg}`;
        }
        fallbackUsed = true;
        console.warn(`[Voice Provider] ${providerId} failed: ${lastError.code || errMsg}. Trying next in fallback chain...`);
      } catch (err) {
        lastError = { code: 'VOICE_PROVIDER_EXCEPTION', message: err.message };
        if (!fallbackReason) {
          fallbackReason = `${providerId} threw exception: ${err.message}`;
        }
        fallbackUsed = true;
        console.warn(`[Voice Provider] ${providerId} threw exception: ${err.message}. Trying next...`);
      }
    }

    return {
      success: false,
      requestedProvider: primaryId,
      actualProvider: null,
      fallbackUsed,
      fallbackReason,
      error: {
        code: 'VOICE_GENERATION_UNAVAILABLE',
        message: `Tất cả các Voice Providers trong chuỗi (${chain.join(' -> ')}) đều không khả dụng. Lý do: ${fallbackReason || lastError?.message || 'Không rõ nguyên nhân'}`
      }
    };
  }
}

const defaultVoiceRegistry = new VoiceProviderRegistry();

module.exports = {
  VoiceProviderRegistry,
  defaultVoiceRegistry
};
