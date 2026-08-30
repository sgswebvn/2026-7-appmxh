const BaseVoiceProvider = require('./baseVoiceProvider');
const crypto = require('crypto');

/**
 * Microsoft Edge Neural TTS Provider
 * Supports high-fidelity natural Vietnamese & English voices with SSML pitch/rate modulation
 */
class EdgeTTSProvider extends BaseVoiceProvider {
  constructor(config = {}) {
    super(config);
    this.id = 'edge-tts';
    this.name = 'Microsoft Edge Neural TTS';
    this.voiceMap = {
      'vi-male': 'vi-VN-NamMinhNeural',
      'vi-female': 'vi-VN-HoaiMyNeural',
      'vi-VN-NamMinhNeural': 'vi-VN-NamMinhNeural',
      'vi-VN-HoaiMyNeural': 'vi-VN-HoaiMyNeural',
      'en-male': 'en-US-GuyNeural',
      'en-female': 'en-US-JennyNeural',
      'en-US-GuyNeural': 'en-US-GuyNeural',
      'en-US-JennyNeural': 'en-US-JennyNeural'
    };
  }

  getAvailableVoices() {
    return [
      { id: 'vi-male', name: 'Nam Minh (Nam - Giọng Bản Lĩnh Hào Sảng)', voice: 'vi-VN-NamMinhNeural', gender: 'male', lang: 'vi-VN' },
      { id: 'vi-female', name: 'Hoài My (Nữ - Giọng Truyền Cảm Tươi Sáng)', voice: 'vi-VN-HoaiMyNeural', gender: 'female', lang: 'vi-VN' },
      { id: 'en-male', name: 'Guy (Nam - English US Natural)', voice: 'en-US-GuyNeural', gender: 'male', lang: 'en-US' },
      { id: 'en-female', name: 'Jenny (Nữ - English US Natural)', voice: 'en-US-JennyNeural', gender: 'female', lang: 'en-US' }
    ];
  }

  calculatePitchAndRate(options = {}) {
    const age = options.age || 30;
    let pitch = options.pitch || '+0Hz';
    let rate = options.speed || '+0%';

    // Age-specific modulation if pitch was not explicitly overridden
    if (!options.pitch) {
      if (age >= 60) {
        pitch = '-6Hz'; // Deeper, warmer elderly tone
        rate = '-5%';   // Slightly more measured pace
      } else if (age <= 12) {
        pitch = '+12Hz'; // Higher, energetic child tone
        rate = '+4%';    // Lively pace
      } else if (age <= 18) {
        pitch = '+5Hz';  // Youthful tone
      }
    }

    return { pitch, rate };
  }

  async synthesize(options = {}) {
    const { text, voiceId = 'vi-male' } = options;
    if (!text || !text.trim()) {
      return {
        success: false,
        format: 'mp3',
        provider: this.id,
        error: { code: 'EMPTY_TEXT', message: 'Văn bản kịch bản trống.' }
      };
    }

    const resolvedVoice = this.voiceMap[voiceId] || (options.gender === 'female' ? 'vi-VN-HoaiMyNeural' : 'vi-VN-NamMinhNeural');
    const lang = resolvedVoice.startsWith('vi') ? 'vi-VN' : 'en-US';
    const { pitch, rate } = this.calculatePitchAndRate(options);

    try {
      const buffer = await this.fetchEdgeTtsWebSocket(text, resolvedVoice, lang, pitch, rate);
      if (buffer && buffer.length > 500) {
        return {
          success: true,
          audioBuffer: buffer,
          format: 'mp3',
          provider: this.id
        };
      }
      throw new Error('Edge TTS returned empty or invalid audio payload.');
    } catch (err) {
      return {
        success: false,
        format: 'mp3',
        provider: this.id,
        error: {
          code: 'EDGE_TTS_SYNTHESIS_FAILED',
          message: err.message || 'Lỗi kết nối Microsoft Edge Neural TTS.'
        }
      };
    }
  }

  fetchEdgeTtsWebSocket(text, voice, lang, pitch, rate) {
    return new Promise((resolve, reject) => {
      const connectionId = crypto.randomUUID().replace(/-/g, '');
      const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EA65497286450C2876E4F52B&ConnectionId=${connectionId}`;

      let ws;
      try {
        ws = new WebSocket(url, {
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
            'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
          }
        });
      } catch (err) {
        return reject(err);
      }

      const audioBuffers = [];
      const timeout = setTimeout(() => {
        try { ws.close(); } catch (e) {}
        reject(new Error('Edge TTS WebSocket timeout after 12s.'));
      }, 12000);

      ws.onopen = () => {
        const reqId = crypto.randomUUID().replace(/-/g, '');
        const dateStr = new Date().toString();
        const configMsg = `X-Timestamp:${dateStr}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                  outputFormat: "audio-24khz-48kbitrate-mono-mp3"
                }
              }
            }
          });
        ws.send(configMsg);

        // Clean XML characters in text
        const safeText = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='${pitch}' rate='${rate}'>${safeText}</prosody>` +
          `</voice></speak>`;

        const ssmlMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateStr}Z\r\nPath:ssml\r\n\r\n${ssml}`;
        ws.send(ssmlMsg);
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          if (event.data.includes('Path:turn.end')) {
            clearTimeout(timeout);
            try { ws.close(); } catch (e) {}
            resolve(Buffer.concat(audioBuffers));
          }
        } else if (event.data) {
          let arrayBuffer;
          if (typeof Blob !== 'undefined' && event.data instanceof Blob) {
            arrayBuffer = await event.data.arrayBuffer();
          } else if (event.data instanceof ArrayBuffer) {
            arrayBuffer = event.data;
          } else if (Buffer.isBuffer(event.data)) {
            arrayBuffer = event.data.buffer;
          }

          if (arrayBuffer) {
            const buffer = Buffer.from(arrayBuffer);
            const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'));
            if (headerEnd !== -1) {
              const audioChunk = buffer.subarray(headerEnd + 4);
              if (audioChunk.length > 0) {
                audioBuffers.push(audioChunk);
              }
            }
          }
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err instanceof Error ? err : new Error('Edge TTS WebSocket connection failed'));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (audioBuffers.length > 0) {
          resolve(Buffer.concat(audioBuffers));
        }
      };
    });
  }
}

module.exports = EdgeTTSProvider;
