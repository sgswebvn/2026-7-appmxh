import { test, expect } from '@playwright/test';
const fs = require('fs');
const path = require('path');

test.describe('Real Browser Visual Generation & Character Identity UI Flow', () => {

  test.beforeAll(() => {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'visual-assets');
    fs.mkdirSync(dir, { recursive: true });
    const sampleImg = path.join(dir, 'sample_ong_nam.png');
    if (!fs.existsSync(sampleImg)) {
      const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(sampleImg, minimalPng);
    }
  });


  test('user can view character reference status, trigger generation, and inspect visual identity cards', async ({ page }) => {
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

    // 2. Inject StoryPlan with 2 characters
    const storyPlan = {
      storyId: 'story_ui_vis_001',
      topic: 'Một ông già 70 tuổi ăn mì cay cùng cô cháu gái 8 tuổi',
      title: 'Thử Thách Mì Cay Ông Cháu',
      genre: 'Family Comedy',
      style: 'conversational cinematic vertical short',
      durationTarget: 30,
      characters: [
        {
          id: 'char_ong_nam',
          name: 'Ông Năm',
          age: 70,
          gender: 'male',
          role: 'Grandfather (Elderly)',
          appearance: { face: 'Tóc bạc, nụ cười phúc hậu', clothing: 'Áo đũi be' },
          visualPrompt: 'Cinematic portrait of 70yo grandfather',
          voice: { voiceId: 'vi-male' },
          avatarUrl: null
        },
        {
          id: 'char_be_an',
          name: 'Bé An',
          age: 8,
          gender: 'female',
          role: 'Granddaughter (Child)',
          appearance: { face: 'Mắt to tròn, má phúng phính', clothing: 'Váy yếm hoa' },
          visualPrompt: 'Cinematic portrait of 8yo granddaughter',
          voice: { voiceId: 'vi-female' },
          avatarUrl: null
        }
      ],
      relationships: [
        {
          id: 'rel_001',
          fromCharacterId: 'char_ong_nam',
          toCharacterId: 'char_be_an',
          relationship: 'Ông nội ↔ Cháu gái',
          dynamic: 'Thách đố ăn mì cay'
        }
      ],
      scenes: [
        {
          id: 'scene_001',
          location: 'Quán mì cay Hàn Quốc',
          time: 'Buổi chiều',
          environment: 'Hai tô mì cay bốc khói',
          characters: ['char_ong_nam', 'char_be_an'],
          action: 'Hai ông cháu cùng thử mì cay'
        }
      ],
      dialogues: [
        {
          id: 'dlg_001',
          speakerId: 'char_ong_nam',
          sceneId: 'scene_001',
          text: 'Mì cay này chỉ là chuyện nhỏ thôi cháu ơi!',
          voiceId: 'vi-male'
        }
      ],
      shots: [
        {
          id: 'shot_001',
          sceneId: 'scene_001',
          shotType: 'Two-Shot 50mm',
          camera: 'Eye-level stationary shot',
          characters: ['char_ong_nam', 'char_be_an'],
          action: 'Ông cháu nhìn nhau cười'
        }
      ],
      characterReferences: [
        { characterId: 'char_ong_nam', status: 'not_generated' },
        { characterId: 'char_be_an', status: 'not_generated' }
      ]
    };

    await page.evaluate((plan) => {
      (window as any).renderDirectorWorkspace(plan);
    }, storyPlan);

    await page.waitForTimeout(300);

    // 3. Verify character status displays "CHƯA TẠO ẢNH"
    const castGrid = page.locator('#director-cast-grid');
    await expect(castGrid).toContainText('CHƯA TẠO ẢNH');
    await expect(castGrid).toContainText('🎨 Tạo Ảnh Nhận Diện');
    await expect(page.locator('#btn-director-generate-all-refs')).toBeVisible();

    // 4. Simulate generating character reference by updating plan with real asset
    storyPlan.characters[0].avatarUrl = '/uploads/visual-assets/sample_ong_nam.png';
    storyPlan.characterReferences[0] = {
      characterId: 'char_ong_nam',
      status: 'ready',
      imageUrl: '/uploads/visual-assets/sample_ong_nam.png',
      provider: 'mock-test-provider'
    };

    await page.evaluate((plan) => {
      (window as any).renderDirectorWorkspace(plan);
    }, storyPlan);

    await page.waitForTimeout(300);

    // 5. Verify status updated to READY and button became "Tạo Lại Ảnh"
    await expect(castGrid).toContainText('READY (ĐÃ CÓ ẢNH)');
    await expect(castGrid).toContainText('🔄 Tạo Lại Ảnh');

    // 6. Verify Scenes & Shots container renders "Tạo Visual Cảnh"
    const scenesContainer = page.locator('#director-scenes-container');
    await expect(scenesContainer).toContainText('Quán mì cay Hàn Quốc');
    await expect(scenesContainer).toContainText('🎨 Tạo Visual Cảnh');

    // 7. Check 0 console errors
    expect(consoleErrors).toEqual([]);
  });

});
