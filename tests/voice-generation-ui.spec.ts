import { test, expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');

test.describe('Real Browser Voice Timeline & Multi-Speaker Audio UI Flow', () => {

  test.beforeAll(() => {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'audio-assets');
    fs.mkdirSync(dir, { recursive: true });
    const sampleMp3 = path.join(dir, 'sample_audio_test.mp3');
    if (!fs.existsSync(sampleMp3)) {
      // 10 valid silent MPEG frames
      const MockVoiceProvider = require('../services/voiceProviders/mockVoiceProvider');
      const mock = new MockVoiceProvider();
      fs.writeFileSync(sampleMp3, mock.createMpegFrameBuffer(2));
    }
  });

  test('user can view Voice Timeline section, trigger multi-speaker audio, and inspect dialogue playback', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // 1. Switch to Director tab
    await page.evaluate(() => {
      if (typeof (window as any).switchTab === 'function') {
        (window as any).switchTab('director-tab');
      }
    });

    // 2. Inject multi-speaker StoryPlan
    const storyPlan = {
      storyId: 'story_ui_voice_001',
      topic: 'Một ông già 70 tuổi ăn mì cay cùng cô cháu gái 8 tuổi',
      title: 'Thử Thách Mì Cay Ông Cháu',
      genre: 'Family Comedy',
      characters: [
        {
          id: 'char_ong_nam',
          name: 'Ông Năm',
          gender: 'male',
          role: 'Grandfather',
          avatarUrl: null
        },
        {
          id: 'char_be_an',
          name: 'Bé An',
          gender: 'female',
          role: 'Granddaughter',
          avatarUrl: null
        }
      ],
      scenes: [
        {
          id: 'scene_001',
          location: 'Quán mì cay'
        }
      ],
      dialogues: [
        {
          id: 'dlg_001',
          speakerId: 'char_ong_nam',
          text: 'Nước dùng cay thế này ông ăn cái vèo là hết!',
          emotion: 'Hào sảng'
        },
        {
          id: 'dlg_002',
          speakerId: 'char_be_an',
          text: 'Ông cẩn thận nha ông!',
          emotion: 'Lém lỉnh'
        }
      ],
      audioTimeline: [
        {
          dialogueId: 'dlg_001',
          speakerId: 'char_ong_nam',
          speakerName: 'Ông Năm',
          text: 'Nước dùng cay thế này ông ăn cái vèo là hết!',
          emotion: 'Hào sảng',
          startMs: 0,
          endMs: 3000,
          durationSec: 3.0,
          audioUrl: '/uploads/audio-assets/sample_audio_test.mp3'
        },
        {
          dialogueId: 'dlg_002',
          speakerId: 'char_be_an',
          speakerName: 'Bé An',
          text: 'Ông cẩn thận nha ông!',
          emotion: 'Lém lỉnh',
          startMs: 3400,
          endMs: 5800,
          durationSec: 2.4,
          audioUrl: '/uploads/audio-assets/sample_audio_test.mp3'
        }
      ],
      masterAudio: {
        audioUrl: '/uploads/audio-assets/sample_audio_test.mp3',
        durationSec: 5.8
      }
    };

    await page.evaluate((plan) => {
      (window as any).renderDirectorWorkspace(plan);
    }, storyPlan);

    await page.waitForTimeout(300);

    // 3. Verify Voice Timeline elements
    const timelineContainer = page.locator('#director-voice-timeline-container');
    await expect(timelineContainer).toContainText('Ông Năm');
    await expect(timelineContainer).toContainText('Bé An');
    await expect(timelineContainer).toContainText('Nước dùng cay thế này');
    await expect(timelineContainer).toContainText('Ông cẩn thận nha ông');

    // 4. Verify Master Track bar and play button
    const masterBar = page.locator('#director-master-audio-bar');
    await expect(masterBar).toBeVisible();
    await expect(page.locator('#btn-director-play-master')).toBeVisible();

    // 5. Check 0 console errors
    expect(consoleErrors).toEqual([]);
  });

});
