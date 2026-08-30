/**
 * Abstract Base Lip-Sync Provider (Phase 3D)
 */
class BaseLipSyncProvider {
  constructor(config = {}) {
    this.config = config;
    this.id = 'base-lipsync-provider';
    this.name = 'Base Lip-Sync Provider';
  }

  /**
   * Synthesize talking character video from face image and dialogue audio
   * @param {Object} options
   * @param {string} options.faceImagePath - Path or URL to character reference image / video
   * @param {string} options.audioPath - Path to dialogue audio chunk MP3/WAV
   * @param {number} options.durationMs - Expected duration in milliseconds
   * @param {string} [options.characterId] - ID of speaking character
   * @param {string} [options.emotion] - Emotional delivery
   * @returns {Promise<{ success: boolean, videoBuffer?: Buffer, videoPath?: string, videoUrl?: string, durationMs?: number, provider: string, error?: Object }>}
   */
  async generateLipSync(options) {
    throw new Error('BaseLipSyncProvider.generateLipSync() must be implemented by subclass.');
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
}

module.exports = BaseLipSyncProvider;
