const BaseMotionProvider = require('./baseMotionProvider');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { mediaCapability } = require('../mediaCapability');

/**
 * Deterministic Mock Motion Provider (Strictly for Unit/Integration Testing)
 */
class MockMotionProvider extends BaseMotionProvider {
  constructor(config = {}) {
    super(config);
    this.id = 'mock-test-motion-provider';
    this.name = 'Deterministic Mock Motion Provider (Test Only)';
    this.shouldFail = config.shouldFail || false;
    this.failReason = config.failReason || 'SIMULATED_MOTION_ERROR';
    this.mediaCapability = config.mediaCapability || mediaCapability;
  }

  async generateMotion(options = {}) {
    if (this.shouldFail) {
      return {
        success: false,
        provider: this.id,
        isMock: true,
        error: { code: 'MOTION_GENERATION_FAILED', message: this.failReason }
      };
    }

    const durationMs = options.durationMs || 3000;
    const durationSec = (durationMs / 1000).toFixed(2);
    const outFileName = `motion_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`;
    const outDir = path.join(process.cwd(), 'public', 'uploads', 'video-assets');
    fs.mkdirSync(outDir, { recursive: true });
    const outFilePath = path.join(outDir, outFileName);

    const caps = await this.mediaCapability.checkMediaCapabilities();
    if (caps.ffmpegAvailable) {
      const safeOut = outFilePath.replace(/\\/g, '/');
      const safeImage = (options.imagePath && fs.existsSync(options.imagePath))
        ? options.imagePath.replace(/\\/g, '/')
        : null;

      if (safeImage) {
        await this.mediaCapability.execFfmpeg(`-y -loop 1 -i "${safeImage}" -vf "scale=1080:1920,format=yuv420p" -c:v libx264 -t ${durationSec} -r 30 -pix_fmt yuv420p "${safeOut}"`);
      } else {
        await this.mediaCapability.execFfmpeg(`-y -f lavfi -i color=c=navy:s=1080x1920:d=${durationSec}:r=30 -vf "format=yuv420p" -c:v libx264 -pix_fmt yuv420p "${safeOut}"`);
      }
    } else {
      // Fallback mock buffer for CI environments without ffmpeg
      const buf = Buffer.alloc(1024);
      buf.write('ftypisom', 4, 'ascii');
      fs.writeFileSync(outFilePath, buf);
    }

    const videoBuffer = fs.readFileSync(outFilePath);

    return {
      success: true,
      videoBuffer,
      videoPath: outFilePath,
      videoUrl: `/uploads/video-assets/${outFileName}`,
      durationMs,
      width: 1080,
      height: 1920,
      fps: 30,
      codec: 'h264',
      provider: this.id,
      isMock: true
    };
  }
}

module.exports = MockMotionProvider;
