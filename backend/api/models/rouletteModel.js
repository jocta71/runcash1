const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RouletteSchema = new Schema({
  name: {
    type: String,
    required: [true, 'O nome da roleta é obrigatório'],
    trim: true,
    maxlength: [100, 'O nome não pode ter mais de 100 caracteres']
  },
  description: {
    type: String,
    required: [true, 'A descrição é obrigatória'],
    trim: true,
    maxlength: [500, 'A descrição não pode ter mais de 500 caracteres']
  },
  type: {
    type: String,
    required: [true, 'O tipo da roleta é obrigatório'],
    enum: {
      values: ['classic', 'crash', 'mines', 'slots', 'double', 'jackpot'],
      message: 'O tipo {VALUE} não é um tipo válido de roleta'
    }
  },
  accessLevel: {
    type: String,
    required: [true, 'O nível de acesso é obrigatório'],
    enum: {
      values: ['demo', 'basic', 'premium', 'vip'],
      message: 'O nível de acesso {VALUE} não é válido'
    },
    default: 'basic'
  },
  active: {
    type: Boolean,
    default: true
  },
  winRate: {
    type: Number,
    required: [true, 'A taxa de vitória é obrigatória'],
    min: [0, 'A taxa de vitória não pode ser menor que 0'],
    max: [100, 'A taxa de vitória não pode ser maior que 100']
  },
  betLimits: {
    min: {
      type: Number,
      required: [true, 'O limite mínimo de aposta é obrigatório'],
      min: [0, 'O limite mínimo não pode ser negativo']
    },
    max: {
      type: Number,
      required: [true, 'O limite máximo de aposta é obrigatório'],
      min: [0, 'O limite máximo não pode ser negativo']
    }
  },
  segments: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    color: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      default: 1,
      min: [0.1, 'O peso não pode ser menor que 0.1']
    }
  }],
  category: {
    type: String,
    required: [true, 'A categoria é obrigatória'],
    enum: {
      values: ['popular', 'novidades', 'clássico', 'exclusivo', 'promocional'],
      message: '{VALUE} não é uma categoria válida'
    }
  },
  thumbnailUrl: {
    type: String,
    required: [true, 'A URL da miniatura é obrigatória']
  },
  tags: [String],
  rules: {
    type: String,
    required: [true, 'As regras são obrigatórias'],
    maxlength: [2000, 'As regras não podem ter mais de 2000 caracteres']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  // Configurações que apenas administradores podem ver
  secretSettings: {
    houseEdge: {
      type: Number,
      default: 5, // Porcentagem 
      min: [0, 'A margem da casa não pode ser negativa'],
      max: [20, 'A margem da casa não pode ser maior que 20%']
    },
    algorithmType: {
      type: String,
      enum: ['random', 'fixed', 'progressive'],
      default: 'random'
    },
    payoutModifier: {
      type: Number,
      default: 1.0
    }
  },
  adminNotes: {
    type: String,
    maxlength: [1000, 'As notas de administrador não podem ter mais de 1000 caracteres']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para melhorar a performance de consultas
RouletteSchema.index({ name: 1 });
RouletteSchema.index({ type: 1 });
RouletteSchema.index({ category: 1 });
RouletteSchema.index({ accessLevel: 1 });
RouletteSchema.index({ active: 1 });

// Método para verificar se um usuário pode acessar esta roleta
RouletteSchema.methods.isAccessibleBy = function(userSubscriptionPlan) {
  if (!userSubscriptionPlan) return this.accessLevel === 'demo';
  
  switch (userSubscriptionPlan) {
    case 'basic':
      return ['demo', 'basic'].includes(this.accessLevel);
    case 'premium':
      return ['demo', 'basic', 'premium'].includes(this.accessLevel);
    case 'vip':
      return true; // Acesso a todas as roletas
    default:
      return this.accessLevel === 'demo';
  }
};

// Virtual para o número de segmentos
RouletteSchema.virtual('segmentCount').get(function() {
  return this.segments ? this.segments.length : 0;
});

// Middleware para garantir que betLimits.max seja maior que betLimits.min
RouletteSchema.pre('save', function(next) {
  if (this.betLimits.max <= this.betLimits.min) {
    const error = new Error('O limite máximo de aposta deve ser maior que o limite mínimo');
    return next(error);
  }
  next();
});

// Middleware para atualizar o campo lastUpdated quando o documento for alterado
RouletteSchema.pre('findOneAndUpdate', function(next) {
  this.set({ lastUpdated: Date.now() });
  next();
});

module.exports = mongoose.model('Roulette', RouletteSchema); 