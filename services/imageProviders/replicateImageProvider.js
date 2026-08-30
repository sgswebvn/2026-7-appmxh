const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseImageProvider = require('./baseImageProvider');

class ReplicateImageProvider extends BaseImageProvider {
  constructor(config = {}) {
    super('replicate', 'Replicate AI (Flux / SDXL / IP-Adapter)', config);
    this.apiToken = config.apiToken || process.env.REPLICATE_API_TOKEN || '';
    this.model = config.model || process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-schnell';
  }

  validateConfig() {
    if (!this.apiToken || this.apiToken.length < 8) {
      return { valid: false, error: 'IMAGE_PROVIDER_NOT_CONFIGURED: Missing REPLICATE_API_TOKEN' };
    }
    return { valid: true };
  }

  async getStatus() {
    const valid = this.validateConfig();
    if (!valid.valid) {
      return { available: false, status: 'NOT_CONFIGURED', message: valid.error };
    }
    return { available: true, status: 'READY', message: `Replicate ready with model ${this.model}` };
  }

  getCapabilities() {
    return {
      referenceImage: true,
      seed: true,
      ipAdapter: true,
      lora: true,
      aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4'],
      maxResolution: { width: 1440, height: 1440 }
    };
  }

  async generateImage(request) {
    const configCheck = this.validateConfig();
    if (!configCheck.valid) {
      return {
        success: false,
        provider: this.id,
        error: {
          code: 'IMAGE_PROVIDER_NOT_CONFIGURED',
          message: 'Replicate API token is not configured.'
        }
      };
    }

    const { prompt, aspectRatio = '9:16', seed } = request;
    const assetId = `img_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${assetId}.png`;
    const filePath = path.join(outputDir, filename);
    const relativeUrl = `/uploads/visual-assets/${filename}`;

    try {
      // 1. Create prediction on Replicate
      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({
          version: this.model,
          input: {
            prompt,
            aspect_ratio: aspectRatio === '9:16' ? '9:16' : aspectRatio === '16:9' ? '16:9' : '1:1',
            output_format: 'png',
            seed: seed || undefined
          }
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            provider: this.id,
            error: { code: 'IMAGE_PROVIDER_AUTH_FAILED', message: `Replicate auth failed: ${errorText}` }
          };
        }
        if (res.status === 429) {
          return {
            success: false,
            provider: this.id,
            error: { code: 'IMAGE_PROVIDER_RATE_LIMITED', message: `Replicate rate limited: ${errorText}` }
          };
        }
        return {
          success: false,
          provider: this.id,
          error: { code: 'IMAGE_GENERATION_FAILED', message: `Replicate error (${res.status}): ${errorText}` }
        };
      }

      const prediction = await res.json();
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      if (!outputUrl) {
        return {
          success: false,
          provider: this.id,
          error: { code: 'IMAGE_GENERATION_FAILED', message: 'No output URL returned from Replicate' }
        };
      }

      // Download the generated image file
      const imgRes = await fetch(outputUrl);
      if (!imgRes.ok) {
        return {
          success: false,
          provider: this.id,
          error: { code: 'IMAGE_GENERATION_FAILED', message: 'Failed to download output image from Replicate' }
        };
      }

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        provider: this.id,
        assetId,
        filePath,
        url: relativeUrl,
        width: aspectRatio === '9:16' ? 768 : 1024,
        height: aspectRatio === '9:16' ? 1344 : 1024,
        seed: seed || Math.floor(Math.random() * 1000000),
        metadata: {
          model: this.model,
          aspectRatio,
          characterReferenceId: request.characterReferenceId || null
        }
      };
    } catch (err) {
      return {
        success: false,
        provider: this.id,
        error: {
          code: 'IMAGE_GENERATION_FAILED',
          message: `Network error calling Replicate: ${err.message}`
        }
      };
    }
  }
}

module.exports = ReplicateImageProvider;
