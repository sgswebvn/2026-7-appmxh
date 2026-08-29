const mongoose = require('mongoose');

const FailureMemorySchema = new mongoose.Schema({
  videoTitle: {
    type: String,
    required: true
  },
  niche: {
    type: String,
    default: 'general'
  },
  whatHappened: {
    type: String,
    required: true
  },
  expected: {
    type: String,
    required: true
  },
  actual: {
    type: String,
    required: true
  },
  probableCause: {
    type: String,
    required: true
  },
  lesson: {
    type: String,
    required: true
  },
  newRule: {
    type: String,
    required: true
  },
  ruleEnforcedInProduction: {
    type: Boolean,
    default: true
  },
  occurrenceCount: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FailureMemory', FailureMemorySchema);
