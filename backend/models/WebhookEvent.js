const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Esquema para o modelo de Evento de Webhook
 * Armazena todos os eventos de webhook recebidos para garantir idempotência
 */
const WebhookEventSchema = new Schema({
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
    index: true
  },
  // Payload completo do evento
  payload: {
    type: Schema.Types.Mixed
  },
  // Status do processamento
  status: {
    type: String,
    enum: ['PROCESSED', 'FAILED', 'IGNORED'],
    default: 'PROCESSED',
    index: true
  },
  // Mensagem de erro (se houver)
  processingError: {
    type: String
  },
  // Data de criação
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Índice composto para consultas eficientes
WebhookEventSchema.index({ event: 1, createdAt: -1 });

// Garantir que o esquema seja registrado apenas uma vez
let WebhookEvent;
try {
  WebhookEvent = mongoose.model('WebhookEvent');
  console.log('[MODEL] Modelo WebhookEvent já existente obtido');
} catch (e) {
  WebhookEvent = mongoose.model('WebhookEvent', WebhookEventSchema);
  console.log('[MODEL] Modelo WebhookEvent registrado');
}

module.exports = WebhookEvent; 