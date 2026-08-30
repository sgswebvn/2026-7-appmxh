/**
 * ============================================================================
 * CONVERSATIONAL STORY DIRECTOR & MULTI-CHARACTER DIALOGUE ENGINE
 * ============================================================================
 * Architecture:
 * TOPIC -> STORY WORLD -> CHARACTER CAST -> DIALOGUE -> SCENES -> SHOTS -> PERFORMANCE -> VIDEO
 * 
 * 3 Generation Modes:
 * - MODE 1: NARRATOR (Thông tin / Phim tài liệu)
 * - MODE 2: CONVERSATION (Mặc định: Nhân vật đối thoại qua lại, biểu cảm, reaction)
 * - MODE 3: HYBRID (Kết hợp đối thoại nhân vật + lời bình cô đọng)
 */

class ConversationalStoryDirectorService {
  constructor() {
    this.storyFormatLibrary = [
      'conversation', 'comedy', 'argument', 'family', 'friendship', 
      'mini-drama', 'reaction', 'tutorial', 'challenge', 'before-after'
    ];
  }

  // 1. TẠO CỐT TRUYỆN & DÀN DIỄN VIÊN ĐỐI THOẠI (STORY & CAST)
  generateConversationalStory(topic = '', mode = 'CONVERSATION') {
    const lower = (topic || '').toLowerCase();

    // 1.1. Case: Người cao tuổi & Công nghệ / AI
    if (lower.includes('người cao tuổi') || lower.includes('người già') || lower.includes('ông') || lower.includes('bà') || lower.includes('60 tuổi') || lower.includes('70 tuổi')) {
      return {
        title: topic || 'Hành Trình Người Cao Tuổi Thử Nghiệm AI',
        premise: 'Một ông lão 68 tuổi vốn không tin AI có thể giúp ích cho mình, cho đến khi người cháu hướng dẫn ông tạo ra tác phẩm video đầu tiên.',
        genre: 'Heartwarming Family & Tech Discovery Mini-Drama',
        mode: mode || 'CONVERSATION',
        tone: 'Hài hước, gần gũi, ấm áp, truyền cảm hứng',
        setting: 'Phòng khách gia đình ấm cúng, bàn trà gỗ, ánh sáng cửa sổ chiều',
        conflict: 'Ông Minh cho rằng AI là thứ xa vời của giới trẻ và quá phức tạp.',
        resolution: 'Ông Minh tự tay nhập prompt và sững sờ trước bức ảnh kỷ niệm phục dựng hoàn hảo.',
        cast: [
          {
            id: 'char_ong_minh',
            name: 'Ông Minh',
            age: 68,
            gender: 'male',
            role: 'Người ông tóc bạc hiền từ (Grandfather)',
            personality: 'Cẩn trọng, hơi bảo thủ lúc đầu, yêu thương con cháu',
            appearance: 'Tóc bạc hoa râm, đeo kính lão gọng vàng, nụ cười đôn hậu',
            clothing: 'Áo sơ mi đũi màu be giản dị, quần âu tối màu',
            voice: 'vi-male',
            speechStyle: 'Trầm ấm, nói chậm rãi, thắc mắc chân thành',
            avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=85'
          },
          {
            id: 'char_chau_linh',
            name: 'Cháu Linh',
            age: 24,
            gender: 'female',
            role: 'Cháu gái năng động, am hiểu công nghệ (Granddaughter)',
            personality: 'Kiên nhẫn, vui tươi, thích hướng dẫn và động viên',
            appearance: 'Mắt sáng thông minh, tóc buộc gọn gàng, nụ cười tươi',
            clothing: 'Áo cardigan len mỏng màu pastel trẻ trung',
            voice: 'vi-female',
            speechStyle: 'Nhí nhảnh, rõ ràng, khích lệ tự nhiên',
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=85'
          }
        ],
        relationships: [
          { from: 'char_ong_minh', to: 'char_chau_linh', type: 'Grandfather ↔ Granddaughter', dynamic: 'Thương mến, tin cậy, ông cháu tâm sự thân thiết' }
        ],
        dialogueScript: [
          {
            speakerId: 'char_ong_minh',
            speakerName: 'Ông Minh (68t)',
            text: 'Cháu ơi, cái AI này khó quá, tuổi ông làm sao mà dùng được!',
            emotion: 'Hoài nghi & Lúng túng',
            intent: 'Bày tỏ sự e ngại ban đầu',
            targetCharacter: 'char_chau_linh',
            action: 'Gãi đầu, chỉ tay vào chiếc laptop đầy bối rối',
            shotType: 'Over-the-shoulder Close-Up (Ông -> Cháu)',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_chau_linh',
            speakerName: 'Cháu Linh (24t)',
            text: 'Dễ lắm ông ơi! Ông chỉ cần nói cho nó biết ông muốn vẽ bức tranh gì là xong.',
            emotion: 'Tươi vui & Động viên',
            intent: 'Giải thích đơn giản hóa vấn đề',
            targetCharacter: 'char_ong_minh',
            action: 'Cười tươi, kéo ghế ngồi sát lại và chỉ nhẹ vào bàn phím',
            shotType: 'Two-Shot Medium Angle (Hai ông cháu bên laptop)',
            voiceKey: 'vi-female',
            imageUrl: 'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_ong_minh',
            speakerName: 'Ông Minh (68t)',
            text: 'Thật á? Để ông bảo nó vẽ lại khu vườn hoa hồi trẻ của bà nhé...',
            emotion: 'Háo hức & Tập trung',
            intent: 'Thử nghiệm hành động thực tế',
            targetCharacter: 'char_chau_linh',
            action: 'Chỉnh lại gọng kính, cẩn thận gõ từng phím với ánh mắt sáng ngời',
            shotType: 'Macro Fingers Typing & Screen Transition Shot',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_chau_linh',
            speakerName: 'Cháu Linh (24t)',
            text: 'Ông nhìn màn hình này... Xong rồi kìa ông ơi!',
            emotion: 'Kinh ngạc & Tự hào',
            intent: 'Tạo cao trào cảm xúc vỡ òa',
            targetCharacter: 'char_ong_minh',
            action: 'Vỗ tay reo lên, mắt mở to chỉ vào tác phẩm rực rỡ',
            shotType: 'Extreme Close-Up Screen to Face Reaction',
            voiceKey: 'vi-female',
            imageUrl: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_ong_minh',
            speakerName: 'Ông Minh (68t)',
            text: 'Trời ơi kỳ diệu quá! Giờ ông có thể tự làm cả video tặng bà rồi!',
            emotion: 'Cười rạng rỡ hạnh phúc',
            intent: 'Khẳng định thông điệp tuổi tác không là rào cản',
            targetCharacter: 'char_chau_linh',
            action: 'Cười tít mắt ngả người ra sau, hai ông cháu cùng cười hạnh phúc',
            shotType: 'Cinematic Payoff Portrait Two-Shot',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1080&q=85'
          }
        ]
      };
    }

    // 1.2. Case: Ẩm thực, Mì cay, Nấu ăn (Food & Culinary Conversation)
    if (lower.includes('mì') || lower.includes('ramen') || lower.includes('nấu') || lower.includes('ẩm thực') || lower.includes('bếp') || lower.includes('món ăn')) {
      return {
        title: topic || 'Bí Mật Bát Mì Cay Gia Truyền',
        premise: 'Cuộc trò chuyện dí dỏm giữa một Bếp Trưởng lão luyện và một Thực Khách tò mò về bí quyết giữ trọn vị cay thanh mà không nóng bụng.',
        genre: 'Culinary Comedy & Food Masterclass',
        mode: mode || 'CONVERSATION',
        tone: 'Hấp dẫn, khơi gợi vị giác, dí dỏm, bí truyền',
        setting: 'Quán mì truyền thống bằng gỗ mộc bốc khói nghi ngút, ánh đèn vàng ấm',
        conflict: 'Thực khách thắc mắc vì sao nấu ở nhà không ngon bằng quán.',
        resolution: 'Bếp trưởng tiết lộ 3 bí kíp chuẩn xác trong nồi nước dùng gà hầm 8 tiếng.',
        cast: [
          {
            id: 'char_bep_truong',
            name: 'Bác Ba Bếp Trưởng',
            age: 52,
            gender: 'male',
            role: 'Bếp trưởng mì gia truyền (Master Chef)',
            personality: 'Hào sảng, tự hào về tay nghề, thích chia sẻ bí kíp',
            appearance: 'Dáng vóc đẫy đà nhanh nhẹn, đội mũ vải đầu bếp, nụ cười đôn hậu',
            clothing: 'Tạp dề vải thô màu nâu sẫm, áo thun đen gọn gàng',
            voice: 'vi-male',
            speechStyle: 'Hào sảng, to rõ, đậm chất nghề bếp',
            avatarUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=400&q=85'
          },
          {
            id: 'char_thuc_khach',
            name: 'Hùng Thực Khách',
            age: 26,
            gender: 'male',
            role: 'Thực khách sành ăn (Curious Foodie)',
            personality: 'Đam mê ẩm thực, tò mò, thích học hỏi công thức',
            appearance: 'Khuôn mặt trẻ trung, mắt sáng, biểu cảm chân thật',
            clothing: 'Áo polo xám trẻ trung',
            voice: 'vi-male',
            speechStyle: 'Tò mò, ngạc nhiên, trầm trồ khen ngợi',
            avatarUrl: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=400&q=85'
          }
        ],
        relationships: [
          { from: 'char_bep_truong', to: 'char_thuc_khach', type: 'Chef ↔ Customer', dynamic: 'Tương tác nồng hậu, chia sẻ bí quyết ẩm thực' }
        ],
        dialogueScript: [
          {
            speakerId: 'char_thuc_khach',
            speakerName: 'Hùng Thực Khách (26t)',
            text: 'Bác Ba ơi, sao bát mì cay ở đây nước dùng vừa cay đậm mà lại ngọt thanh thế ạ?',
            emotion: 'Trầm trồ thắc mắc',
            intent: 'Đặt câu hỏi hook mở đầu',
            targetCharacter: 'char_bep_truong',
            action: 'Cầm đũa chỉ vào bát mì bốc khói ngùn ngụt',
            shotType: 'Macro Close-Up (Bát mì sôi & Đũa gỗ gắp mì)',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_bep_truong',
            speakerName: 'Bác Ba Bếp Trưởng (52t)',
            text: 'Bí quyết nằm ở 3 thứ: Ớt sừng nướng thơm, nước gà hầm 8 tiếng và sợi mì tươi kéo tay!',
            emotion: 'Tự hào & Chia sẻ',
            intent: 'Tiết lộ bí quyết cốt lõi',
            targetCharacter: 'char_thuc_khach',
            action: 'Tung chảo gia vị thơm phức, chan muôi nước sốt đỏ ươm',
            shotType: 'Top-Down Kitchen Action Shot (Đầu bếp nêm nếm)',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_thuc_khach',
            speakerName: 'Hùng Thực Khách (26t)',
            text: 'Thảo nào em nấu ở nhà cứ bị chua gắt... Giờ em mới hiểu!',
            emotion: 'Vỡ lẽ & Thích thú',
            intent: 'Giải quyết sai lầm thường gặp',
            targetCharacter: 'char_bep_truong',
            action: 'Gắp một gắp mì đầy ắp thổi phù phù đưa vào miệng',
            shotType: 'Close-Up Action Eating (Thực khách cắn miếng mì)',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_bep_truong',
            speakerName: 'Bác Ba Bếp Trưởng (52t)',
            text: 'Muốn có trọn bộ công thức 30 món mì cay chuẩn vị, nhấn theo dõi kênh ngay nhé!',
            emotion: 'Thân thiện & Kêu gọi',
            intent: 'Kêu gọi hành động CTA tự nhiên',
            targetCharacter: 'char_thuc_khach',
            action: 'Cười tươi giơ ngón tay cái Like cùng bàn tiệc đầy ắp',
            shotType: 'Medium Wide Payoff Shot (Bàn tiệc trọn vẹn)',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=1080&q=85'
          }
        ]
      };
    }

    // 1.3. Case: GOLD STANDARD BENCHMARK — Cute Baby Talking & Comic Vendor (Viral Short Format)
    if (lower.includes('baby') || lower.includes('em bé') || lower.includes('xoài') || lower.includes('mango') || lower.includes('trẻ em') || lower.includes('cute') || lower.includes('hài hước bé')) {
      return {
        title: topic || 'Cute Baby Talking About Mango 🥭 | Viral AI Short',
        premise: 'Em bé mắt to tròn tinh nghịch xin chú bán hoa quả nếm thử miếng xoài chín, nhưng sau khi ăn xong lại có câu trả lời khiến chú ngỡ ngàng bật ngửa.',
        genre: 'Cute AI Baby & Comic Vendor Micro-Drama',
        mode: mode || 'CONVERSATION',
        tone: 'Siêu đáng yêu, hài hước bất ngờ, nụ cười tỏa nắng, viral 100%',
        setting: 'Sạp trái cây rực rỡ ngoài chợ phố, các sọt xoài chín vàng ươm bốc mùi thơm ngọt',
        conflict: 'Bé muốn ăn thử xoài ngon nhưng không muốn mua cả quả.',
        resolution: 'Bé nếm xong khen ngon nức nở nhưng bảo "con no bụng rồi" và cười phá lên.',
        cast: [
          {
            id: 'char_baby_mango',
            name: 'Bé Bắp (Cute Baby)',
            age: 3,
            gender: 'male',
            role: 'Em bé 3 tuổi mắt to tròn má phúng phính (Talking AI Baby)',
            personality: 'Ngây thơ, lém lỉnh, biểu cảm cực kỳ phong phú và đáng yêu',
            appearance: 'Đôi mắt to tròn long lanh, lông mi cong, hai má ửng hồng phúng phính',
            clothing: 'Áo thun in hình cây dừa và ô tô rực rỡ sắc màu',
            voice: 'vi-female',
            speechStyle: 'Giọng em bé ngọng nghịu, trong trẻo, dễ thương siêu cấp',
            avatarUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=400&q=85'
          },
          {
            id: 'char_chu_ban_xoai',
            name: 'Chú Ba Bán Xoài',
            age: 34,
            gender: 'male',
            role: 'Chú bán trái cây vui tính (Friendly Fruit Vendor)',
            personality: 'Hiền lành, xởi lởi, thích trêu đùa trẻ con',
            appearance: 'Khuôn mặt phúc hậu, nụ cười tươi, dáng người khỏe khoắn',
            clothing: 'Tạp dề xanh lá sẫm và áo sơ mi cộc tay',
            voice: 'vi-male',
            speechStyle: 'Trầm ấm, vui vẻ, ngạc nhiên hài hước',
            avatarUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=400&q=85'
          }
        ],
        relationships: [
          { from: 'char_baby_mango', to: 'char_chu_ban_xoai', type: 'Cute Toddler ↔ Friendly Fruit Vendor', dynamic: 'Tương tác đối đáp lém lỉnh, gây cười bất ngờ' }
        ],
        dialogueScript: [
          {
            speakerId: 'char_baby_mango',
            speakerName: 'Bé Bắp (3t)',
            text: 'Chú ơi, cho con nếm thử một miếng xoài chín đi chú?',
            emotion: 'Đáng yêu & Cầu khẩn',
            intent: 'Hook mở đầu 2s cực kỳ dễ thương',
            targetCharacter: 'char_chu_ban_xoai',
            action: 'Mắt mở to long lanh ngước nhìn chú bán xoài với đôi môi mấp máy',
            shotType: 'Extreme Close-Up 85mm (Khuôn mặt em bé tỏa sáng)',
            voiceKey: 'vi-female',
            imageUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_chu_ban_xoai',
            speakerName: 'Chú Ba Bán Xoài (34t)',
            text: 'Nè bé con, ăn thử xem xoài của chú ngọt lịm không nào!',
            emotion: 'Niềm nở & Yêu mến',
            intent: 'Trao đồ vật tương tác',
            targetCharacter: 'char_baby_mango',
            action: 'Cầm dao cắt miếng xoài vàng ươm mọng nước đưa cho bé',
            shotType: 'Two-Shot Medium Angle (Chú bán xoài cắt xoài cho bé)',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_baby_mango',
            speakerName: 'Bé Bắp (3t)',
            text: 'Ngon tuyệt cú mèo luôn chú ơi! Nhưng mà...',
            emotion: 'Thích thú & Ngon miệng',
            intent: 'Hành động cắn xoài mọng nước',
            targetCharacter: 'char_chu_ban_xoai',
            action: 'Cắn miếng xoài lớn, nước xoài vàng ngọt chảy sóng sánh xuống cằm',
            shotType: 'Close-Up Action Eating (Bé ăn xoài ngon lành)',
            voiceKey: 'vi-female',
            imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_baby_mango',
            speakerName: 'Bé Bắp (3t)',
            text: '...Nhưng mà con no bụng mất tiêu rồi chú ơi!',
            emotion: 'Lém lỉnh & Tinh nghịch',
            intent: 'Punchline cú twist bất ngờ',
            targetCharacter: 'char_chu_ban_xoai',
            action: 'Vẫy bàn tay nhỏ xíu, xoa xoa cái bụng tròn xoe',
            shotType: 'Close-Up Punchline Shot (Bé cười tít mắt vẫy tay)',
            voiceKey: 'vi-female',
            imageUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_chu_ban_xoai',
            speakerName: 'Chú Ba Bán Xoài (34t)',
            text: 'Hả?! Ăn thử xong bảo no bụng luôn là sao bé con!',
            emotion: 'Sốc hài hước & Há hốc mồm',
            intent: 'Phản ứng bất ngờ gây cười',
            targetCharacter: 'char_baby_mango',
            action: 'Há hốc mồm kinh ngạc, tay cầm dao đứng hình đầy hài hước',
            shotType: 'Reaction Shock Shot (Chú bán xoài ngơ ngác)',
            voiceKey: 'vi-male',
            imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1080&q=85'
          },
          {
            speakerId: 'char_baby_mango',
            speakerName: 'Bé Bắp (3t)',
            text: 'Hahaha! Chúc mọi người xem video vui vẻ nha!',
            emotion: 'Cười giòn tan hạnh phúc',
            intent: 'Ending Payoff & Rewatch Loop',
            targetCharacter: 'char_chu_ban_xoai',
            action: 'Ngửa đầu cười tít mắt giòn giã, hai má rung lên rạng rỡ',
            shotType: 'Low-Angle Laughing Payoff Ending Shot',
            voiceKey: 'vi-female',
            imageUrl: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1080&q=85'
          }
        ]
      };
    }

    // 1.4. Default Case: Du lịch & Khám phá đối thoại (Travel & Exploration Dialogues)
    return {
      title: topic || 'Hành Trình Khám Phá Kỳ Thú',
      premise: 'Chuyến phiêu lưu của hai người bạn qua những vùng đất hoang sơ tuyệt đẹp của Việt Nam.',
      genre: 'Travel Adventure & Buddy Dialogue',
      mode: mode || 'CONVERSATION',
      tone: 'Hào hứng, ngỡ ngàng, truyền cảm hứng xê dịch',
      setting: 'Đỉnh núi hùng vĩ đón hoàng hôn và hang động thạch nhũ',
      conflict: 'Liệu có còn những điểm đến hoang sơ chưa bị thương mại hóa?',
      resolution: 'Hai bạn trẻ tận mắt chứng kiến 5 kỳ quan sinh thái tuyệt mỹ.',
      cast: [
        {
          id: 'char_phuot_thu_1',
          name: 'Hải Explorer',
          age: 27,
          gender: 'male',
          role: 'Phượt thủ dã ngoại (Adventure Leader)',
          personality: 'Năng động, thích khám phá góc khuất hoang sơ',
          appearance: 'Khỏe khoắn, đeo ba lô dã ngoại, máy ảnh trước ngực',
          clothing: 'Áo khoác gió trekking chống nước màu rêu',
          voice: 'vi-male',
          speechStyle: 'Nhiệt huyết, tự tin',
          avatarUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=85'
        },
        {
          id: 'char_phuot_thu_2',
          name: 'Mai Travel',
          age: 25,
          gender: 'female',
          role: 'Bạn đồng hành đam mê thiên nhiên (Co-traveler)',
          personality: 'Nhạy cảm với vẻ đẹp thiên nhiên, biểu cảm giàu cảm xúc',
          appearance: 'Nụ cười tươi rạng rỡ, mắt sáng ngắm cảnh',
          clothing: 'Trang phục leo núi nhẹ nhàng, nón rộng vành',
          voice: 'vi-female',
          speechStyle: 'Trầm trồ, ngạc nhiên, truyền cảm hứng',
          avatarUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=400&q=85'
        }
      ],
      relationships: [
        { from: 'char_phuot_thu_1', to: 'char_phuot_thu_2', type: 'Travel Companions', dynamic: 'Bạn đồng hành ăn ý, cùng chia sẻ khoảnh khắc đẹp' }
      ],
      dialogueScript: [
        {
          speakerId: 'char_phuot_thu_1',
          speakerName: 'Hải Explorer (27t)',
          text: 'Mai ơi, nhìn kìa! Bạn sẽ không tin được ở Việt Nam lại có bãi cát và làn nước xanh như thế này!',
          emotion: 'Phấn khích & Choáng ngợp',
          intent: 'Hook thị giác hùng vĩ',
          targetCharacter: 'char_phuot_thu_2',
          action: 'Chỉ tay về phía bờ biển cồn cát Mũi Né lấp lánh',
          shotType: 'Establishing Drone to Two-Shot',
          voiceKey: 'vi-male',
          imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1080&q=85'
        },
        {
          speakerId: 'char_phuot_thu_2',
          speakerName: 'Mai Travel (25t)',
          text: 'Trời ơi đẹp quá! Nước trong vắt nhìn thấy cả rạn san hô bên dưới luôn!',
          emotion: 'Ngỡ ngàng hạnh phúc',
          intent: 'Khuếch đại cảm xúc ngạc nhiên',
          targetCharacter: 'char_phuot_thu_1',
          action: 'Chạy lại gần mạn thuyền kayak, cúi nhìn làn nước ngọc bích',
          shotType: 'High-Angle POV Water Shot',
          voiceKey: 'vi-female',
          imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&q=85'
        },
        {
          speakerId: 'char_phuot_thu_1',
          speakerName: 'Hải Explorer (27t)',
          text: 'Đi tiếp vào hang Phong Nha này, đảm bảo bạn còn ngất ngây hơn nữa!',
          emotion: 'Kêu gọi & Háo hức',
          intent: 'Chuyển cảnh leo thang kịch tính',
          targetCharacter: 'char_phuot_thu_2',
          action: 'Rọi đèn pin công suất lớn vào vòm hang thạch nhũ lung linh',
          shotType: 'Medium Cave Lighting Contrast Shot',
          voiceKey: 'vi-male',
          imageUrl: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1080&q=85'
        },
        {
          speakerId: 'char_phuot_thu_2',
          speakerName: 'Mai Travel (25t)',
          text: 'Xách ba lô lên và đăng ký kênh để cùng chúng mình đi tiếp nhé!',
          emotion: 'Nụ cười tỏa nắng',
          intent: 'CTA truyền cảm hứng hành động',
          targetCharacter: 'char_phuot_thu_1',
          action: 'Hai bạn trẻ cùng đứng trên đỉnh đồi dang tay đón gió hoàng hôn',
          shotType: 'Cinematic Sunset Backlight Two-Shot',
          voiceKey: 'vi-female',
          imageUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1080&q=85'
        }
      ]
    };
  }
}

module.exports = new ConversationalStoryDirectorService();
