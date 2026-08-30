const fs = require('fs');
const { exec } = require('child_process');

/**
 * Audio Duration Parser & MPEG-1/2 Layer 3 Frame Inspector
 */
class AudioDurationParser {
  /**
   * Parse audio duration from buffer or file path
   * @param {Buffer|string} input - Audio buffer or absolute file path
   * @returns {{ valid: boolean, durationMs: number, durationSec: number, bitrate?: number, sampleRate?: number, channels?: number, frameCount?: number, error?: string }}
   */
  static parse(input) {
    let buffer;
    if (typeof input === 'string') {
      if (!fs.existsSync(input)) {
        return { valid: false, durationMs: 0, durationSec: 0, error: 'File not found on disk' };
      }
      buffer = fs.readFileSync(input);
    } else if (Buffer.isBuffer(input)) {
      buffer = input;
    } else {
      return { valid: false, durationMs: 0, durationSec: 0, error: 'Invalid input: expected Buffer or string path' };
    }

    if (!buffer || buffer.length < 10) {
      return { valid: false, durationMs: 0, durationSec: 0, error: 'Audio buffer is too small or empty' };
    }

    return this.parseMpegFrames(buffer);
  }

  /**
   * MPEG-1/2 Layer 3 frame header table
   */
  static parseMpegFrames(buffer) {
    const bitratesMpeg1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    const sampleRatesMpeg1 = [44100, 48000, 32000, 0];
    const sampleRatesMpeg2 = [22050, 24000, 16000, 0];

    let offset = 0;
    // Skip ID3v2 header if present
    if (buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      const id3Size = ((buffer[6] & 0x7F) << 21) |
                      ((buffer[7] & 0x7F) << 14) |
                      ((buffer[8] & 0x7F) << 7) |
                      (buffer[9] & 0x7F);
      offset = 10 + id3Size;
    }

    let totalFrames = 0;
    let detectedSampleRate = 44100;
    let detectedBitrate = 128;
    let detectedChannels = 2;
    let totalSamples = 0;

    while (offset < buffer.length - 4) {
      // Look for sync word 0xFF 0b111xxxxx
      if (buffer[offset] === 0xFF && (buffer[offset + 1] & 0xE0) === 0xE0) {
        const header = (buffer[offset] << 24) |
                       (buffer[offset + 1] << 16) |
                       (buffer[offset + 2] << 8) |
                       buffer[offset + 3];

        const mpegVersion = (header >> 19) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
        const layer = (header >> 17) & 3; // 1 = Layer 3
        const bitrateIdx = (header >> 12) & 15;
        const sampleRateIdx = (header >> 10) & 3;
        const padding = (header >> 9) & 1;
        const channelMode = (header >> 6) & 3;

        if (layer === 1 && bitrateIdx > 0 && bitrateIdx < 15 && sampleRateIdx < 3) {
          const sampleRate = (mpegVersion === 3) ? sampleRatesMpeg1[sampleRateIdx] : sampleRatesMpeg2[sampleRateIdx];
          const bitrate = bitratesMpeg1L3[bitrateIdx]; // in kbps
          const samplesPerFrame = (mpegVersion === 3) ? 1152 : 576;

          if (sampleRate > 0 && bitrate > 0) {
            const frameLength = Math.floor((samplesPerFrame * (bitrate * 1000) / 8) / sampleRate) + padding;
            if (frameLength > 0 && offset + frameLength <= buffer.length) {
              totalFrames++;
              totalSamples += samplesPerFrame;
              detectedSampleRate = sampleRate;
              detectedBitrate = bitrate;
              detectedChannels = (channelMode === 3) ? 1 : 2;
              offset += frameLength;
              continue;
            }
          }
        }
      }
      offset++;
    }

    if (totalFrames > 0 && detectedSampleRate > 0) {
      const durationSec = totalSamples / detectedSampleRate;
      const durationMs = Math.round(durationSec * 1000);
      return {
        valid: true,
        durationMs,
        durationSec: parseFloat(durationSec.toFixed(2)),
        bitrate: detectedBitrate,
        sampleRate: detectedSampleRate,
        channels: detectedChannels,
        frameCount: totalFrames
      };
    }

    // Fallback: estimate from byte length assuming 48kbps or 128kbps if frames weren't strictly contiguous
    const estimatedBitrate = 48; // default Edge TTS bitrate
    const estimatedSec = Math.max(0.5, (buffer.length * 8) / (estimatedBitrate * 1000));
    return {
      valid: buffer.length > 500,
      durationMs: Math.round(estimatedSec * 1000),
      durationSec: parseFloat(estimatedSec.toFixed(2)),
      bitrate: estimatedBitrate,
      sampleRate: 24000,
      channels: 1,
      frameCount: Math.round(estimatedSec * 38),
      estimated: true
    };
  }

  /**
   * Create silence MPEG audio frames for natural pause between speakers
   * @param {number} durationMs - Milliseconds of silence (e.g. 350ms)
   * @returns {Buffer}
   */
  static createSilenceBuffer(durationMs = 350) {
    const frameCount = Math.max(1, Math.round((durationMs / 1000) * 38.28));
    const frameSize = 417; // standard 128kbps, 44.1kHz frame size
    const buf = Buffer.alloc(frameCount * frameSize);

    for (let f = 0; f < frameCount; f++) {
      const offset = f * frameSize;
      buf[offset] = 0xFF;
      buf[offset + 1] = 0xFB;
      buf[offset + 2] = 0x90;
      buf[offset + 3] = 0x64;
      // zeroed payload represents silence in MPEG audio
    }
    return buf;
  }
}

module.exports = AudioDurationParser;
