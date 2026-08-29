const mongoose = require('mongoose');

const channelGroupSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    default: 'Chung' // Ví dụ: Hài Hước, Tin Tức & Thời Sự, Công Nghệ & AI, Review Phim, Ẩm Thực, MMO
  },
  color: {
    type: String,
    default: '#38bdf8' // Màu nhận diện badge
  },
  description: {
    type: String,
    default: ''
  },
  channelIds: [{
    type: String // Danh sách channelId / pageId thuộc nhóm này
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.ChannelGroup || mongoose.model('ChannelGroup', channelGroupSchema);
