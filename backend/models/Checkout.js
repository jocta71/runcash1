const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const checkoutSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  checkoutId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  paymentId: {
    type: String,
    sparse: true,
    index: true
  },
  subscriptionId: {
    type: String,
    sparse: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  paidAt: {
    type: Date,
    sparse: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'CANCELED', 'EXPIRED'],
    default: 'PENDING',
    index: true
  },
  billingType: {
    type: String,
    enum: ['CREDIT_CARD', 'BOLETO', 'PIX'],
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  }
});

// Índice composto para encontrar checkouts pelo usuário e valor
checkoutSchema.index({ userId: 1, value: 1, createdAt: -1 });

const Checkout = mongoose.model('Checkout', checkoutSchema);

module.exports = Checkout; 