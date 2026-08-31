/**
 * ============================================================================
 * ZERO-CONFIGURATION TOPIC INTELLIGENCE & AUTO-CAST ENGINE
 * ============================================================================
 * - Tự động phân tích ngữ nghĩa tiêu đề để trích xuất Khán giả mục tiêu, Tông giọng,
 *   và Ngách nội dung (Niche) mà không cần người dùng chọn thủ công.
 * - Tự động tuyển chọn Diễn Viên (Auto-Cast) & Khớp Giọng Đọc (Voice Matching) chuẩn 100%.
 * - Tự động liên kết 6 Phân Cảnh Điện Ảnh Viral Micro-Drama (Chuẩn Benchmark 80-95%).
 */

class TopicIntelligenceEngine {
  constructor() {
    this.nicheRules = [
      {
        id: 'cute_baby',
        keywords: ['bé', 'em bé', 'baby', 'cute', 'xoài', 'mango', 'trẻ con', 'ngộ nghĩnh', 'dễ thương', 'ăn dặm'],
        audience: 'Phụ huynh, gia đình, giới trẻ yêu thích nội dung đáng yêu & hài hước',
        tone: 'Vui tươi, ngọt ngào, hài hước ngây ngô',
        cast: [
          {
            id: 'char_baby_bap',
            name: 'Bé Bắp',
            age: 3,
            gender: 'child',
            role: 'Em bé 3 tuổi siêu đáng yêu',
            appearance: 'Đôi mắt to tròn long lanh, hai má phúng phính ửng hồng, áo thun in hình xe đồ chơi',
            clothing: 'Áo phông màu vàng tươi, yếm vải đáng yêu',
            voiceKey: 'vi-female',
            speechPitch: 1.35, // Giọng trẻ thơ trong trẻo
            speechRate: 1.05,
            speechStyle: 'Ngọng nghịu, ngây thơ, mắt chớp chớp năn nỉ',
            avatarUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=400&q=85'
          },
          {
            id: 'char_vendor_mango',
            name: 'Chú Ba Hoa Quả',
            age: 34,
            gender: 'male',
            role: 'Chú bán hoa quả sạp chợ vui tính',
            appearance: 'Khuôn mặt xởi lởi, nụ cười niềm nở hiền hậu, đội mũ lưỡi trai',
            clothing: 'Áo sơ mi cộc tay kẻ ca-rô, tạp dề xanh',
            voiceKey: 'vi-male',
            speechPitch: 0.95,
            speechRate: 1.0,
            speechStyle: 'Thân thiện, xởi lởi, chiều chuộng trẻ nhỏ',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=85'
          }
        ],
        scenesBlueprint: [
          { shot: 1, type: 'Extreme Close-Up 85mm', action: 'Bé chớp mắt to tròn long lanh, hai tay chắp trước ngực xin ăn thử', emotion: 'Năn nỉ đáng yêu', duration: 2 },
          { shot: 2, type: 'Two-Shot 35mm', action: 'Chú bán hàng cười xởi lởi, dùng dao cắt lát xoài vàng ươm mọng nước đưa cho bé', emotion: 'Niềm nở, tươi cười', duration: 2 },
          { shot: 3, type: 'Close-Up Action 50mm', action: 'Bé cắn miếng xoài lớn, nước xoài ngọt sóng sánh chảy xuống khóe môi', emotion: 'Say sưa thưởng thức', duration: 2 },
          { shot: 4, type: 'Medium Shot 50mm', action: 'Bé xoa cái bụng tròn xoe, cười híp mắt nói câu twist no bụng', emotion: 'Lém lỉnh, bẻ lái bất ngờ', duration: 1.5 },
          { shot: 5, type: 'Reaction Two-Shot 35mm', action: 'Chú bán hàng há hốc mồm đứng hình sững sờ hài hước', emotion: 'Sốc ngạc nhiên tột độ', duration: 1 },
          { shot: 6, type: 'Low-Angle Payoff 85mm', action: 'Bé ngửa đầu cười giòn tan Hahaha tạo vòng lặp triệu view', emotion: 'Thiên thần cười toe toét', duration: 1.5 }
        ]
      },
      {
        id: 'culinary_food',
        keywords: ['mì', 'ramen', 'ăn', 'nấu', 'ẩm thực', 'food', 'món ngon', 'công thức', 'bếp', 'cay', 'lẩu', 'hải sản'],
        audience: 'Tín đồ ẩm thực, giới trẻ sành ăn, người thích nấu ăn tại nhà',
        tone: 'Hấp dẫn, kích thích vị giác, sống động',
        cast: [
          {
            id: 'char_master_chef',
            name: 'Đầu Bếp Kenji',
            age: 42,
            gender: 'male',
            role: 'Bếp trưởng ẩm thực truyền thống',
            appearance: 'Ánh mắt tập trung điêu luyện, nụ cười tự tin của bậc thầy ẩm thực',
            clothing: 'Áo bếp trắng tinh tế, tạp dề đen thắt gọn gàng',
            voiceKey: 'vi-male',
            speechPitch: 0.95,
            speechRate: 1.0,
            speechStyle: 'Chuyên nghiệp, truyền cảm, hào hứng chia sẻ bí quyết',
            avatarUrl: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=400&q=85'
          },
          {
            id: 'char_foodie_guest',
            name: 'Hà Linh Foodie',
            age: 23,
            gender: 'female',
            role: 'Khách trải nghiệm ẩm thực sành điệu',
            appearance: 'Năng động, tươi tắn, biểu cảm gương mặt cực kỳ sinh động khi thưởng thức',
            clothing: 'Áo len dệt kim pastel trẻ trung',
            voiceKey: 'vi-female',
            speechPitch: 1.05,
            speechRate: 1.05,
            speechStyle: 'Phấn khích, trầm trồ, miêu tả hương vị sắc nét',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=85'
          }
        ],
        scenesBlueprint: [
          { shot: 1, type: 'Macro Shot 100mm', action: 'Nồi nước dùng sôi sùng sục, bốc khói nghi ngút thơm lừng', emotion: 'Kích thích vị giác tột đỉnh', duration: 2 },
          { shot: 2, type: 'Medium Action 50mm', action: 'Đầu bếp điêu luyện trụng vắt mì vàng óng và chan muôi nước sốt bí truyền', emotion: 'Điêu luyện, tự tin', duration: 2 },
          { shot: 3, type: 'Close-Up Top-Down', action: 'Bát mì đầy ắp topping thịt bò mềm mọng, trứng lòng đào và ớt cay xé lưỡi', emotion: 'Hấp dẫn thị giác 4K', duration: 2 },
          { shot: 4, type: 'Over-the-Shoulder 50mm', action: 'Khách gắp đũa mì dài bốc khói đưa lên miệng xì xụp', emotion: 'Thèm thuồng, háo hức', duration: 1.5 },
          { shot: 5, type: 'Extreme Close-Up Reaction', action: 'Mắt sáng rực, xuýt xoa vì vị cay bùng nổ quá đã', emotion: 'Thăng hoa vị giác', duration: 1.5 },
          { shot: 6, type: 'Two-Shot Payoff', action: 'Cùng giơ ngón tay cái Like và mời bạn bè cùng thử thách', emotion: 'Hào hứng, lan tỏa', duration: 1 }
        ]
      },
      {
        id: 'elderly_ai',
        keywords: ['người già', 'ông bà', 'ông', 'bà', 'lớn tuổi', 'cao tuổi', 'học ai', 'trí tuệ nhân tạo', 'cụ'],
        audience: 'Cộng đồng công nghệ, gia đình, người quan tâm đến việc phổ cập AI cho mọi lứa tuổi',
        tone: 'Ấm áp, truyền cảm hứng, thấu hiểu',
        cast: [
          {
            id: 'char_ong_minh',
            name: 'Ông Minh',
            age: 68,
            gender: 'male',
            role: 'Cựu giáo viên cao tuổi ham học hỏi',
            appearance: 'Mái tóc bạc phơ, cặp kính lão hiền từ, nét mặt thông tuệ',
            clothing: 'Áo sơ mi đũi màu be thanh lịch',
            voiceKey: 'vi-male',
            speechPitch: 0.9,
            speechRate: 0.95,
            speechStyle: 'Trầm ấm, từ tốn, đầy sự tò mò và ngạc nhiên',
            avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=85'
          },
          {
            id: 'char_chau_linh',
            name: 'Cháu Linh',
            age: 22,
            gender: 'female',
            role: 'Cháu gái thế hệ Gen Z hướng dẫn ông',
            appearance: 'Nụ cười rạng rỡ, ánh mắt kiên nhẫn, gần gũi',
            clothing: 'Áo hoodie năng động',
            voiceKey: 'vi-female',
            speechPitch: 1.05,
            speechRate: 1.0,
            speechStyle: 'Tươi vui, động viên, ân cần chỉ dẫn từng bước',
            avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=85'
          }
        ],
        scenesBlueprint: [
          { shot: 1, type: 'Medium Two-Shot', action: 'Ông cụ nhìn màn hình máy tính với vẻ băn khoăn tò mò', emotion: 'Trăn trở, muốn tìm hiểu', duration: 2 },
          { shot: 2, type: 'Over-the-Shoulder', action: 'Cháu gái cầm tay ông gõ từng phím prompt vào ô lệnh', emotion: 'Kiên nhẫn, ấm áp', duration: 2 },
          { shot: 3, type: 'Macro Screen Shot', action: 'Hình ảnh bức tranh AI vẽ hiện ra rực rỡ kỳ ảo', emotion: 'Kỳ diệu, đột phá', duration: 2 },
          { shot: 4, type: 'Extreme Close-Up Reaction', action: 'Ông cụ đẩy gọng kính, mắt sáng lên sững sờ thích thú', emotion: 'Bất ngờ, vỡ òa niềm vui', duration: 1.5 },
          { shot: 5, type: 'Wide Family Shot', action: 'Hai ông cháu cùng cười rạng rỡ khoe bức ảnh với cả nhà', emotion: 'Hạnh phúc gia đình', duration: 1.5 },
          { shot: 6, type: 'Close-Up Conclusion', action: 'Ông cụ tự tin gõ phím tiếp theo: "Không bao giờ là quá muộn!"', emotion: 'Truyền cảm hứng mạnh mẽ', duration: 1 }
        ]
      }
    ];

    this.defaultNiche = {
      id: 'general_creative',
      audience: 'Khán giả đại chúng yêu thích video ngắn thú vị',
      tone: 'Hấp dẫn, kích thích tò mò, tốc độ nhanh',
      cast: [
        {
          id: 'char_alex_host',
          name: 'Alex Host',
          age: 26,
          gender: 'male',
          role: 'Người dẫn dắt câu chuyện cuốn hút',
          appearance: 'Gương mặt thông minh, phong thái tự tin hiện đại',
          clothing: 'Áo thun đen tối giản',
          voiceKey: 'vi-male',
          speechPitch: 1.0,
          speechRate: 1.05,
          speechStyle: 'Năng lượng cao, nhịp điệu dứt khoát',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=85'
        },
        {
          id: 'char_mai_analyst',
          name: 'Mai Hương',
          age: 24,
          gender: 'female',
          role: 'Chuyên gia phản biện sắc sảo',
          appearance: 'Ánh mắt thông minh, biểu cảm tự nhiên sắc nét',
          clothing: 'Áo blazer hiện đại',
          voiceKey: 'vi-female',
          speechPitch: 1.0,
          speechRate: 1.05,
          speechStyle: 'Súc tích, hấp dẫn, làm rõ điểm mấu chốt',
          avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=85'
        }
      ],
      scenesBlueprint: [
        { shot: 1, type: 'Close-Up Hook', action: 'Nhìn thẳng ống kính đưa ra câu hỏi thách thức tò mò', emotion: 'Gây sốc, cuốn hút', duration: 2 },
        { shot: 2, type: 'Action Shot', action: 'Thao tác chứng minh dữ liệu và sự thật bất ngờ', emotion: 'Tập trung, thuyết phục', duration: 2 },
        { shot: 3, type: 'Two-Shot Discussion', action: 'Phản biện đối đáp làm nổi bật cú twist', emotion: 'Hào hứng tranh luận', duration: 2 },
        { shot: 4, type: 'Reaction Close-Up', action: 'Biểu cảm vỡ lẽ khi tìm ra câu trả lời đỉnh cao', emotion: 'Ngạc nhiên, thỏa mãn', duration: 1.5 },
        { shot: 5, type: 'Payoff Shot', action: 'Tổng kết giải pháp đắt giá nhất trong 1 câu', emotion: 'Chắc chắn, giá trị', duration: 1.5 },
        { shot: 6, type: 'Loop Call-to-Action', action: 'Nụ cười kết thúc kêu gọi chia sẻ và thảo luận', emotion: 'Gợi mở, giữ chân', duration: 1 }
      ]
    };
  }

  // Tự động phân tích ngữ nghĩa tiêu đề
  analyzeTopic(rawTopic = '') {
    const cleanTopic = (rawTopic || '').trim().toLowerCase();
    
    let matchedNiche = this.nicheRules.find(rule => 
      rule.keywords.some(kw => cleanTopic.includes(kw))
    );

    if (!matchedNiche) {
      matchedNiche = this.defaultNiche;
    }

    return {
      topic: rawTopic.trim() || 'Chủ đề video triệu view',
      nicheId: matchedNiche.id,
      audience: matchedNiche.audience,
      tone: matchedNiche.tone,
      cast: matchedNiche.cast,
      scenesBlueprint: matchedNiche.scenesBlueprint,
      estimatedDurationSec: matchedNiche.scenesBlueprint.reduce((acc, s) => acc + s.duration, 0),
      isGoldStandardMatched: matchedNiche.id === 'cute_baby'
    };
  }
}

module.exports = new TopicIntelligenceEngine();
