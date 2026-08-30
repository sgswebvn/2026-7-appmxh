/**
 * Base Image Provider Abstract Class
 * Canonical interface for all AI image generation providers (Google, Replicate, Stability, Local, etc.)
 */
class BaseImageProvider {
  constructor(id, name, config = {}) {
    if (new.target === BaseImageProvider) {
      throw new TypeError('Cannot construct BaseImageProvider instances directly');
    }
    this.id = id;
    this.name = name;
    this.config = config;
  }

  /**
   * Validate provider configuration and credentials
   * @returns {{ valid: boolean, error?: string }}
   */
  validateConfig() {
    throw new Error('validateConfig() must be implemented by subclass');
  }

  /**
   * Get provider status and health
   * @returns {Promise<{ available: boolean, status: string, message?: string }>}
   */
  async getStatus() {
    throw new Error('getStatus() must be implemented by subclass');
  }

  /**
   * Get provider capabilities
   * @returns {{ referenceImage: boolean, seed: boolean, ipAdapter: boolean, lora: boolean, aspectRatios: string[], maxResolution: { width: number, height: number } }}
   */
  getCapabilities() {
    return {
      referenceImage: false,
      seed: true,
      ipAdapter: false,
      lora: false,
      aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4'],
      maxResolution: { width: 1024, height: 1792 }
    };
  }

  /**
   * Generate an image from a structured request
   * @param {Object} request
   * @param {string} request.prompt - Text prompt
   * @param {string} [request.negativePrompt] - Negative prompt
   * @param {number} [request.width=1024]
   * @param {number} [request.height=1024]
   * @param {string} [request.aspectRatio='9:16']
   * @param {number} [request.seed]
   * @param {Array<string>} [request.referenceImages] - Paths or URLs of reference images
   * @param {string} [request.characterReferenceId]
   * @param {Object} [request.metadata]
   * @returns {Promise<{
   *   success: boolean,
   *   provider: string,
   *   assetId: string,
   *   filePath: string,
   *   url: string,
   *   width: number,
   *   height: number,
   *   seed?: number,
   *   metadata?: Object,
   *   error?: { code: string, message: string, details?: any }
   * }>}
   */
  async generateImage(request) {
    throw new Error('generateImage() must be implemented by subclass');
  }
}

module.exports = BaseImageProvider;
