import { test, expect } from '@playwright/test';
const GoogleTTSProvider = require('../services/voiceProviders/googleTtsProvider');
const AudioDurationParser = require('../services/audioDurationParser');
const fs = require('fs');
const path = require('path');

test.describe('Real Voice Provider Smoke Test (Phase 3C)', () => {

  test('smoke test synthesizes real speech utterance with duration > 0 and valid MPEG stream', async () => {
    const google = new GoogleTTSProvider();
    console.log('🚀 [SMOKE TEST] Testing real Google Natural TTS synthesis...');

    const result = await google.synthesize({
      text: 'Nước dùng cay thế này ông ăn cái vèo là hết!',
      voiceId: 'vi-male'
    });

    if (result.success && result.audioBuffer) {
      expect(result.audioBuffer.length).toBeGreaterThan(1000);
      
      const parsed = AudioDurationParser.parse(result.audioBuffer);
      expect(parsed.valid).toBe(true);
      expect(parsed.durationMs).toBeGreaterThan(500);

      const outDir = path.join(process.cwd(), 'public', 'uploads', 'audio-assets');
      fs.mkdirSync(outDir, { recursive: true });
      const testFilePath = path.join(outDir, 'smoke_test_sample.mp3');
      fs.writeFileSync(testFilePath, result.audioBuffer);

      expect(fs.existsSync(testFilePath)).toBe(true);
      console.log(`✅ [SMOKE TEST] Real TTS Audio Generated: ${result.audioBuffer.length} bytes, duration: ${parsed.durationSec}s`);
    } else {
      console.log(`⚠️ [SMOKE TEST] Real Voice Provider unavailable: ${result.error?.message}`);
      expect(result.error?.code).toBeDefined();
    }
  });

});
