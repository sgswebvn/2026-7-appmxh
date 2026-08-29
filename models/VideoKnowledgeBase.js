const mongoose = require('mongoose');

const VideoKnowledgeBaseSchema = new mongoose.Schema({
  niche: {
    type: String,
    required: true,
    index: true,
    default: 'general' // travel_eco, tech_ai, finance_money, storytelling_history, entertainment
  },
  topic: {
    type: String,
    required: true
  },
  format: {
    type: String,
    default: 'SHORTS_VERTICAL'
  },
  hookPattern: {
    patternType: String,
    description: String,
    curiosityGapScore: Number, // 1-10
    exampleHypothesis: String
  },
  titlePattern: {
    formula: String,
    clickTriggers: [String]
  },
  scriptStructure: {
    timeline: {
      hook0to3s: String,
      promise3to10s: String,
      setup10to30s: String,
      valueDiscovery30sPlus: String,
      endingPayoffLoop: String
    },
    pacingWordsPerMinute: Number,
    sentenceLengthAvg: Number,
    openLoopsCount: Number
  },
  visualPattern: {
    avgShotDurationSec: Number,
    transitionStyle: String,
    textOverlayStyle: String,
    brollType: String,
    colorComposition: String
  },
  audioPattern: {
    voicePacing: String,
    sfxFrequency: String,
    bgmEnergy: String
  },
  retentionHypothesis: {
    hookRetentionRisk: String,
    peakRetentionTriggers: [String],
    dropoffRisks: [String]
  },
  transferablePatterns: [String],
  patternsToAvoid: [String],
  performanceTier: {
    type: String,
    enum: ['TOP_PERFORMER', 'AVERAGE', 'POOR'],
    default: 'TOP_PERFORMER'
  },
  correlationStats: {
    topPerformerFrequencyPct: Number,
    poorPerformerFrequencyPct: Number,
    sampleSize: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('VideoKnowledgeBase', VideoKnowledgeBaseSchema);
