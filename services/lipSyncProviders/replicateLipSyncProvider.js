const BaseLipSyncProvider = require('./baseLipSyncProvider');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

/**
 * Replicate Lip-Sync Provider
 * Connects to SadTalker / LivePortrait / Wav2Lip models on Replicate
 */
class ReplicateLipSyncProvider extends BaseLipSyncProvider {
  constructor(config = {}) {
    super(config);
    this.id = 'replicate-lipsync';
    this.name = 'Replicate Neural Lip-Sync (SadTalker / LivePortrait)';
    this.apiToken = config.apiToken || process.env.REPLICATE_API_TOKEN || '';
    this.model = config.model || process.env.REPLICATE_LIPSYNC_MODEL || 'cjwbw/sadtalker:a519cc043a961293b7e775f20f0407b7dfd3844f19481f95d6941249e37e730f';
  }

  validateConfig() {
    if (!this.apiToken) {
      return { valid: false, error: 'Thiếu REPLICATE_API_TOKEN trong cấu hình môi trường.' };
    }
    return { valid: true };
  }

  toDataUri(filePath, mimeType) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  async generateLipSync(options = {}) {
    const { faceImagePath, audioPath, durationMs = 3000 } = options;

    const configCheck = this.validateConfig();
    if (!configCheck.valid) {
      return {
        success: false,
        provider: this.id,
        error: { code: 'LIPSYNC_PROVIDER_NOT_CONFIGURED', message: configCheck.error }
      };
    }

    if (!faceImagePath || !fs.existsSync(faceImagePath)) {
      return {
        success: false,
        provider: this.id,
        error: { code: 'MISSING_FACE_IMAGE', message: 'Không tìm thấy file ảnh nhân vật nhận diện trên đĩa.' }
      };
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      return {
        success: false,
        provider: this.id,
        error: { code: 'MISSING_AUDIO_FILE', message: 'Không tìm thấy file âm thanh thoại của nhân vật.' }
      };
    }

    try {
      const sourceImageUri = this.toDataUri(faceImagePath, 'image/png') || this.toDataUri(faceImagePath, 'image/jpeg');
      const drivenAudioUri = this.toDataUri(audioPath, 'audio/mp3');

      // Create Prediction on Replicate
      const prediction = await this.createPrediction({
        source_image: sourceImageUri,
        driven_audio: drivenAudioUri,
        preprocess: 'crop',
        still: true,
        enhancer: 'gfpgan'
      });

      const outputUrl = await this.pollPrediction(prediction.id);
      if (!outputUrl) {
        throw new Error('Replicate Lip-Sync model không trả về video output URL.');
      }

      // Download MP4
      const videoBuffer = await this.downloadBuffer(outputUrl);
      if (!videoBuffer || videoBuffer.length < 1000) {
        return {
          success: false,
          provider: this.id,
          error: { code: 'LIPSYNC_OUTPUT_INVALID', message: 'Tệp video tải về từ Replicate quá nhỏ hoặc bị hỏng.' }
        };
      }

      const outFileName = `lipsync_real_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`;
      const outDir = path.join(process.cwd(), 'public', 'uploads', 'video-assets');
      fs.mkdirSync(outDir, { recursive: true });
      const outFilePath = path.join(outDir, outFileName);
      fs.writeFileSync(outFilePath, videoBuffer);

      // Deep validate decoded frames and motion
      const { mediaCapability } = require('../mediaCapability');
      const decodeCheck = await mediaCapability.validateVideoDecodability(outFilePath);
      if (!decodeCheck.decodable) {
        if (fs.existsSync(outFilePath)) fs.unlinkSync(outFilePath);
        return {
          success: false,
          provider: this.id,
          error: { code: 'LIPSYNC_OUTPUT_INVALID', message: `Tệp video trả về không thể giải mã: ${decodeCheck.error}` }
        };
      }

      const motionCheck = await mediaCapability.analyzeVideoMotion(outFilePath);

      return {
        success: true,
        mode: 'real',
        provider: this.id,
        model: 'sadtalker',
        predictionId: prediction.id,
        sourceImage: faceImagePath,
        sourceAudio: audioPath,
        outputVideo: outFilePath,
        videoBuffer,
        videoPath: outFilePath,
        videoUrl: `/uploads/video-assets/${outFileName}`,
        durationMs,
        width: 1080,
        height: 1920,
        fps: 30,
        motionScore: motionCheck.motionScore,
        hasMotion: motionCheck.hasMotion,
        status: 'succeeded',
        isMock: false
      };
    } catch (err) {
      return {
        success: false,
        provider: this.id,
        error: {
          code: 'LIPSYNC_SYNTHESIS_FAILED',
          message: err.message || 'Lỗi xử lý Lip-Sync trên Replicate.'
        }
      };
    }
  }

  createPrediction(input) {
    return new Promise((resolve, reject) => {
      const version = this.model.split(':')[1] || this.model;
      const body = JSON.stringify({ version, input });

      const req = https.request('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(data.detail || data.error || `Replicate API error (${res.statusCode})`));
            }
          } catch (e) {
            reject(new Error('Invalid JSON response from Replicate API'));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async pollPrediction(predictionId, maxAttempts = 60, intervalMs = 2000) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, intervalMs));
      const res = await new Promise((resolve, reject) => {
        https.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { 'Authorization': `Token ${this.apiToken}` }
        }, (res) => {
          let raw = '';
          res.on('data', c => raw += c);
          res.on('end', () => {
            try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });

      if (res.status === 'succeeded') {
        return typeof res.output === 'string' ? res.output : (Array.isArray(res.output) ? res.output[0] : null);
      }
      if (res.status === 'failed' || res.status === 'canceled') {
        throw new Error(res.error || `Prediction ended with status: ${res.status}`);
      }
    }
    throw new Error('Replicate Lip-Sync prediction timed out after polling.');
  }

  downloadBuffer(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return https.get(res.headers.location, (redRes) => {
            const chunks = [];
            redRes.on('data', c => chunks.push(c));
            redRes.on('end', () => resolve(Buffer.concat(chunks)));
          }).on('error', reject);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
  }
}

module.exports = ReplicateLipSyncProvider;
