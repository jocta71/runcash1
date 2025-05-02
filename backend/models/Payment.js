const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  asaasPaymentId: {
    type: String,
    required: true,
    unique: true
  },
  asaasCustomerId: {
    type: String,
    required: true
  },
  subscriptionId: {
    type: String,
    default: null
  },
  value: {
    type: Number,
    required: true
  },
  netValue: {
    type: Number,
    default: null
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['CONFIRMED', 'RECEIVED', 'PENDING', 'OVERDUE', 'REFUNDED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS'],
    default: 'PENDING'
  },
  billingType: {
    type: String,
    enum: ['BOLETO', 'CREDIT_CARD', 'PIX', 'UNDEFINED'],
    default: 'UNDEFINED'
  },
  description: {
    type: String
  },
  invoiceUrl: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para otimizar consultas
paymentSchema.index({ userId: 1 });
paymentSchema.index({ asaasPaymentId: 1 }, { unique: true });
paymentSchema.index({ asaasCustomerId: 1 });
paymentSchema.index({ subscriptionId: 1 });
paymentSchema.index({ paymentDate: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = { Payment }; 