/**
 * ============================================================================
 * VISUAL STORYTELLING & TOPIC-AWARE SCENE GENERATION ENGINE (MAJOR FIX)
 * ============================================================================
 * Pipeline: TOPIC -> HOOK -> STORY BEATS -> SCENE PLAN -> CHARACTER SELECTION 
 *           -> OBJECT SELECTION -> ACTION -> CAMERA VARIATION -> DYNAMIC MOTION
 * 
 * Quy tắc:
 * 1. Không slideshow lặp pose/frame
 * 2. Visual kể 70% câu chuyện, khớp từng câu thoại
 * 3. Đa dạng nhân vật: Bà cụ, Ông cụ, Gia đình, Trẻ em, Học sinh, Đầu bếp, Chuyên gia
 * 4. Chuyển động góc máy: Extreme Close-Up, Over-the-shoulder, Macro, POV, Medium
 */

class VisualStorytellingEngine {
  constructor() {
    this.storyArchetypes = {
      // 1. NGƯỜI CAO TUỔI & CÔNG NGHỆ / AI (ELDERLY + AI / TECH)
      elderly_ai_tech: {
        keywords: ['người cao tuổi', 'người già', 'ông cụ', 'bà cụ', '60 tuổi', '70 tuổi', 'ông bà', 'ai cho người già', 'trí tuệ nhân tạo người già'],
        beats: [
          {
            shotType: 'HOOK',
            purpose: 'Tạo tò mò tột độ về việc người cao tuổi sử dụng công cụ AI hiện đại',
            sceneDescription: 'Cận cảnh gương mặt bà cụ 70 tuổi đeo kính lão ngạc nhiên thích thú khi nhìn vào màn hình smartphone rực rỡ',
            characterRole: 'Bà cụ 70 tuổi (Elderly Grandmother)',
            mainObject: 'Smartphone hiển thị hình ảnh do AI tạo ra cực đẹp',
            action: 'Cầm điện thoại, ánh mắt mở to đầy bất ngờ, mỉm cười rạng rỡ',
            camera: 'Extreme Close-Up 85mm, góc ngước nhẹ, ánh sáng tự nhiên ấm áp',
            motionType: 'Camera slow push-in, mắt chớp biểu cảm bất ngờ',
            stockUrl: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'PROBLEM',
            purpose: 'Thể hiện khó khăn ban đầu khi tiếp cận công nghệ phức tạp',
            sceneDescription: 'Ông cụ tóc bạc ngồi trước laptop, tay gõ phím cẩn thận từng chữ để nhập câu lệnh prompt AI',
            characterRole: 'Ông cụ 72 tuổi (Elderly Grandfather)',
            mainObject: 'Laptop và bàn phím hiển thị giao diện nhập text AI',
            action: 'Nhập từng phím cẩn thận, chăm chú nhìn màn hình',
            camera: 'Over-the-shoulder Medium Shot 50mm, góc nhìn qua vai',
            motionType: 'Ngón tay gõ phím, con trỏ nhấp nháy trên màn hình',
            stockUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'DISCOVERY_ACTION',
            purpose: 'Khoảnh khắc AI biến dòng chữ thành tác phẩm nghệ thuật kỳ diệu',
            sceneDescription: 'Cận cảnh màn hình laptop biến đổi từ dòng chữ prompt thành bức tranh sơn dầu tuyệt đẹp',
            characterRole: 'Giao diện tương tác AI & Người sáng tạo',
            mainObject: 'Màn hình máy tính / Tablet đang Render hình ảnh AI nghệ thuật',
            action: 'Thao tác click chuột, hiệu ứng chuyển đổi hình ảnh mượt mà',
            camera: 'Macro Screen Shot 100mm, tiêu cự nông, ánh sáng xanh mát dịu',
            motionType: 'Hiệu ứng ánh sáng quét từ trái qua phải, tranh hiện dần',
            stockUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'REACTION_PAYOFF',
            purpose: 'Cảm xúc vỡ òa hạnh phúc và chia sẻ cùng người thân trong gia đình',
            sceneDescription: 'Cặp vợ chồng già cùng con cháu quây quần bên máy tính bảng, cùng cười rạng rỡ ngắm tác phẩm AI vừa tạo',
            characterRole: 'Cặp vợ chồng già & Con cháu (Multi-generation Family)',
            mainObject: 'Máy tính bảng hiển thị video/ảnh gia đình do AI phục dựng',
            action: 'Cùng chỉ tay vào màn hình, cười vui vẻ hạnh phúc',
            camera: 'Medium-Wide Group Shot 35mm, ánh sáng phòng khách ấm cúng',
            motionType: 'Chuyển động lia máy nhẹ (Slow Pan), nụ cười rạng rỡ',
            stockUrl: 'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'ENDING_CTA',
            purpose: 'Khẳng định tuổi tác không phải là rào cản và kêu gọi thử nghiệm ngay',
            sceneDescription: 'Bà cụ tự tin cầm điện thoại giơ cao bức ảnh AI vừa tạo với nụ cười chiến thắng',
            characterRole: 'Bà cụ tự tin thành thạo AI (Empowered Senior)',
            mainObject: 'Điện thoại thông minh với nút Subscribe / Follow kênh',
            action: 'Vẫy tay chào và nở nụ cười tự tin tràn đầy năng lượng',
            camera: 'Cinematic Portrait Shot 85mm, bokeh lung linh phía sau',
            motionType: 'Zoom out chậm, ánh sáng viền hào quang ấm áp',
            stockUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1080&q=85'
          }
        ]
      },

      // 2. ẨM THỰC / MÌ CAY / NẤU ĂN (FOOD & NOODLES)
      food_noodles: {
        keywords: ['mì', 'mì cay', 'ramen', 'phở', 'bún', 'nấu ăn', 'ẩm thực', 'công thức', 'bếp', 'ăn uống', 'đầu bếp'],
        beats: [
          {
            shotType: 'HOOK',
            purpose: 'Kích thích vị giác tức thì trong 2s đầu bằng món ăn bốc khói đậm đà',
            sceneDescription: 'Bát mì cay hải sản lớn bốc khói ngùn ngụt, ớt tươi đỏ rực, tôm tươi và sợi mì vàng óng',
            characterRole: 'Món ăn thống trị khung hình (Main Subject 60%)',
            mainObject: 'Bát mì cay hải sản khổng lồ sôi sùng sục',
            action: 'Nước sốt sôi nhẹ, khói nóng bay lên nghi ngút',
            camera: 'Macro Low-Angle Shot 100mm, ánh sáng vàng ấm rực rỡ',
            motionType: 'Slow Motion Zoom-in, khói bốc uốn lượn',
            stockUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'ACTION_COOKING',
            purpose: 'Thể hiện bí quyết chuẩn bị nguyên liệu và kỹ thuật nấu nướng',
            sceneDescription: 'Bàn tay đầu bếp / người nội trợ thái ớt tươi, gia vị thảo mộc và thả mì vào nồi nước dùng gà sôi',
            characterRole: 'Đầu bếp truyền thống / Người nội trợ (Chef/Cook)',
            mainObject: 'Nồi nước dùng sôi sùng sục, thớt gỗ và ớt tươi',
            action: 'Thả nguyên liệu vào nồi, đảo đều tay điêu luyện',
            camera: 'Top-Down Flat Lay Shot 50mm, góc nhìn từ trên cao',
            motionType: 'Nước sôi sủi bọt, gia vị hòa quyện bốc khói',
            stockUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'ACTION_EATING',
            purpose: 'Hành động gắp mì và cảm giác thỏa mãn khi thưởng thức',
            sceneDescription: 'Người thưởng thức dùng đũa gỗ gắp một gắp mì dài óng ả, nước sốt chảy sóng sánh',
            characterRole: 'Thực khách hào hứng (Hungry Eater)',
            mainObject: 'Đũa gỗ nâng sợi mì vàng óng khỏi bát nước dùng',
            action: 'Gắp mì đưa lên cao, thổi nhẹ làn khói nóng',
            camera: 'Close-Up Eye-Level Shot 85mm, tiêu cự nông',
            motionType: 'Sợi mì được nâng lên chuyển động mượt mà',
            stockUrl: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'DETAIL_TEXTURE',
            purpose: 'Cận cảnh thành phần đặc biệt giúp giải quyết sai lầm nấu nướng',
            sceneDescription: 'Cận cảnh thìa nước dùng sóng sánh vàng óng và các loại rau gia vị tươi giòn',
            characterRole: 'Chi tiết nguyên liệu chuẩn',
            mainObject: 'Thìa sứ múc nước sốt mì cay thơm lừng',
            action: 'Nước sốt rưới nhẹ lên bề mặt bát mì',
            camera: 'Extreme Macro Shot 100mm, sắc nét từng hạt gia vị',
            motionType: 'Dòng nước sốt chảy sánh mịn phản chiếu ánh đèn',
            stockUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'ENDING_CTA',
            purpose: 'Bàn tiệc trọn vẹn và kêu gọi lưu công thức / đăng ký kênh',
            sceneDescription: 'Gia đình cùng nhau quây quần thưởng thức bữa ăn ấm cúng, hạnh phúc trọn vẹn',
            characterRole: 'Gia đình hạnh phúc (Happy Family)',
            mainObject: 'Bàn ăn gia đình đầy ắp món ngon & Ebook công thức',
            action: 'Cùng nâng ly và mỉm cười hài lòng',
            camera: 'Medium Wide Shot 35mm, không gian bếp gia đình ấm áp',
            motionType: 'Camera từ từ kéo lùi (Pull-back) mở rộng khung cảnh',
            stockUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=1080&q=85'
          }
        ]
      },

      // 3. THIÊN NHIÊN / DU LỊCH SINH THÁI (NATURE & ECO TRAVEL)
      travel_nature: {
        keywords: ['du lịch', 'sinh thái', 'mũi né', 'phong nha', 'côn đảo', 'hạ long', 'sapa', 'thiên nhiên', 'rừng', 'biển', 'thám hiểm'],
        beats: [
          {
            shotType: 'HOOK',
            purpose: 'Cảnh quan thiên nhiên kỳ vĩ mở đầu đánh bay định kiến',
            sceneDescription: 'Góc flycam quét từ trên cao xuống cồn cát Mũi Né vàng óng lúc bình minh tuyệt mỹ',
            characterRole: 'Cảnh quan thiên nhiên Việt Nam 4K',
            mainObject: 'Cồn cát vàng uốn lượn và bờ biển xanh ngắt',
            action: 'Những vạt nắng sớm trải dài trên đồi cát',
            camera: 'Cinematic Drone Establishing Shot 24mm, góc rộng hùng vĩ',
            motionType: 'Flycam lướt nhanh về phía trước (Drone Forward Sweep)',
            stockUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'DISCOVERY_CAVE',
            purpose: 'Khám phá điểm đến bí ẩn ít người biết',
            sceneDescription: 'Nhà thám hiểm cầm đèn pin rọi vào hang động thạch nhũ lung linh và dòng sông ngầm Phong Nha',
            characterRole: 'Nhà thám hiểm dã ngoại (Wilderness Explorer)',
            mainObject: 'Đèn pin công suất lớn và vòm hang thạch nhũ',
            action: 'Bước đi cẩn thận, rọi đèn chiêm ngưỡng vòm hang',
            camera: 'Medium Shot Low-Angle 50mm, ánh sáng đèn pin tương phản cao',
            motionType: 'Vệt sáng đèn pin quét qua vách đá thạch nhũ',
            stockUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'OCEAN_PARADISE',
            purpose: 'Trải nghiệm biển đảo hoang sơ trong vắt',
            sceneDescription: 'Làn nước biển Côn Đảo trong vắt như gương nhìn thấy rõ từng rạn san hô bên dưới',
            characterRole: 'Khách du lịch chiêm ngưỡng biển đảo',
            mainObject: 'Mặt nước biển xanh ngọc bích và rạn san hô',
            action: 'Chèo thuyền kayak nhẹ nhàng lướt trên mặt nước',
            camera: 'High-Angle POV Shot 35mm, ánh nắng nhiệt đới rực rỡ',
            motionType: 'Mái chèo khuấy nhẹ tạo gợn sóng lấp lánh',
            stockUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'ENDING_CTA',
            purpose: 'Kêu gọi xách ba lô lên và đi bảo tồn du lịch xanh',
            sceneDescription: 'Nhà thám hiểm đứng trên đỉnh núi dang tay đón gió hoàng hôn rực rỡ',
            characterRole: 'Nhà du lịch bền vững (Eco Traveler)',
            mainObject: 'Ba lô dã ngoại và khung cảnh núi non trùng điệp',
            action: 'Dang tay hít thở không khí trong lành tự do',
            camera: 'Cinematic Sunset Backlight Shot 50mm, viền sáng vàng rực',
            motionType: 'Camera xoay quanh nhân vật (Orbit 45 độ)',
            stockUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1080&q=85'
          }
        ]
      },

      // 4. EM BÉ & HÀI HƯỚC (CUTE BABY & VIRAL SHORT)
      cute_baby: {
        keywords: ['em bé', 'baby', 'trẻ em', 'cute', 'hài hước bé', 'toddler'],
        beats: [
          {
            shotType: 'HOOK',
            purpose: 'Cận cảnh em bé mắt to tròn tạo sự thu hút đáng yêu tức thì',
            sceneDescription: 'Em bé bụ bẫm mắt to tròn long lanh nhìn chằm chằm đầy tò mò',
            characterRole: 'Em bé dễ thương (Cute Toddler)',
            mainObject: 'Khuôn mặt em bé với đôi mắt to tròn và má phúng phính',
            action: 'Chớp mắt ngây thơ, mấp máy môi',
            camera: 'Extreme Close-Up 85mm, ánh sáng dịu nhẹ',
            motionType: 'Slow push-in, đôi mắt lúng liếng',
            stockUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'ACTION_INTERACT',
            purpose: 'Tương tác hài hước với đồ vật / trái cây tươi ngon',
            sceneDescription: 'Em bé cầm quả xoài / món đồ chơi giơ lên miệng nếm thử',
            characterRole: 'Em bé ngây ngô & Người lớn',
            mainObject: 'Miếng xoài vàng ươm mọng nước',
            action: 'Cắn thử miếng xoài, biểu cảm ngạc nhiên thích thú',
            camera: 'Medium Close-Up 50mm',
            motionType: 'Đầu lắc lư thích thú, tay vẫy nhẹ',
            stockUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1080&q=85'
          },
          {
            shotType: 'PAYOFF_LAUGH',
            purpose: 'Tiếng cười giòn tan kết thúc video và kích thích rewatch',
            sceneDescription: 'Em bé ngửa đầu cười tít mắt rạng rỡ, hai má ửng hồng',
            characterRole: 'Em bé cười tươi (Laughing Baby)',
            mainObject: 'Nụ cười thiên thần tỏa sáng',
            action: 'Cười khúc khích, hai tay xoa bụng',
            camera: 'Low-Angle Close-Up 85mm',
            motionType: 'Hai vai rung lên theo tiếng cười giòn giã',
            stockUrl: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1080&q=85'
          }
        ]
      }
    };
  }

