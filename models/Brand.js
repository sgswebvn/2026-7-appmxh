const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
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
  description: {
    type: String,
    default: ''
  },
  targetAudience: {
    type: String,
    default: 'Khán giả đại chúng'
  },
  toneOfVoice: {
    type: String,
    default: 'Hấp dẫn, kích thích tò mò'
  },
  primaryColor: {
    type: String,
    default: '#e11d48'
  },
  socialChannels: [
    {
      platform: {
        type: String,
        enum: ['YOUTUBE', 'FACEBOOK', 'TIKTOK'],
        default: 'YOUTUBE'
      },
      channelId: String,
      channelTitle: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

brandSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);
