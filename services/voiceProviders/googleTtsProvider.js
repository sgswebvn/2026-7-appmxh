const BaseVoiceProvider = require('./baseVoiceProvider');
const https = require('https');

/**
 * Google Natural TTS Provider
 * Secondary production provider using Google TTS streaming engine
 */
class GoogleTTSProvider extends BaseVoiceProvider {
  constructor(config = {}) {
    super(config);
    this.id = 'google-tts';
    this.name = 'Google Natural TTS';
  }

  getAvailableVoices() {
    return [
      { id: 'vi-male', name: 'Google Vietnamese Natural (Nam)', gender: 'male', lang: 'vi' },
      { id: 'vi-female', name: 'Google Vietnamese Natural (Nữ)', gender: 'female', lang: 'vi' },
      { id: 'en-male', name: 'Google English Natural (Male)', gender: 'male', lang: 'en' },
      { id: 'en-female', name: 'Google English Natural (Female)', gender: 'female', lang: 'en' }
    ];
  }

  splitIntoSafeChunks(text, maxChars = 100) {
    const cleanText = text
      .replace(/<[^>]*>?/gm, '')
      .replace(/[\r\n]+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = cleanText.split(/\s+/);
    const chunks = [];
    let current = '';

    for (const w of words) {
      if ((current + ' ' + w).trim().length <= maxChars) {
        current = (current ? current + ' ' : '') + w;
      } else {
        if (current.trim()) chunks.push(current.trim());
        current = w;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [cleanText.substring(0, maxChars)];
  }

  fetchChunk(chunkText, lang = 'vi') {
    return new Promise((resolve, reject) => {
      const q = encodeURIComponent(chunkText.trim());
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=${lang}&client=tw-ob`;

      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        },
        timeout: 10000
      }, (res) => {
        if (res.statusCode !== 200) {
          return resolve(null);
        }
        const data = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => resolve(Buffer.concat(data)));
      });

      req.on('error', (err) => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  async synthesize(options = {}) {
    const { text, voiceId = 'vi-male' } = options;
    if (!text || !text.trim()) {
      return {
        success: false,
        format: 'mp3',
        provider: this.id,
        error: { code: 'EMPTY_TEXT', message: 'Văn bản thoại trống.' }
      };
    }

    const lang = voiceId.startsWith('en') ? 'en' : 'vi';
    const chunks = this.splitIntoSafeChunks(text, 100);
    const audioBuffers = [];

    for (const chunk of chunks) {
      if (!chunk || !chunk.trim()) continue;
      const buf = await this.fetchChunk(chunk, lang);
      if (buf && buf.length > 200) {
        audioBuffers.push(buf);
      }
    }

    if (audioBuffers.length === 0) {
      return {
        success: false,
        format: 'mp3',
        provider: this.id,
        error: {
          code: 'GOOGLE_TTS_SYNTHESIS_FAILED',
          message: 'Không thể kết nối đến Google Natural TTS.'
        }
      };
    }

    return {
      success: true,
      audioBuffer: Buffer.concat(audioBuffers),
      format: 'mp3',
      provider: this.id
    };
  }
}

module.exports = GoogleTTSProvider;
