const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  videoOriginalName: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  privacyStatus: {
    type: String,
    default: 'public'
  },
  targetCount: {
    type: Number,
    default: 1
  },
  channels: [
    {
      channelId: String,
      channelTitle: String,
      status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'pending'
      },
      videoId: String,
      videoUrl: String,
      title: String,
      error: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.History || mongoose.model('History', historySchema);
