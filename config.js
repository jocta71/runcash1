require('dotenv').config();

// Configurações gerais da aplicação
module.exports = {
  // Configurações do servidor
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*']
  },
  
  // Configurações do banco de dados
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/app',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    // Nomes das coleções
    collections: {
      users: 'usuarios',
      accounts: 'contas',
      transactions: 'transacoes',
      categories: 'categorias',
      budgets: 'orcamentos',
      auditLogs: 'auditoria'
    }
  },
  
  // Configurações de autenticação
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'sua-chave-secreta-padrao-apenas-para-dev',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    saltRounds: 10,
    // Tempo de expiração dos tokens de recuperação de senha
    resetPasswordExpire: 3600 * 1000, // 1 hora em milissegundos
    // Segredo para criptografia de dados sensíveis
    encryptionKey: process.env.ENCRYPTION_KEY || 'chave_de_criptografia_para_desenvolvimento'
  },
  
  // Configurações de logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    auditCollection: 'audit_logs'
  },
  
  // Limites e configurações de paginação
  limits: {
    defaultPageSize: 20,
    maxPageSize: 100,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100 // limite por IP
    }
  },

  // Configurações de upload de arquivos
  upload: {
    maxSize: process.env.UPLOAD_MAX_SIZE || 5 * 1024 * 1024, // 5MB
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES 
      ? process.env.UPLOAD_ALLOWED_TYPES.split(',') 
      : ['image/jpeg', 'image/png', 'application/pdf']
  },
  
  // Configurações de e-mail
  email: {
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    smtp: {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    },
    // Templates de email
    templates: {
      welcome: {
        subject: 'Bem-vindo ao RunCash - Confirme seu email',
        text: 'Bem-vindo ao RunCash! Por favor, confirme seu email clicando no link: {{verificationLink}}'
      },
      resetPassword: {
        subject: 'RunCash - Recuperação de senha',
        text: 'Você solicitou a recuperação de senha. Por favor, clique no link: {{resetLink}}'
      },
      accountUpdate: {
        subject: 'RunCash - Atualização da conta',
        text: 'Suas informações de conta foram atualizadas com sucesso.'
      }
    }
  },
  
  // Endpoints externos
  externalApis: {
    paymentGateway: process.env.PAYMENT_API_URL,
    googleMaps: process.env.GOOGLE_MAPS_API_KEY
  },

  // Configurações de segurança
  security: {
    // Exigir senha forte
    requireStrongPassword: true,
    // Padrão regex para senha forte
    strongPasswordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    // Limite de tentativas de login
    loginRateLimit: {
      max: 5,
      windowMs: 15 * 60 * 1000 // 15 minutos
    },
    // Política de CORS
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  },

  // Configurações de integração com serviços externos
  externalServices: {
    // Configurações de webhooks para integrações
    webhooks: {
      // Webhook para notificações de pagamento
      pagamento: {
        url: process.env.WEBHOOK_PAGAMENTO_URL,
        secret: process.env.WEBHOOK_PAGAMENTO_SECRET
      }
    },
    // APIs de terceiros
    apis: {
      // Serviço de cotação de moedas
      cotacoes: {
        url: process.env.API_COTACOES_URL || 'https://api.exchangerate-api.com/v4/latest/BRL',
        key: process.env.API_COTACOES_KEY
      }
    }
  },
  
  // Limites e configurações de upload de arquivos
  uploads: {
    storageType: process.env.STORAGE_TYPE || 'local', // 'local', 's3', etc.
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  }
}; 