const mongoose = require('mongoose');

const abTestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  brandId: {
    type: String,
    default: ''
  },
  testName: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    default: ''
  },
  variants: [
    {
      variantId: { type: String, required: true }, // 'A', 'B', 'C'
      title: { type: String, required: true },
      hookText: { type: String, default: '' },
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 }, // % Click-Through Rate
      retentionRate: { type: Number, default: 0 }, // % Giữ chân người xem
      status: { type: String, enum: ['TESTING', 'WINNER', 'STOPPED'], default: 'TESTING' }
    }
  ],
  winnerVariantId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['RUNNING', 'COMPLETED', 'ARCHIVED'],
    default: 'RUNNING'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AbTest', abTestSchema);
