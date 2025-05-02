const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Esquema para o modelo de Pagamento
 * Armazena detalhes de pagamentos de usuários no Asaas
 */
const PaymentSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  checkoutId: {
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
  netValue: {
    type: Number
  },
  status: {
    type: String,
    enum: ['PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'CANCELLED', 'REFUNDED'],
    default: 'PENDING',
    index: true
  },
  dueDate: {
    type: Date,
    index: true
  },
  confirmedDate: {
    type: Date
  },
  billingType: {
    type: String,
    enum: ['CREDIT_CARD', 'BOLETO', 'PIX'],
    default: 'CREDIT_CARD'
  },
  invoiceUrl: {
    type: String
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

// Índice composto para encontrar pagamentos pelo usuário e valor
PaymentSchema.index({ userId: 1, value: 1, createdAt: -1 });

// Garantir que o esquema seja registrado apenas uma vez
let Payment;
try {
  Payment = mongoose.model('Payment');
  console.log('[MODEL] Modelo Payment já existente obtido');
} catch (e) {
  Payment = mongoose.model('Payment', PaymentSchema);
  console.log('[MODEL] Modelo Payment registrado');
}

module.exports = Payment; 