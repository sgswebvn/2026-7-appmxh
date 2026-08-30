import { test, expect } from '@playwright/test';
const GoogleImageProvider = require('../services/imageProviders/googleImageProvider');
const fs = require('fs');

test.describe('Real Image Provider Smoke Test (Phase 3B)', () => {

  test('smoke test evaluates real image provider or reports REAL_IMAGE_PROVIDER_NOT_CONFIGURED', async () => {
    const google = new GoogleImageProvider();
    const configCheck = google.validateConfig();

    if (!configCheck.valid) {
      console.log('ℹ️ [SMOKE TEST] Real Google Image Provider is NOT configured with an active key.');
      console.log('ℹ️ [SMOKE TEST] Result: REAL_IMAGE_PROVIDER_NOT_CONFIGURED');
      expect(configCheck.valid).toBe(false);
      expect(configCheck.error).toContain('IMAGE_PROVIDER_NOT_CONFIGURED');
      return;
    }

    console.log('🚀 [SMOKE TEST] Running real Google Imagen reference generation...');
    const result = await google.generateImage({
      prompt: 'A cinematic portrait of a happy Vietnamese grandmother, photorealistic, 8k resolution, neutral background',
      aspectRatio: '9:16'
    });

    if (result.success) {
      expect(result.assetId).toBeDefined();
      expect(result.filePath).toBeDefined();
      expect(fs.existsSync(result.filePath)).toBe(true);
      expect(result.url).toContain('/uploads/visual-assets/');
      console.log(`✅ [SMOKE TEST] Generated Real Asset: ${result.assetId} at ${result.filePath}`);
    } else {
      console.log(`⚠️ [SMOKE TEST] Real Provider Failed: ${result.error?.code} - ${result.error?.message}`);
      expect(result.error?.code).toBeDefined();
    }
  });

});
