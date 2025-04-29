const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  asaasCustomerId: {
    type: String,
    required: true
  },
  asaasSubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'overdue', 'canceled'],
    default: 'inactive'
  },
  plan: {
    type: String,
    required: true,
    enum: ['basic', 'premium', 'pro']
  },
  value: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['CREDIT_CARD', 'BOLETO', 'PIX'],
    default: 'CREDIT_CARD'
  },
  nextDueDate: {
    type: Date
  },
  lastPaymentDate: {
    type: Date
  },
  billingCycle: {
    type: String,
    enum: ['MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY'],
    default: 'MONTHLY'
  },
  description: {
    type: String
  },
  expirationDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índice composto para consultas rápidas
SubscriptionSchema.index({ userId: 1, status: 1 });

// Método estático para verificar se um usuário tem assinatura ativa
SubscriptionSchema.statics.hasActiveSubscription = async function(userId) {
  const activeSubscription = await this.findOne({
    userId,
    status: 'active'
  });
  
  return !!activeSubscription;
};

// Método estático para obter a assinatura ativa de um usuário
SubscriptionSchema.statics.getActiveSubscription = async function(userId) {
  return await this.findOne({
    userId,
    status: 'active'
  });
};

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

module.exports = Subscription; 