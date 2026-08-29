const mongoose = require('mongoose');

const contentProjectSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  brandId: {
    type: String,
    default: '',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    default: ''
  },
  contentType: {
    type: String,
    enum: ['SHORT', 'LONG_FORM', 'REEL', 'STORY'],
    default: 'SHORT'
  },
  status: {
    type: String,
    enum: ['IDEA', 'SCRIPT_GENERATED', 'MEDIA_READY', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
    default: 'IDEA'
  },
  scriptData: {
    hook: String,
    bodySections: [
      {
        time: String,
        heading: String,
        content: String
      }
    ],
    callToAction: String
  },
  seoMetadata: {
    viralTitles: Array,
    description: String,
    tags: Array,
    hashtags: Array
  },
  mediaFiles: [
    {
      fileType: {
        type: String,
        enum: ['VIDEO', 'AUDIO_TTS', 'IMAGE', 'SUBTITLE', 'THUMBNAIL'],
        default: 'VIDEO'
      },
      filePath: String,
      fileName: String,
      fileSize: Number
    }
  ],
  scheduledAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

contentProjectSchema.index({ userId: 1, brandId: 1, status: 1 });

module.exports = mongoose.models.ContentProject || mongoose.model('ContentProject', contentProjectSchema);
