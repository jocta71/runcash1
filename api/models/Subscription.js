import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  planId: {
    type: String,
    required: true,
    enum: ['basic', 'pro'],
    default: 'basic'
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'canceled', 'pending', 'expired'],
    default: 'pending'
  },
  provider: {
    type: String,
    required: true,
    default: 'hubla'
  },
  externalId: {
    type: String,
    sparse: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Índices para otimização de consultas
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ externalId: 1 }, { sparse: true });

// Método para cancelar uma assinatura
SubscriptionSchema.methods.cancel = async function(reason) {
  this.status = 'canceled';
  this.endDate = new Date();
  this.autoRenew = false;
  this.updatedAt = new Date();
  
  // Adicionar motivo do cancelamento
  this.metadata = {
    ...this.metadata,
    canceledAt: new Date(),
    cancelReason: reason || 'Não especificado'
  };
  
  return this.save();
};

export const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema); 