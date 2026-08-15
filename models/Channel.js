const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  customUrl: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  subscriberCount: {
    type: Number,
    default: 0
  },
  videoCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  email: {
    type: String,
    default: ''
  },
  tokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
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

channelSchema.index({ userId: 1, channelId: 1 }, { unique: true });

module.exports = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
