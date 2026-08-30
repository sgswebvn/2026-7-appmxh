/**
 * ============================================================================
 * TOPIC-FIRST & OBJECT-FIRST IMAGE GENERATION ENGINE
 * ============================================================================
 * Nguyên tắc:
 * TOPIC -> SCENE -> OBJECT (40-60%) -> CHARACTER (20-40%) -> ACTION -> COMPOSITION -> IMAGE
 * - Tự động phát hiện Đối tượng chính (Mì cay, Món ăn, Trẻ em, Người lớn tuổi, Thiên nhiên, Công nghệ...)
 * - Không bao giờ chèn Robot hoặc nhân vật lạc quẻ vào món ăn hay đời sống thường ngày.
 */

class TopicFirstImageEngine {
  constructor() {
    this.topicCategories = [
      {
        id: 'food_noodles_spicy',
        keywords: ['mì', 'mì cay', 'ramen', 'phở', 'bún', 'hủ tiếu', 'noodle', 'soup', 'thức ăn', 'nấu ăn', 'ẩm thực', 'món ăn', 'công thức', 'bếp', 'ăn uống'],
        mainSubject: 'Bát mì cay bốc khói nghi ngút, sợi mì vàng óng, ớt tươi, tôm thịt và nước dùng đậm đà',
        characterMatrix: {
          elderly: {
            role: 'Người lớn tuổi / Ông bà đang thưởng thức mì cay nóng hổi hoặc tự tay nấu mì',
            action: 'Cầm đũa gắp sợi mì nóng hổi, nụ cười hiền hậu ấm áp',
            ageGroup: 'Elderly 60-70 years old'
          },
          child: {
            role: 'Em bé / Trẻ em hào hứng ăn mì',
            action: 'Mắt tròn xoe thích thú cầm bát mì',
            ageGroup: 'Child 4-8 years old'
          },
          chef: {
            role: 'Đầu bếp truyền thống đang chế biến nước dùng',
            action: 'Tung chảo, chan nước dùng thơm lừng vào bát mì',
            ageGroup: 'Adult 30-45 years old'
          },
          default: {
            role: 'Thực khách thưởng thức mì cay nóng hổi',
            action: 'Thưởng thức bát mì thơm phức bằng đũa',
            ageGroup: 'Adult'
          }
        },
        stockImages: [
          {
            type: 'HERO_SHOT',
            name: 'Bát Mì Cay Hải Sản Bốc Khói Nghi Ngút',
            url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1080&q=85',
            keywords: ['hook', 'mì cay', 'bát mì', 'nóng hổi']
          },
          {
            type: 'CHARACTER_ACTION',
            name: 'Gắp Sợi Mì Cay Nóng Hổi Bằng Đũa',
            url: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=1080&q=85',
            keywords: ['gắp mì', 'đũa', 'thưởng thức', 'ngon']
          },
          {
            type: 'ELDERLY_COOKING',
            name: 'Người Cao Tuổi & Bếp Nấu Ấm Cúng',
            url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1080&q=85',
            keywords: ['người già', 'lớn tuổi', 'nấu ăn', 'công thức', 'chuẩn bị']
          },
          {
            type: 'DETAIL_TEXTURE',
            name: 'Cận Cảnh Ớt Tươi & Nước Dùng Sôi Sùng Sục',
            url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1080&q=85',
            keywords: ['ớt', 'gia vị', 'nước dùng', 'sai lầm', 'chi tiết']
          },
          {
            type: 'PAYOFF_SATISFYING',
            name: 'Bàn Ăn Hoàn Hảo & Hướng Dẫn Nhận Ebook',
            url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=1080&q=85',
            keywords: ['cta', 'kêu gọi', 'ebook', 'hoàn tất', 'đăng ký']
          }
        ]
      },
      {
        id: 'elderly_health_wellness',
        keywords: ['người già', 'người lớn tuổi', 'cao tuổi', 'sức khỏe', 'dưỡng sinh', 'tuổi thọ', 'huyết áp', 'tim mạch', '60 tuổi', '70 tuổi'],
        mainSubject: 'Chăm sóc sức khỏe, bữa ăn dinh dưỡng & nụ cười an vui tuổi xế chiều',
        characterMatrix: {
          default: {
            role: 'Ông/Bà cao tuổi khỏe mạnh, nụ cười an nhiên',
            action: 'Thưởng thức bữa ăn bổ dưỡng trong ánh nắng sớm',
            ageGroup: 'Elderly 65-80 years old'
          }
        },
        stockImages: [
          {
            type: 'HERO_SHOT',
            name: 'Người Lớn Tuổi Khỏe Mạnh & Nụ Cười An Nhiên',
            url: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=1080&q=85',
            keywords: ['hook', 'người cao tuổi', 'khỏe mạnh', 'hạnh phúc']
          },
          {
            type: 'HEALTH_NUTRITION',
            name: 'Bữa Ăn Dinh Dưỡng Thanh Đạm & Trà Thảo Mộc',
            url: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1080&q=85',
            keywords: ['dinh dưỡng', 'ăn uống', 'sức khỏe', 'thanh đạm']
          },
          {
            type: 'HOME_WARMTH',
            name: 'Không Gian Sống Gia Đình Ấm Cúng',
            url: 'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?auto=format&fit=crop&w=1080&q=85',
            keywords: ['gia đình', 'ấm áp', 'chăm sóc', 'cta']
          }
        ]
      },
      {
        id: 'cute_baby_children',
        keywords: ['em bé', 'baby', 'trẻ em', 'trẻ con', 'cute', 'hài hước bé', 'toddler', 'học sinh'],
        mainSubject: 'Em bé đáng yêu với đôi mắt to tròn, biểu cảm ngây thơ vui nhộn',
        characterMatrix: {
          default: {
            role: 'Em bé ngây thơ, mắt long lanh',
            action: 'Tương tác hài hước, nở nụ cười rạng rỡ',
            ageGroup: 'Toddler / Child 1-5 years old'
          }
        },
        stockImages: [
          {
            type: 'HERO_SHOT',
            name: 'Em Bé Dễ Thương Đôi Mắt Long Lanh',
            url: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1080&q=85',
            keywords: ['hook', 'em bé', 'cute', 'mắt tròn']
          },
          {
            type: 'FRUIT_MARKET',
            name: 'Chợ Trái Cây Nhiệt Đới Tươi Ngon',
            url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1080&q=85',
            keywords: ['xoài', 'trái cây', 'chợ', 'ngon']
          },
          {
            type: 'BABY_LAUGH',
            name: 'Nụ Cười Trẻ Thơ Tươi Vui Rạng Rỡ',
            url: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1080&q=85',
            keywords: ['cười', 'payoff', 'vui vẻ', 'cta']
          }
        ]
      },
      {
        id: 'vietnam_travel_eco',
        keywords: ['du lịch', 'sinh thái', 'mũi né', 'phong nha', 'côn đảo', 'hạ long', 'sapa', 'thiên nhiên', 'biển', 'hang động', 'resort'],
        mainSubject: 'Cảnh quan thiên nhiên Việt Nam hùng vĩ, biển xanh ngọc bích, cồn cát vàng và núi đá kỳ vĩ',
        characterMatrix: {
          default: {
            role: 'Phượt thủ / Nhà thám hiểm dã ngoại',
            action: 'Chiêm ngưỡng cảnh quan thiên nhiên bao la',
            ageGroup: 'Young Adult 20-30 years old'
          }
        },
        stockImages: [
          {
            type: 'HERO_SHOT',
            name: 'Cồn Cát Mũi Né Hoàng Hôn Rực Rỡ',
            url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1080&q=85',
            keywords: ['mũi né', 'cát', 'hoàng hôn', 'đẹp']
          },
          {
            type: 'CAVE_RIVER',
            name: 'Hang Động Phong Nha & Dòng Sông Ngầm',
            url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1080&q=85',
            keywords: ['phong nha', 'hang động', 'sông', 'núi đá']
          },
          {
            type: 'BAY_OCEAN',
            name: 'Vịnh Biển Nước Xanh Ngọc Trong Vắt',
            url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1080&q=85',
            keywords: ['côn đảo', 'hạ long', 'biển xanh', 'đảo', 'cta']
          }
        ]
      },
      {
        id: 'tech_software_ai',
        keywords: ['ai', 'công nghệ', 'lập trình', 'code', 'robot', 'chip', 'cyberpunk', 'dữ liệu', 'hệ thống', 'phần mềm'],
        mainSubject: 'Phòng thí nghiệm công nghệ cao, mạng nơ-ron và bảng điều khiển dữ liệu hiện đại',
        characterMatrix: {
          default: {
            role: 'Kỹ sư hệ thống & Chuyên gia AI',
            action: 'Tương tác với bảng điều khiển dữ liệu thông minh',
            ageGroup: 'Adult 25-35 years old'
          }
        },
        stockImages: [
          {
            type: 'HERO_SHOT',
            name: 'Phòng Thí Nghiệm AI & Mạng Nơ-ron',
            url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1080&q=85',
            keywords: ['ai', 'công nghệ', 'mạng nơ-ron']
          },
          {
            type: 'CODE_MATRIX',
            name: 'Lập Trình Viên & Ma Trận Dữ Liệu Tự Động',
            url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1080&q=85',
            keywords: ['code', 'lập trình', 'tự động']
          },
          {
            type: 'ROBOTICS_FUTURE',
            name: 'Robot Trí Tuệ Nhân Tạo & Chip Lượng Tử',
            url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1080&q=85',
            keywords: ['robot', 'tương lai', 'đột phá', 'cta']
          }
        ]
      }
    ];
  }

