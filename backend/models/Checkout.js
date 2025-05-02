const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Esquema para o modelo de Checkout
 * Armazena detalhes de processos de checkout do Asaas
 */
const CheckoutSchema = new Schema({
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
    index: true
  },
  subscriptionId: {
    type: String,
    index: true
  },
  value: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED'],
    default: 'PENDING',
    index: true
  },
  billingType: {
    type: String,
    enum: ['CREDIT_CARD', 'BOLETO', 'PIX'],
    default: 'CREDIT_CARD'
  },
  paidAt: {
    type: Date
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

// Índice composto para encontrar checkouts pelo usuário e valor
CheckoutSchema.index({ userId: 1, value: 1, createdAt: -1 });

// Garantir que o esquema seja registrado apenas uma vez
let Checkout;
try {
  Checkout = mongoose.model('Checkout');
  console.log('[MODEL] Modelo Checkout já existente obtido');
} catch (e) {
  Checkout = mongoose.model('Checkout', CheckoutSchema);
  console.log('[MODEL] Modelo Checkout registrado');
}

module.exports = Checkout; 