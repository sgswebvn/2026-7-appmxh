import { test, expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');

test.describe('Real Browser Video Assembly & Production Workspace UI Flow', () => {

  test.beforeAll(() => {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'video-assets');
    fs.mkdirSync(dir, { recursive: true });
    const sampleMp4 = path.join(dir, 'sample_video_test.mp4');
    if (!fs.existsSync(sampleMp4)) {
      const MockLipSyncProvider = require('../services/lipSyncProviders/mockLipSyncProvider');
      const mock = new MockLipSyncProvider();
      fs.writeFileSync(sampleMp4, mock.createMp4ContainerBuffer(3000));
    }
  });

  test('user can view Video Assembly section, inspect 10-stage pipeline, shot cards, and Master Video player', async ({ page }) => {
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

    // 2. Inject StoryPlan with rendered video shots and master video
    const storyPlan = {
      storyId: 'story_ui_video_001',
      topic: 'Một ông già 70 tuổi ăn mì cay cùng cô cháu gái 8 tuổi',
      title: 'Thử Thách Mì Cay Ông Cháu',
      characters: [
        { id: 'char_ong_nam', name: 'Ông Năm', role: 'Grandfather', gender: 'male' },
        { id: 'char_be_an', name: 'Bé An', role: 'Granddaughter', gender: 'female' }
      ],
      scenes: [{ id: 'scene_001', location: 'Quán mì cay' }],
      dialogues: [
        { id: 'dlg_001', speakerId: 'char_ong_nam', text: 'Nước dùng cay thế này ông ăn cái vèo là hết!' },
        { id: 'dlg_002', speakerId: 'char_be_an', text: 'Ông cẩn thận nha ông!' }
      ],
      videoShots: [
        {
          shotId: 'shot_001',
          shotType: 'Wide Two-Shot 35mm',
          cameraMotion: 'pull_out',
          durationSec: 2.5,
          videoUrl: '/uploads/video-assets/sample_video_test.mp4'
        },
        {
          shotId: 'shot_002',
          shotType: 'Close-Up 85mm',
          activeSpeakerName: 'Ông Năm',
          cameraMotion: 'push_in',
          durationSec: 2.0,
          dialogueText: 'Nước dùng cay thế này ông ăn cái vèo là hết!',
          videoUrl: '/uploads/video-assets/sample_video_test.mp4'
        }
      ],
      masterVideo: {
        videoUrl: '/uploads/video-assets/sample_video_test.mp4',
        durationSec: 4.5,
        width: 1080,
        height: 1920
      },
      videoQA: {
        approved: true,
        videoArtifactScore: 98
      }
    };

    await page.evaluate((plan) => {
      (window as any).renderDirectorWorkspace(plan);
    }, storyPlan);

    await page.waitForTimeout(300);

    // 3. Verify Video Assembly elements
    const section = page.locator('#director-video-assembly-section');
    await expect(section).toBeVisible();
    await expect(section).toContainText('VIDEO ASSEMBLY & REAL LIP-SYNC ENGINE');

    // 4. Verify 10-Stage Pipeline tracker
    await expect(page.locator('#pipeline-badge-shots')).toContainText('SHOTS');
    await expect(page.locator('#pipeline-badge-motion')).toContainText('MOTION');
    await expect(page.locator('#pipeline-badge-lipsync')).toContainText('LIP-SYNC');
    await expect(page.locator('#pipeline-badge-final')).toContainText('FINAL MP4');

    // 5. Verify Master Video bar and QA badge
    const masterBar = page.locator('#director-master-video-bar');
    await expect(masterBar).toBeVisible();
    await expect(page.locator('#director-video-qa-badge')).toContainText('QA SCORE: 98/100 (APPROVED)');

    // 6. Verify Shot Cards in Grid
    const shotsGrid = page.locator('#director-video-shots-grid');
    await expect(shotsGrid).toContainText('Góc Quay #1');
    await expect(shotsGrid).toContainText('Wide Two-Shot 35mm');
    await expect(shotsGrid).toContainText('Góc Quay #2');
    await expect(shotsGrid).toContainText('Ông Năm');

    // 7. Verify zero browser console errors
    expect(consoleErrors).toEqual([]);
  });

});
