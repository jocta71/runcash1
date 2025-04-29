const mongoose = require('mongoose');

/**
 * Modelo para armazenar eventos de webhook recebidos
 */
const webhookEventSchema = new mongoose.Schema({
  // ID único do evento
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Tipo do evento (PAYMENT_CONFIRMED, SUBSCRIPTION_CREATED, etc)
  eventType: {
    type: String,
    required: true,
    index: true
  },
  
  // Carga completa do evento recebido
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Status do processamento do evento
  status: {
    type: String,
    enum: ['received', 'processed', 'error'],
    default: 'received',
    index: true
  },
  
  // Data e hora em que o evento foi recebido
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Data e hora em que o evento foi processado
  processedAt: {
    type: Date
  },
  
  // Mensagem de erro (se houver)
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Índices compostos para consultas comuns
webhookEventSchema.index({ eventType: 1, status: 1 });
webhookEventSchema.index({ receivedAt: -1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema); 