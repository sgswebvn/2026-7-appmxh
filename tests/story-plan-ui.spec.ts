import { test, expect } from '@playwright/test';

test.describe('Real Browser StoryPlan & Character Director UI Flow', () => {

  test('user can switch to Director workspace, view characters, edit character, and inspect dialogues', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // 1. Switch to Director tab via UI
    await page.evaluate(() => {
      if (typeof (window as any).switchTab === 'function') {
        (window as any).switchTab('director-tab');
      }
    });

    // 2. Verify Director Workspace elements are visible
    await expect(page.locator('#director-tab')).toBeVisible();
    await expect(page.locator('#director-topic-input')).toBeVisible();
    await expect(page.locator('#btn-director-generate-story')).toBeVisible();
    await expect(page.locator('#director-cast-grid')).toBeVisible();

    // 3. Enter custom arbitrary topic
    await page.locator('#director-topic-input').fill('Một gia đình thử mì cay cấp độ 7');
    await expect(page.locator('#director-topic-input')).toHaveValue('Một gia đình thử mì cay cấp độ 7');

    // 4. Inject a canonical StoryPlan into the client UI
    const testPlan = {
      storyId: 'story_ui_test_001',
      topic: 'Một gia đình thử mì cay cấp độ 7',
      title: 'Thử Thách Mì Cay Cấp Độ 7 Cùng Cả Nhà',
      genre: 'Family Comedy & Food Challenge',
      style: 'conversational cinematic vertical short',
      durationTarget: 30,
      characters: [
        {
          id: 'char_bo_hung',
          name: 'Bố Hùng',
          age: 42,
          gender: 'male',
          role: 'Người bố thích thử thách (Father)',
          personality: ['Hài hước', 'Tự tin thái quá'],
          appearance: { face: 'Khuôn mặt tươi cười', clothing: 'Áo polo xanh' },
          visualPrompt: 'Cinematic portrait of a 42yo Vietnamese father eating spicy noodles',
          voice: { voiceId: 'vi-male', language: 'vi-VN', gender: 'male', tone: 'Hào sảng' }
        },
        {
          id: 'char_me_mai',
          name: 'Mẹ Mai',
          age: 40,
          gender: 'female',
          role: 'Người mẹ chu đáo (Mother)',
          personality: ['Thận trọng', 'Hay cười'],
          appearance: { face: 'Nụ cười đôn hậu', clothing: 'Áo thun vàng pastel' },
          visualPrompt: 'Cinematic portrait of a 40yo Vietnamese mother holding water bottle',
          voice: { voiceId: 'vi-female', language: 'vi-VN', gender: 'female', tone: 'Dịu dàng' }
        }
      ],
      relationships: [
        {
          id: 'rel_001',
          fromCharacterId: 'char_bo_hung',
          toCharacterId: 'char_me_mai',
          relationship: 'Chồng ↔ Vợ',
          dynamic: 'Thách đố hài hước, vợ chuẩn bị sẵn cốc sữa giải cay cho chồng'
        }
      ],
      scenes: [
        {
          id: 'scene_001',
          location: 'Bàn ăn gia đình phòng bếp',
          time: 'Buổi tối',
          environment: 'Ánh đèn vàng ấm cúng, 2 bát mì cay đỏ rực ớt bốc khói',
          characters: ['char_bo_hung', 'char_me_mai'],
          action: 'Bố Hùng gắp miếng mì đầy ớt, Mẹ Mai cười tủm tỉm cầm hộp sữa',
          emotion: 'Hài hước & Kịch tính',
          dialogueIds: ['dlg_001', 'dlg_002'],
          visualPrompt: 'Family dining table with spicy red noodle bowls'
        }
      ],
      dialogues: [
        {
          id: 'dlg_001',
          speakerId: 'char_bo_hung',
          sceneId: 'scene_001',
          text: 'Mì cay cấp 7 này đối với bố chỉ là chuyện nhỏ thôi nhé!',
          emotion: 'Tự tin đắc thắng',
          action: 'Gắp một đũa mì to đưa vào miệng',
          voiceId: 'vi-male'
        },
        {
          id: 'dlg_002',
          speakerId: 'char_me_mai',
          sceneId: 'scene_001',
          text: 'Để xem lát nữa ai phải xin em hộp sữa tươi giải cay trước nào!',
          emotion: 'Cười trêu chọc',
          action: 'Đẩy hộp sữa tươi để sẵn trên bàn',
          voiceId: 'vi-female'
        }
      ],
      shots: [
        {
          id: 'shot_001',
          sceneId: 'scene_001',
          shotType: 'Macro Close-Up 85mm',
          camera: 'Push-in to noodle steam',
          duration: 4,
          characters: ['char_bo_hung'],
          action: 'Cận cảnh đũa mì đỏ rực ớt',
          dialogueIds: ['dlg_001'],
          visualPrompt: 'Macro shot of red spicy noodles',
          transition: 'Cut'
        }
      ]
    };

    await page.evaluate((plan) => {
      (window as any).renderDirectorWorkspace(plan);
    }, testPlan);

    await page.waitForTimeout(300);

    // 5. Verify character cards rendered with speaker tags and voice
    await expect(page.locator('#director-cast-grid')).toContainText('Bố Hùng');
    await expect(page.locator('#director-cast-grid')).toContainText('Mẹ Mai');
    await expect(page.locator('#director-cast-grid')).toContainText('Nam Minh (Nam)');
    await expect(page.locator('#director-cast-grid')).toContainText('Hoài My (Nữ)');

    // 6. Verify dialogues stream displays speaker names and speech text
    await expect(page.locator('#director-dialogues-stream')).toContainText('Bố Hùng');
    await expect(page.locator('#director-dialogues-stream')).toContainText('Mì cay cấp 7 này đối với bố chỉ là chuyện nhỏ thôi nhé!');
    await expect(page.locator('#director-dialogues-stream')).toContainText('Mẹ Mai');

    // 7. Test opening the Character Edit Modal
    await page.evaluate(() => {
      (window as any).openEditCharacterModal('char_bo_hung');
    });

    await expect(page.locator('#character-edit-modal')).toBeVisible();
    await expect(page.locator('#char-edit-name')).toHaveValue('Bố Hùng');

    // Close modal
    await page.evaluate(() => {
      (window as any).closeCharacterEditModal();
    });
    await expect(page.locator('#character-edit-modal')).toBeHidden();

    // 8. Verify zero console errors
    expect(consoleErrors).toEqual([]);
  });

});
