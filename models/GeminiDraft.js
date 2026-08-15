const mongoose = require('mongoose');

const geminiDraftSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  topic: {
    type: String,
    required: true
  },
  targetAudience: {
    type: String,
    default: 'Khán giả đại chúng'
  },
  generatedTitles: [
    {
      title: String,
      hookType: String,
      clickScore: Number
    }
  ],
  generatedDescription: {
    type: String,
    default: ''
  },
  generatedTags: [String],
  channelVariants: [
    {
      channelId: String,
      channelTitle: String,
      customTitle: String,
      customDescription: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.GeminiDraft || mongoose.model('GeminiDraft', geminiDraftSchema);
