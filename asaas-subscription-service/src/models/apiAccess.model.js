const mongoose = require('mongoose');

/**
 * Modelo para controlar o acesso à API principal (roulettes)
 * Este é o modelo chave para controlar quais usuários podem acessar recursos da API
 */
const apiAccessSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  externalId: {
    type: String, // ID do usuário no sistema principal
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  asaasSubscriptionId: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: false
  },
  plan: {
    type: String,
    enum: ['FREE', 'BASIC', 'PREMIUM', 'PRO'],
    default: 'FREE'
  },
  accessToken: {
    type: String
  },
  tokenExpiresAt: {
    type: Date
  },
  endpoints: [{
    path: {
      type: String,
      required: true
    },
    methods: {
      type: [String],
      default: ['GET']
    },
    isAllowed: {
      type: Boolean,
      default: true
    }
  }],
  requestCount: {
    type: Number,
    default: 0
  },
  dailyLimit: {
    type: Number,
    default: 1000 // Limite de requisições diárias
  },
  lastRequest: {
    type: Date
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  customPermissions: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Método para verificar se o acesso está ativo
apiAccessSchema.methods.hasActiveAccess = function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  
  // Se há uma data de expiração e ela já passou
  if (this.endDate && now > this.endDate) return false;
  
  return true;
};

// Método para verificar se o usuário tem acesso a uma rota específica
apiAccessSchema.methods.canAccessEndpoint = function(path, method = 'GET') {
  if (!this.hasActiveAccess()) return false;
  
  // Verificar endpoints específicos configurados
  const endpoint = this.endpoints.find(e => 
    path.startsWith(e.path) || e.path === '*'
  );
  
  if (endpoint) {
    return endpoint.isAllowed && 
      (endpoint.methods.includes(method) || 
       endpoint.methods.includes('*'));
  }
  
  // Se não encontrou endpoint específico, verifica se o plano dá acesso
  if (this.plan === 'FREE') {
    // Plano gratuito não tem acesso à API de roletas
    return !path.includes('/api/roulettes');
  }
  
  // Outros planos têm acesso
  return true;
};

// Método para incrementar o contador de requisições
apiAccessSchema.methods.incrementRequestCount = async function() {
  this.requestCount += 1;
  this.lastRequest = new Date();
  await this.save();
  return this.requestCount;
};

const ApiAccess = mongoose.model('ApiAccess', apiAccessSchema);

module.exports = ApiAccess; 