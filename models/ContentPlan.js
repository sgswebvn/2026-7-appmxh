const mongoose = require('mongoose');

const contentPlanSchema = new mongoose.Schema({
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
  dayOfWeek: {
    type: String,
    enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
    required: true
  },
  timeSlot: {
    type: String,
    required: true // Ví dụ: "09:00", "15:00", "20:00"
  },
  topicTheme: {
    type: String,
    required: true // Ví dụ: "AI News", "AI Tools", "AI Tips"
  },
  targetPlatforms: {
    type: [String],
    default: ['YOUTUBE', 'FACEBOOK', 'TIKTOK']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.ContentPlan || mongoose.model('ContentPlan', contentPlanSchema);
