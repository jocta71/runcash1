const mongoose = require('mongoose');

const StrategySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome da estratégia é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  conditions: {
    type: Array,
    required: [true, 'Pelo menos uma condição é obrigatória'],
    validate: {
      validator: function(conditions) {
        console.log(`[Strategy Schema] Validando condições: ${conditions?.length} condições`);
        return conditions && conditions.length > 0;
      },
      message: 'Adicione pelo menos uma condição à sua estratégia'
    }
  },
  roletaId: {
    type: String,
    required: false,
    trim: true
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

// Atualiza o updatedAt antes de salvar
StrategySchema.pre('save', function(next) {
  console.log(`[Strategy Schema] Pre-save hook: ${this.name}`);
  this.updatedAt = Date.now();
  next();
});

// Adicionar um log após o salvamento
StrategySchema.post('save', function(doc) {
  console.log(`[Strategy Schema] Estratégia salva com sucesso: ${doc._id}`);
});

module.exports = mongoose.models.Strategy || mongoose.model('Strategy', StrategySchema); 