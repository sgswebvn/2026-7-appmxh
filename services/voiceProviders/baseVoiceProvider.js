/**
 * Abstract Base Voice Provider (Phase 3C)
 */
class BaseVoiceProvider {
  constructor(config = {}) {
    this.config = config;
    this.id = 'base-voice-provider';
    this.name = 'Base Voice Provider';
  }

  /**
   * Synthesize speech for a single text utterance
   * @param {Object} options
   * @param {string} options.text - Text to speak
   * @param {string} options.voiceId - Voice identifier
   * @param {string} [options.gender] - 'male' | 'female'
   * @param {number} [options.age] - Age of character
   * @param {string} [options.emotion] - Emotional delivery
   * @param {string} [options.speed] - Rate adjustment e.g. '+0%', '-10%'
   * @param {string} [options.pitch] - Pitch adjustment e.g. '+0Hz', '-10Hz'
   * @returns {Promise<{ success: boolean, audioBuffer?: Buffer, format: string, durationMs?: number, provider: string, error?: Object }>}
   */
  async synthesize(options) {
    throw new Error('BaseVoiceProvider.synthesize() must be implemented by subclass.');
  }

  /**
   * Health and availability check
   * @returns {Promise<{ ready: boolean, name: string, details?: string }>}
   */
  async getStatus() {
    const configCheck = this.validateConfig();
    return {
      ready: configCheck.valid,
      name: this.name,
      details: configCheck.valid ? 'Ready' : configCheck.error
    };
  }

  /**
   * Validate configuration
   * @returns {{ valid: boolean, error?: string }}
   */
  validateConfig() {
    return { valid: true };
  }

  /**
   * Get available voices
   * @returns {Array<{ id: string, name: string, gender: string, lang: string, ageRange?: string }>}
   */
  getAvailableVoices() {
    return [];
  }
}

module.exports = BaseVoiceProvider;
