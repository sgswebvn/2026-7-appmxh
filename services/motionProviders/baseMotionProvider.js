/**
 * Abstract Base Motion Provider (Phase 3D)
 */
class BaseMotionProvider {
  constructor(config = {}) {
    this.config = config;
    this.id = 'base-motion-provider';
    this.name = 'Base Motion Provider';
  }

  /**
   * Generate motion / camera movement clip from an image asset
   * @param {Object} options
   * @param {string} options.imagePath - Path to source image (character reference or scene visual)
   * @param {string} options.cameraMotion - 'push_in' | 'pull_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'subtle_hover'
   * @param {string} [options.shotType] - 'close-up' | 'two-shot' | 'medium-shot'
   * @param {number} options.durationMs - Duration in milliseconds
   * @param {number} [options.fps=30] - Frame rate
   * @returns {Promise<{ success: boolean, videoBuffer?: Buffer, videoPath?: string, videoUrl?: string, durationMs?: number, provider: string, error?: Object }>}
   */
  async generateMotion(options) {
    throw new Error('BaseMotionProvider.generateMotion() must be implemented by subclass.');
  }

  async getStatus() {
    const check = this.validateConfig();
    return {
      ready: check.valid,
      name: this.name,
      details: check.valid ? 'Ready' : check.error
    };
  }

  validateConfig() {
    return { valid: true };
  }
}

module.exports = BaseMotionProvider;
