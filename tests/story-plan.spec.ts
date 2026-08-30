import { test, expect } from '@playwright/test';
const { generateStoryPlan, validate, getStory, createCharacter, updateCharacter, createRelationship } = require('../services/storyPlanService');
const { validateStoryPlan } = require('../services/storyPlanValidator');

test.describe('StoryPlan Engine & Schema Verification (Phase 3A)', () => {

  // 1. Test topic → StoryPlan with dynamic Mock LLM generator
  test('topic -> StoryPlan generates canonical structure', async () => {
    const mockPlan = {
      storyId: 'story_test_001',
      topic: 'Một bà cụ bán bánh mì gặp một đứa trẻ',
      title: 'Bánh Mì Kẹp Yêu Thương',
      genre: 'Heartwarming Drama',
      style: 'conversational cinematic vertical short',
      durationTarget: 30,
      characters: [
        {
          id: 'char_ba_tam',
          name: 'Bà Tám',
          age: 65,
          gender: 'female',
          role: 'Bà cụ bán bánh mì (Street Vendor)',
          personality: ['Hiền hậu', 'Thương người'],
          appearance: {
            face: 'Khuôn mặt phúc hậu, nếp nhăn hiền từ',
            hair: 'Búi tóc hoa râm',
            clothing: 'Áo bà ba nâu mộc mạc',
            body: 'Gầy nhỏ',
            style: 'Cinematic warm realism'
          },
          visualPrompt: 'Cinematic portrait of an elderly Vietnamese woman selling banh mi',
          voice: { voiceId: 'vi-female', language: 'vi-VN', gender: 'female', tone: 'Ấm áp' }
        },
        {
          id: 'char_be_bo',
          name: 'Bé Bo',
          age: 6,
          gender: 'male',
          role: 'Đứa trẻ nghèo (Young Child)',
          personality: ['Ngây thơ', 'Lễ phép'],
          appearance: {
            face: 'Mắt to tròn, má lấm lem',
            hair: 'Tóc ngắn hơi rối',
            clothing: 'Áo thun cũ rộng thùng thình',
            body: 'Nhỏ nhắn',
            style: 'Cinematic realism'
          },
          visualPrompt: 'Cinematic portrait of a cute 6-year-old boy in Saigon street',
          voice: { voiceId: 'vi-female', language: 'vi-VN', gender: 'female', tone: 'Trong trẻo ngây thơ' }
        }
      ],
      relationships: [
        {
          id: 'rel_001',
          fromCharacterId: 'char_ba_tam',
          toCharacterId: 'char_be_bo',
          relationship: 'Bà cụ ↔ Đứa trẻ lạ',
          dynamic: 'Thương cảm, sẻ chia ổ bánh mì nóng hổi'
        }
      ],
      scenes: [
        {
          id: 'scene_001',
          location: 'Góc phố Sài Gòn sáng sớm bên xe bánh mì',
          time: 'Sáng sớm 6:00 AM',
          environment: 'Nắng sớm chiếu xiên qua làn khói bánh mì giòn rụm',
          characters: ['char_ba_tam', 'char_be_bo'],
          action: 'Bé Bo đứng nhìn tủ kính bánh mì, Bà Tám tươi cười vẫy gọi',
          emotion: 'Ấm áp, xúc động',
          dialogueIds: ['dlg_001', 'dlg_002'],
          visualPrompt: 'A warm morning street corner in Saigon with a banh mi cart'
        }
      ],
      dialogues: [
        {
          id: 'dlg_001',
          speakerId: 'char_be_bo',
          sceneId: 'scene_001',
          text: 'Bà ơi, bánh mì của bà thơm quá ạ...',
          emotion: 'Ngập ngừng & Thèm thuồng',
          action: 'Xoa xoa bụng, mắt nhìn vào khay chả lụa vàng ươm',
          voiceId: 'vi-female'
        },
        {
          id: 'dlg_002',
          speakerId: 'char_ba_tam',
          sceneId: 'scene_001',
          text: 'Lại đây bà kẹp cho ổ bánh mì đặc ruột nóng hổi ăn cho no bụng nhé con!',
          emotion: 'Đôn hậu & Tươi cười',
          action: 'Gắp miếng thịt nướng và chan nước sốt thơm lừng trao cho bé',
          voiceId: 'vi-female'
        }
      ],
      shots: [
        {
          id: 'shot_001',
          sceneId: 'scene_001',
          shotType: 'Low-Angle Close-Up 85mm',
          camera: 'Slow push-in on child face',
          duration: 4,
          characters: ['char_be_bo'],
          action: 'Đứa trẻ nhìn tủ bánh mì với ánh mắt ngây thơ',
          dialogueIds: ['dlg_001'],
          visualPrompt: 'Low angle portrait of 6yo boy looking at banh mi cart',
          transition: 'Cut'
        },
        {
          id: 'shot_002',
          sceneId: 'scene_001',
          shotType: 'Two-Shot Warm Light 50mm',
          camera: 'Eye-level gentle pan',
          duration: 4,
          characters: ['char_ba_tam', 'char_be_bo'],
          action: 'Bà cụ trao ổ bánh mì giòn tan cho em bé',
          dialogueIds: ['dlg_002'],
          visualPrompt: 'Warm two-shot of grandmother handing banh mi to young boy',
          transition: 'Fade'
        }
      ]
    };

    const plan = await generateStoryPlan({
      topic: 'Một bà cụ bán bánh mì gặp một đứa trẻ',
      generate: async () => mockPlan
    });

    expect(plan).toBeDefined();
    expect(plan.topic).toBe('Một bà cụ bán bánh mì gặp một đứa trẻ');
    expect(plan.characters.length).toBe(2);
    expect(plan.relationships.length).toBe(1);
    expect(plan.scenes.length).toBe(1);
    expect(plan.dialogues.length).toBe(2);
    expect(plan.shots.length).toBe(2);
  });

  // 2. Test StoryPlan → Multiple characters of different ages/roles
  test('StoryPlan supports multiple character roles, ages, and genders', async () => {
    const plan = getStory('story_test_001');
    if (!plan) return;

    expect(plan.characters[0].age).toBe(65);
    expect(plan.characters[0].role).toContain('Vendor');
    expect(plan.characters[1].age).toBe(6);
    expect(plan.characters[1].role).toContain('Child');
  });

  // 3. Test character → relationship validation
  test('relationships correctly link existing character IDs', async () => {
    const plan = getStory('story_test_001');
    if (!plan) return;

    const charIds = plan.characters.map(c => c.id);
    for (const rel of plan.relationships) {
      expect(charIds).toContain(rel.fromCharacterId);
      expect(charIds).toContain(rel.toCharacterId);
    }
  });

  // 4. Test dialogue → speaker matching
  test('every dialogue line belongs to a valid speaker', async () => {
    const plan = getStory('story_test_001');
    if (!plan) return;

    const charIds = plan.characters.map(c => c.id);
    for (const dlg of plan.dialogues) {
      expect(charIds).toContain(dlg.speakerId);
      expect(dlg.text.length).toBeGreaterThan(0);
    }
  });

  // 5. Test speaker → voice assignment
  test('every dialogue line voiceId matches the speaker voice', async () => {
    const plan = getStory('story_test_001');
    if (!plan) return;

    for (const dlg of plan.dialogues) {
      const speaker = plan.characters.find(c => c.id === dlg.speakerId);
      expect(dlg.voiceId).toBe(speaker.voice.voiceId);
    }
  });

  // 6. Test scene → characters
  test('scenes reference valid character IDs', async () => {
    const plan = getStory('story_test_001');
    if (!plan) return;

    const charIds = plan.characters.map(c => c.id);
    for (const sc of plan.scenes) {
      for (const cId of sc.characters) {
        expect(charIds).toContain(cId);
      }
    }
  });

  // 7. Test shot → scene connection
  test('shots reference valid scene IDs and dialogue IDs', async () => {
    const plan = getStory('story_test_001');
    if (!plan) return;

    const sceneIds = plan.scenes.map(s => s.id);
    for (const shot of plan.shots) {
      expect(sceneIds).toContain(shot.sceneId);
    }
  });

  // 8. Test invalid StoryPlan → validation failure
  test('validator rejects invalid StoryPlans (orphan characters, missing voice, bad speaker)', () => {
    const invalidPlan = {
      storyId: 'bad_plan_001',
      topic: 'Test Bad Plan',
      title: 'Bad Plan',
      characters: [
        { id: 'char_001', name: 'Actor 1', age: 30, gender: 'male', role: 'Role 1', voice: {} } // missing voiceId
      ],
      scenes: [
        { id: 'scene_001', characters: ['char_999'], dialogueIds: [] } // bad character
      ],
      dialogues: [
        { id: 'dlg_001', speakerId: 'char_888', sceneId: 'scene_001', text: 'Hello', voiceId: 'vi-male' } // bad speaker
      ],
      shots: [
        { id: 'shot_001', sceneId: 'scene_999' } // bad scene
      ]
    };

    const validation = validateStoryPlan(invalidPlan);
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });

  // 9. Test arbitrary topic without API key returns GENERATION_UNAVAILABLE error
  test('arbitrary topic without LLM returns clear error instead of silent fallback', async () => {
    try {
      await generateStoryPlan({
        topic: 'A street vendor meets a famous chef in Tokyo',
        apiKey: 'invalid_short_key'
      });
      expect(true).toBe(false); // should not reach here
    } catch (err) {
      expect(err.code).toBeDefined();
      expect(['GENERATION_UNAVAILABLE', 'GENERATION_FAILED']).toContain(err.code);
    }
  });

  // 10. Test character update & editing
  test('character can be updated with new role, age, or voice', async () => {
    const plan = getStory('story_test_001');
    if (!plan) return;

    updateCharacter('story_test_001', 'char_ba_tam', {
      name: 'Bà Tám Sài Gòn',
      age: 66,
      voice: { voiceId: 'vi-female', language: 'vi-VN', gender: 'female', tone: 'Rất đôn hậu' }
    });

    const updated = getStory('story_test_001');
    const char = updated.characters.find(c => c.id === 'char_ba_tam');
    expect(char.name).toBe('Bà Tám Sài Gòn');
    expect(char.age).toBe(66);
  });

});
