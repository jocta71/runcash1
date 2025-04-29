const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
    enum: ['ACTIVE', 'INACTIVE', 'EXPIRED', 'OVERDUE', 'CANCELED', 'PENDING'],
    default: 'PENDING'
  },
  value: {
    type: Number,
    required: true
  },
  nextDueDate: {
    type: Date
  },
  billingType: {
    type: String,
    enum: ['BOLETO', 'CREDIT_CARD', 'PIX', 'UNDEFINED'],
    default: 'UNDEFINED'
  },
  description: {
    type: String
  },
  cycle: {
    type: String,
    enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY'],
    default: 'MONTHLY'
  },
  paymentLink: {
    type: String
  },
  invoiceUrl: {
    type: String
  },
  expiryDate: {
    type: Date
  },
  recentPayments: [{
    id: String,
    value: Number,
    status: String,
    billingType: String,
    paymentDate: Date,
    invoiceUrl: String,
    createdAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Método para verificar se a assinatura está ativa
subscriptionSchema.methods.isActive = function() {
  return this.status === 'ACTIVE';
};

// Método para verificar quanto tempo resta até a próxima cobrança (em dias)
subscriptionSchema.methods.daysUntilNextPayment = function() {
  if (!this.nextDueDate) return null;
  
  const today = new Date();
  const dueDate = new Date(this.nextDueDate);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription; 