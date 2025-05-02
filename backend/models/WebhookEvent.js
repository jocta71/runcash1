const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const webhookEventSchema = new Schema({
  // ID único do evento (calculado com base nos dados do evento)
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Tipo de evento (ex: PAYMENT_CREATED, CHECKOUT_PAID)
  event: {
    type: String,
    required: true,
    index: true
  },
  // ID da origem (pode ser paymentId, checkoutId, subscriptionId)
  sourceId: {
    type: String,
    required: true,
    index: true
  },
  // Payload completo do evento
  payload: {
    type: Object,
    required: true
  },
  // Status do processamento
  status: {
    type: String,
    enum: ['PROCESSED', 'FAILED', 'IGNORED'],
    default: 'PROCESSED',
    index: true
  },
  // Mensagem de erro (se houver)
  errorMessage: {
    type: String
  },
  // Data de criação
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Índice composto para consultas de eventos por tipo e ID de origem
webhookEventSchema.index({ event: 1, sourceId: 1, createdAt: -1 });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

module.exports = WebhookEvent; 