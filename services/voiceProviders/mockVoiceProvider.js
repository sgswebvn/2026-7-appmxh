const BaseVoiceProvider = require('./baseVoiceProvider');

/**
 * Deterministic Mock Voice Provider (Strictly for Unit/Integration Testing)
 * Produces valid binary MPEG-1 Layer 3 frames without external network requests
 */
class MockVoiceProvider extends BaseVoiceProvider {
  constructor(config = {}) {
    super(config);
    this.id = 'mock-test-voice-provider';
    this.name = 'Deterministic Mock Voice Provider (Test Only)';
    this.shouldFail = config.shouldFail || false;
    this.failReason = config.failReason || 'SIMULATED_VOICE_ERROR';
  }

  getAvailableVoices() {
    return [
      { id: 'vi-male', name: 'Mock Vietnamese Male', gender: 'male', lang: 'vi-VN' },
      { id: 'vi-female', name: 'Mock Vietnamese Female', gender: 'female', lang: 'vi-VN' }
    ];
  }

  createMpegFrameBuffer(durationSec = 2) {
    // 128 kbps, 44.1 kHz MPEG-1 Layer 3 frames (417 bytes per frame, ~38.28 frames per second)
    const frameCount = Math.max(10, Math.floor(durationSec * 38.28));
    const frameSize = 417;
    const buf = Buffer.alloc(frameCount * frameSize);

    for (let f = 0; f < frameCount; f++) {
      const offset = f * frameSize;
      // MPEG-1 Layer 3 Sync Word & Header (0xFF, 0xFB, 0x90, 0x64)
      buf[offset] = 0xFF;
      buf[offset + 1] = 0xFB;
      buf[offset + 2] = 0x90;
      buf[offset + 3] = 0x64;
      // Synthetic audio payload
      for (let i = 4; i < frameSize; i++) {
        buf[offset + i] = Math.floor(Math.sin((f + i) * 0.08) * 120) + 128;
      }
    }
    return buf;
  }

  async synthesize(options = {}) {
    if (this.shouldFail) {
      return {
        success: false,
        format: 'mp3',
        provider: this.id,
        isMock: true,
        error: { code: 'VOICE_GENERATION_FAILED', message: this.failReason }
      };
    }

    const words = (options.text || '').trim().split(/\s+/).length;
    // Average 3.2 words per second in Vietnamese dialogue
    const durationSec = Math.max(1.2, Math.round((words / 3.0) * 10) / 10);
    const buffer = this.createMpegFrameBuffer(durationSec);

    return {
      success: true,
      audioBuffer: buffer,
      format: 'mp3',
      provider: this.id,
      isMock: true,
      durationMs: Math.round(durationSec * 1000)
    };
  }
}

module.exports = MockVoiceProvider;
