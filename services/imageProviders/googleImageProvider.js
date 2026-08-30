const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseImageProvider = require('./baseImageProvider');

class GoogleImageProvider extends BaseImageProvider {
  constructor(config = {}) {
    super('google-imagen', 'Google Imagen 3 / Gemini Visual', config);
    this.apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
    this.modelName = config.modelName || process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
  }

  validateConfig() {
    if (!this.apiKey || this.apiKey.length < 10) {
      return { valid: false, error: 'IMAGE_PROVIDER_NOT_CONFIGURED: Missing Google API key (GEMINI_API_KEY or GOOGLE_AI_API_KEY)' };
    }
    return { valid: true };
  }

  async getStatus() {
    const valid = this.validateConfig();
    if (!valid.valid) {
      return { available: false, status: 'NOT_CONFIGURED', message: valid.error };
    }
    return { available: true, status: 'READY', message: `Google Imagen ready with model ${this.modelName}` };
  }

  getCapabilities() {
    return {
      referenceImage: true,
      seed: true,
      ipAdapter: false,
      lora: false,
      aspectRatios: ['1:1', '9:16', '16:9', '4:3', '3:4'],
      maxResolution: { width: 1536, height: 1536 }
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
          message: 'Google Imagen API key is not configured.'
        }
      };
    }

    const { prompt, negativePrompt, aspectRatio = '9:16', seed } = request;
    const assetId = `img_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${assetId}.png`;
    const filePath = path.join(outputDir, filename);
    const relativeUrl = `/uploads/visual-assets/${filename}`;

    try {
      // 1. Try Google Generative AI Imagen API endpoint
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:predict?key=${this.apiKey}`;
      const payload = {
        instances: [{ prompt: prompt + (negativePrompt ? ` (Negative: ${negativePrompt})` : '') }],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio === '9:16' ? '9:16' : aspectRatio === '16:9' ? '16:9' : '1:1',
          outputMimeType: 'image/png'
        }
      };

      if (seed) {
        payload.parameters.seed = seed;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        let parsedError = {};
        try { parsedError = JSON.parse(errorText); } catch(e) {}
        const msg = parsedError.error?.message || errorText;

        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            provider: this.id,
            error: { code: 'IMAGE_PROVIDER_AUTH_FAILED', message: `Google Imagen auth failed: ${msg}` }
          };
        }
        if (res.status === 429) {
          return {
            success: false,
            provider: this.id,
            error: { code: 'IMAGE_PROVIDER_RATE_LIMITED', message: `Google Imagen rate limited: ${msg}` }
          };
        }
        return {
          success: false,
          provider: this.id,
          error: { code: 'IMAGE_GENERATION_FAILED', message: `Google Imagen generation failed (${res.status}): ${msg}` }
        };
      }

      const data = await res.json();
      const b64Data = data.predictions?.[0]?.bytesBase64Encoded;
      if (!b64Data) {
        return {
          success: false,
          provider: this.id,
          error: { code: 'IMAGE_GENERATION_FAILED', message: 'No image data returned from Google Imagen' }
        };
      }

      const buffer = Buffer.from(b64Data, 'base64');
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
          model: this.modelName,
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
          message: `Network error calling Google Imagen: ${err.message}`
        }
      };
    }
  }
}

module.exports = GoogleImageProvider;
