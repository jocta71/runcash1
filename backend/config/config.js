/**
 * Arquivo de configuração centralizado
 * Contém todas as configurações básicas da aplicação
 */

module.exports = {
  // Configurações gerais da aplicação
  app: {
    name: 'RunCash',
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
  },
  
  // Configurações de banco de dados
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/runcash',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    }
  },
  
  // Configurações de JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'seu_segredo_super_secreto',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // Configurações de planos de assinatura
  subscription: {
    plans: {
      FREE: {
        name: 'Gratuito',
        limit: 30
      },
      BASIC: {
        name: 'Básico',
        limit: 100
      },
      PRO: {
        name: 'Profissional',
        limit: 200
      },
      PREMIUM: {
        name: 'Premium',
        limit: 500
      }
    }
  },
  
  // Configurações de cache
  cache: {
    ttl: 60 * 5 // 5 minutos em segundos
  }
}; 