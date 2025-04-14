import mongoose from 'mongoose';

const WebhookLogSchema = new mongoose.Schema({
  event_type: {
    type: String,
    required: true,
    index: true
  },
  headers: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  body: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  processed: {
    type: Boolean,
    default: false
  },
  processing_result: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  error: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Índices para facilitar consultas
WebhookLogSchema.index({ timestamp: -1 });
WebhookLogSchema.index({ event_type: 1, timestamp: -1 });

export const WebhookLog = mongoose.models.WebhookLog || mongoose.model('WebhookLog', WebhookLogSchema); 