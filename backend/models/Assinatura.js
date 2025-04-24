const mongoose = require('mongoose');

const AssinaturaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'O ID do usuário é obrigatório']
  },
  plano: {
    type: String,
    enum: ['mensal', 'trimestral', 'anual'],
    required: [true, 'Tipo de plano é obrigatório']
  },
  status: {
    type: String,
    enum: ['ativa', 'cancelada', 'pendente', 'expirada'],
    default: 'pendente'
  },
  dataInicio: {
    type: Date,
    default: Date.now
  },
  validade: {
    type: Date,
    required: [true, 'Data de validade da assinatura é obrigatória']
  },
  valorPago: {
    type: Number,
    required: [true, 'O valor pago é obrigatório']
  },
  metodoPagamento: {
    type: String,
    enum: ['cartao', 'pix', 'boleto'],
    required: [true, 'O método de pagamento é obrigatório']
  },
  renovacaoAutomatica: {
    type: Boolean,
    default: true
  },
  ultimaAtualizacao: {
    type: Date,
    default: Date.now
  },
  historicoPagamentos: [
    {
      data: {
        type: Date,
        default: Date.now
      },
      valor: {
        type: Number,
        required: true
      },
      status: {
        type: String,
        enum: ['aprovado', 'recusado', 'pendente', 'estornado'],
        required: true
      },
      transacaoId: {
        type: String
      }
    }
  ]
}, {
  timestamps: true
});

// Método para verificar se a assinatura está ativa
AssinaturaSchema.methods.estaAtiva = function() {
  return this.status === 'ativa' && this.validade > new Date();
};

// Método para calcular dias restantes da assinatura
AssinaturaSchema.methods.diasRestantes = function() {
  const hoje = new Date();
  const diferenca = this.validade - hoje;
  return Math.ceil(diferenca / (1000 * 60 * 60 * 24));
};

module.exports = mongoose.model('Assinatura', AssinaturaSchema); 