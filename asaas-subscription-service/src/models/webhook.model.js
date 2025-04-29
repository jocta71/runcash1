const mongoose = require('mongoose');

/**
 * Modelo para armazenar o histórico de webhooks recebidos
 * Útil para auditoria e reprocessamento se necessário
 */
const webhookSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true
  },
  payload: {
    type: Object,
    required: true
  },
  processed: {
    type: Boolean,
    default: false
  },
  processingErrors: [{
    message: String,
    stack: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  asaasId: {
    type: String, // ID da cobrança/assinatura/cliente na Asaas
  },
  customerId: {
    type: String, // ID do cliente na Asaas
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  subscriptionId: {
    type: String, // ID da assinatura na Asaas
  },
  actionTaken: {
    type: String,
    enum: ['NONE', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_CANCELED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'CUSTOMER_UPDATED'],
    default: 'NONE'
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

const Webhook = mongoose.model('Webhook', webhookSchema);

module.exports = Webhook; 