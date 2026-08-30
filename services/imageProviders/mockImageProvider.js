const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseImageProvider = require('./baseImageProvider');

class MockImageProvider extends BaseImageProvider {
  constructor(config = {}) {
    super('mock-test-provider', 'Deterministic Mock Image Generator (Test & CI Only)', config);
    this.shouldFail = config.shouldFail || false;
    this.failReason = config.failReason || 'MOCK_ERROR';
    this.quotaExceeded = config.quotaExceeded || false;
  }

  validateConfig() {
    return { valid: true };
  }

  async getStatus() {
    return {
      available: !this.shouldFail && !this.quotaExceeded,
      status: this.quotaExceeded ? 'QUOTA_EXCEEDED' : this.shouldFail ? 'ERROR' : 'READY',
      message: 'Deterministic mock image provider for offline testing'
    };
  }

  getCapabilities() {
    return {
      referenceImage: true,
      seed: true,
      ipAdapter: true,
      lora: true,
      aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4'],
      maxResolution: { width: 1024, height: 1792 }
    };
  }

  async generateImage(request) {
    if (this.quotaExceeded) {
      return {
        success: false,
        provider: this.id,
        error: {
          code: 'IMAGE_PROVIDER_QUOTA_EXCEEDED',
          message: 'Mock provider quota exhausted simulation.'
        }
      };
    }

    if (this.shouldFail) {
      return {
        success: false,
        provider: this.id,
        error: {
          code: 'IMAGE_GENERATION_FAILED',
          message: `Mock provider failed as requested: ${this.failReason}`
        }
      };
    }

    const { prompt, aspectRatio = '9:16', seed = 12345, characterReferenceId } = request;
    const assetId = `img_mock_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${assetId}.png`;
    const filePath = path.join(outputDir, filename);
    const relativeUrl = `/uploads/visual-assets/${filename}`;

    // 1x1 transparent PNG fallback buffer
    const minimalPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(filePath, minimalPngBuffer);

    return {
      success: true,
      provider: this.id,
      assetId,
      filePath,
      url: relativeUrl,
      width: aspectRatio === '9:16' ? 768 : 1024,
      height: aspectRatio === '9:16' ? 1344 : 1024,
      seed: seed || 12345,
      metadata: {
        isMock: true,
        aspectRatio,
        characterReferenceId: characterReferenceId || null,
        promptExcerpt: (prompt || '').slice(0, 80)
      }
    };
  }
}

module.exports = MockImageProvider;