  // Phân giải kịch bản thành danh sách phân cảnh chuẩn Visual Storytelling
  generateVisualStoryScenes(topic = '', scriptData = {}) {
    const fullText = `${topic} ${scriptData.hook || ''} ${scriptData.body || ''} ${JSON.stringify(scriptData.bodySections || [])}`.toLowerCase();

    // 1. Khớp Archetype phù hợp nhất với chủ đề
    let selectedArchetype = this.storyArchetypes.travel_nature;
    for (const [key, arch] of Object.entries(this.storyArchetypes)) {
      if (arch.keywords.some(k => fullText.includes(k))) {
        selectedArchetype = arch;
        break;
      }
    }

    const beats = selectedArchetype.beats;
    const rawSections = (scriptData.bodySections && scriptData.bodySections.length > 0)
      ? scriptData.bodySections
      : [{ heading: 'Nội dung', content: scriptData.body || 'Chi tiết thực chiến' }];

    const generatedScenes = [];

    // Scene 1: HOOK (Luôn lấy beat 0)
    const hookText = scriptData.hook || 'Bí mật quan trọng bạn chưa từng biết.';
    const hookBeat = beats[0];
    generatedScenes.push({
      index: 1,
      type: 'HOOK',
      title: `Shot 1: ${hookBeat.shotType} — ${hookBeat.purpose}`,
      text: hookText,
      durationSec: 4,
      scenePurpose: hookBeat.purpose,
      characterRole: hookBeat.characterRole,
      mainObject: hookBeat.mainObject,
      action: hookBeat.action,
      cameraVariation: hookBeat.camera,
      motionType: hookBeat.motionType,
      imageUrl: hookBeat.stockUrl,
      personaAvatarUrl: hookBeat.stockUrl,
      personaName: hookBeat.characterRole
    });

    // Scene 2..N-1: BODY BEATS (Khớp lần lượt qua từng beat trung gian không lặp lại)
    rawSections.forEach((sec, idx) => {
      const beatIdx = (idx + 1) % (beats.length - 1);
      const currentBeat = beats[beatIdx === 0 ? 1 : beatIdx];
      const secContent = sec.content || sec.heading || '';

      generatedScenes.push({
        index: idx + 2,
        type: 'BODY',
        title: `Shot ${idx + 2}: ${currentBeat.shotType} — ${sec.heading || 'Diễn biến ' + (idx + 1)}`,
        text: secContent,
        durationSec: 5,
        scenePurpose: currentBeat.purpose,
        characterRole: currentBeat.characterRole,
        mainObject: currentBeat.mainObject,
        action: currentBeat.action,
        cameraVariation: currentBeat.camera,
        motionType: currentBeat.motionType,
        imageUrl: currentBeat.stockUrl,
        personaAvatarUrl: currentBeat.stockUrl,
        personaName: currentBeat.characterRole
      });
    });

    // Final Scene: ENDING / CTA
    const ctaText = scriptData.callToAction || scriptData.cta || 'Đăng ký kênh để xem thêm bí quyết!';
    const endBeat = beats[beats.length - 1];
    generatedScenes.push({
      index: generatedScenes.length + 1,
      type: 'CTA',
      title: `Shot ${generatedScenes.length + 1}: ${endBeat.shotType} — ${endBeat.purpose}`,
      text: ctaText,
      durationSec: 4,
      scenePurpose: endBeat.purpose,
      characterRole: endBeat.characterRole,
      mainObject: endBeat.mainObject,
      action: endBeat.action,
      cameraVariation: endBeat.camera,
      motionType: endBeat.motionType,
      imageUrl: endBeat.stockUrl,
      personaAvatarUrl: endBeat.stockUrl,
      personaName: endBeat.characterRole
    });

    return generatedScenes;
  }
}

module.exports = new VisualStorytellingEngine();
