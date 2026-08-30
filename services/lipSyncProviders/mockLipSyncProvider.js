const BaseLipSyncProvider = require('./baseLipSyncProvider');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Deterministic Mock Lip-Sync Provider (Strictly for Unit/Integration Testing)
 * Produces valid MP4 container buffers with video & audio box headers
 */
class MockLipSyncProvider extends BaseLipSyncProvider {
  constructor(config = {}) {
    super(config);
    this.id = 'mock-test-lipsync-provider';
    this.name = 'Deterministic Mock Lip-Sync Provider (Test Only)';
    this.shouldFail = config.shouldFail || false;
    this.failReason = config.failReason || 'SIMULATED_LIPSYNC_ERROR';
  }

  /**
   * Create synthetic MP4 binary buffer with valid ISO base media file format headers
   */
  createMp4ContainerBuffer(durationMs = 2000) {
    const ftypBox = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32
    ]);

    const mdatHeader = Buffer.from([
      0x00, 0x00, 0x10, 0x00, 0x6D, 0x64, 0x61, 0x74
    ]);
    const mdatPayload = Buffer.alloc(4088);
    for (let i = 0; i < mdatPayload.length; i++) {
      mdatPayload[i] = (i * 17 + 31) % 256;
    }

    const mvhdBox = Buffer.alloc(32);
    mvhdBox.writeUInt32BE(32, 0);
    mvhdBox.write('mvhd', 4, 4, 'ascii');
    mvhdBox.writeUInt32BE(1000, 20);
    mvhdBox.writeUInt32BE(durationMs, 24);

    const moovBox = Buffer.alloc(40);
    moovBox.writeUInt32BE(40, 0);
    moovBox.write('moov', 4, 4, 'ascii');
    mvhdBox.copy(moovBox, 8);

    return Buffer.concat([ftypBox, mdatHeader, mdatPayload, moovBox]);
  }

  async generateLipSync(options = {}) {
    if (this.shouldFail) {
      return {
        success: false,
        provider: this.id,
        isMock: true,
        error: { code: 'LIPSYNC_GENERATION_FAILED', message: this.failReason }
      };
    }

    const durationMs = options.durationMs || 3000;
    const videoBuffer = this.createMp4ContainerBuffer(durationMs);

    const outFileName = `lipsync_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`;
    const outDir = path.join(process.cwd(), 'public', 'uploads', 'video-assets');
    fs.mkdirSync(outDir, { recursive: true });
    const outFilePath = path.join(outDir, outFileName);
    fs.writeFileSync(outFilePath, videoBuffer);

    return {
      success: true,
      videoBuffer,
      videoPath: outFilePath,
      videoUrl: `/uploads/video-assets/${outFileName}`,
      durationMs,
      provider: this.id,
      isMock: true
    };
  }
}

module.exports = MockLipSyncProvider;
