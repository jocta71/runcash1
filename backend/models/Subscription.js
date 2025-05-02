const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Esquema para o modelo de Assinatura
 * Armazena detalhes de assinaturas de usuários no Asaas
 */
const SubscriptionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  asaasId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  planType: {
    type: String,
    enum: ['FREE', 'BASIC', 'PREMIUM', 'PRO'],
    default: 'FREE'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'OVERDUE', 'CANCELED', 'PENDING'],
    default: 'PENDING',
    index: true
  },
  value: {
    type: Number,
    default: 0
  },
  nextDueDate: {
    type: Date,
    index: true
  },
  cycle: {
    type: String,
    enum: ['MONTHLY', 'WEEKLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL'],
    default: 'MONTHLY'
  },
  billingType: {
    type: String,
    enum: ['CREDIT_CARD', 'BOLETO', 'PIX'],
    default: 'CREDIT_CARD'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Schema.Types.Mixed
  }
});

// Garantir que o esquema seja registrado apenas uma vez
let Subscription;
try {
  Subscription = mongoose.model('Subscription');
  console.log('[MODEL] Modelo Subscription já existente obtido');
} catch (e) {
  Subscription = mongoose.model('Subscription', SubscriptionSchema);
  console.log('[MODEL] Modelo Subscription registrado');
}

module.exports = Subscription; 