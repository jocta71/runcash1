const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: String,
    enum: ['free', 'basic', 'pro', 'premium'],
    default: 'free',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'pending', 'expired'],
    default: 'active',
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  endDate: {
    type: Date
  },
  paymentProvider: {
    type: String,
    enum: ['ASAAS', 'manual', 'free'],
    default: 'free'
  },
  paymentId: {
    type: String
  },
  externalId: {
    type: String
  },
  nextBillingDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastVerified: {
    type: Date,
    default: Date.now
  }
});

// Adicionar índice para facilitar consultas
SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ planId: 1 });

// Middleware pre-save para atualizar campo updatedAt
SubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para verificar se a assinatura está ativa
SubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && 
    (!this.endDate || new Date(this.endDate) > new Date());
};

// Método para checar acesso a recurso específico
SubscriptionSchema.methods.hasAccess = function(featureId) {
  const featureAccess = {
    'free': [
      'view_basic_stats', 
      'view_limited_roulettes'
    ],
    'basic': [
      'view_basic_stats', 
      'view_standard_roulettes', 
      'view_roulette_cards',
      'view_roulette_sidepanel',
      'email_support'
    ],
    'pro': [
      'view_advanced_stats', 
      'view_unlimited_roulettes', 
      'view_roulette_cards',
      'view_roulette_sidepanel',
      'priority_support', 
      'custom_alerts'
    ],
    'premium': [
      'view_advanced_stats', 
      'view_unlimited_roulettes', 
      'view_historical_data', 
      'api_access', 
      'ai_predictions',
      'view_roulette_cards',
      'view_roulette_sidepanel',
      'priority_support', 
      'custom_alerts', 
      'personalized_consulting'
    ]
  };
  
  return this.isActive() && featureAccess[this.planId] && 
    featureAccess[this.planId].includes(featureId);
};

module.exports = mongoose.model('Subscription', SubscriptionSchema); 