  // Phân tích toàn diện chủ đề và khớp ảnh theo nguyên tắc Topic-First
  matchTopicAndSceneImage(topic = '', sceneText = '', sceneIdx = 0) {
    const fullText = `${topic} ${sceneText}`.toLowerCase();

    // 1. Tìm chuyên mục khớp nhất
    let matchedCategory = this.topicCategories.find(cat =>
      cat.keywords.some(k => fullText.includes(k))
    );

    if (!matchedCategory) {
      matchedCategory = this.topicCategories[0]; // Mặc định chuyển sang Ẩm thực / Đời sống
    }

    // 2. Tìm ảnh trong chuyên mục khớp từ khóa phân cảnh
    const stockList = matchedCategory.stockImages;
    let matchedImage = stockList.find(img =>
      img.keywords.some(k => fullText.includes(k))
    );

    if (!matchedImage) {
      matchedImage = stockList[sceneIdx % stockList.length];
    }

    // 3. Suy luận Character Profile chuẩn theo chủ đề
    let characterProfile = matchedCategory.characterMatrix.default;
    if (fullText.includes('người già') || fullText.includes('lớn tuổi') || fullText.includes('cao tuổi') || fullText.includes('ông') || fullText.includes('bà') || fullText.includes('60 tuổi')) {
      characterProfile = matchedCategory.characterMatrix.elderly || characterProfile;
    } else if (fullText.includes('bé') || fullText.includes('trẻ em') || fullText.includes('trẻ con')) {
      characterProfile = matchedCategory.characterMatrix.child || characterProfile;
    } else if (fullText.includes('đầu bếp') || fullText.includes('nấu')) {
      characterProfile = matchedCategory.characterMatrix.chef || characterProfile;
    }

    return {
      categoryId: matchedCategory.id,
      mainSubject: matchedCategory.mainSubject,
      characterProfile,
      imageUrl: matchedImage.url,
      imageName: matchedImage.name,
      imageType: matchedImage.type
    };
  }
}

module.exports = new TopicFirstImageEngine();
