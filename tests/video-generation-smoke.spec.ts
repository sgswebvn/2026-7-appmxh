import { test, expect } from '@playwright/test';
const KenBurnsMotionProvider = require('../services/motionProviders/kenBurnsMotionProvider');
const RealVideoQA = require('../services/realVideoQA');
const fs = require('fs');
const path = require('path');

test.describe('Real Video Motion & Assembly Smoke Test (Phase 3D)', () => {

  test('smoke test synthesizes real camera motion MP4 and passes RealVideoQA inspection', async () => {
    const motion = new KenBurnsMotionProvider();
    const vDir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
    fs.mkdirSync(vDir, { recursive: true });
    const imgPath = path.join(vDir, 'sample_smoke_test.png');
    if (!fs.existsSync(imgPath)) {
      const minPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(imgPath, minPng);
    }

    console.log('🚀 [SMOKE TEST] Testing real Ken Burns 60fps camera motion...');
    const result = await motion.generateMotion({
      imagePath: imgPath,
      cameraMotion: 'push_in',
      durationMs: 2000
    });

    expect(result.success).toBe(true);
    expect(fs.existsSync(result.videoPath)).toBe(true);

    const qa = await RealVideoQA.evaluateVideoArtifact({
      videoPath: result.videoPath,
      audioDurationMs: 0,
      shots: [{ shotId: 'smoke_shot_001' }]
    });

    expect(qa.approved).toBe(true);
    expect(qa.videoArtifactScore).toBeGreaterThanOrEqual(85);
    console.log(`✅ [SMOKE TEST] Real MP4 Video Generated: ${result.videoPath}, QA Score: ${qa.videoArtifactScore}/100`);
  });

});
