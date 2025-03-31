const mongoose = require('mongoose');

const RouletteStrategySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roletaId: {
    type: String,
    required: true
  },
  roletaNome: {
    type: String,
    required: true
  },
  strategyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Strategy',
    required: true
  },
  active: {
    type: Boolean,
    default: true
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

// Índice composto para garantir que um usuário tenha apenas uma estratégia ativa por roleta
RouletteStrategySchema.index({ userId: 1, roletaId: 1 }, { unique: true });

// Atualiza o updatedAt antes de salvar
RouletteStrategySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('RouletteStrategy', RouletteStrategySchema); 