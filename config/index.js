require('dotenv').config();

const config = {
  // Configurações gerais da aplicação
  app: {
    name: process.env.APP_NAME || 'RunCashh',
    url: process.env.APP_URL || 'http://localhost:3000',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    secret: process.env.APP_SECRET || 'sua_chave_secreta_para_cookies',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  },
  
  // Configurações de autenticação
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'sua_chave_secreta_jwt',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    passwordResetTime: 3600000, // 1 hora em milissegundos
    emailVerificationTime: 86400000, // 24 horas em milissegundos
  },
  
  // Configurações do banco de dados
  db: {
    uri: process.env.MONGODB_URI,
    options: {
      useUnifiedTopology: true,
    },
    collections: {
      users: 'users',
      files: 'files',
      transactions: 'transactions',
      notifications: 'notifications',
      audit: 'audit_logs',
    },
  },
  
  // Configurações de armazenamento de arquivos
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local', // 'local' ou 'gcs'
    
    // Configurações para armazenamento local
    local: {
      uploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
      maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB em bytes
    },
    
    // Configurações para Google Cloud Storage
    gcs: {
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILENAME,
      bucketName: process.env.GCS_BUCKET_NAME,
      maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB em bytes
    },
    
    // Configuração geral de arquivos
    allowedFileTypes: {
      image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
      compressed: ['.zip', '.rar', '.7z'],
    },
  },
  
  // Configurações de email
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    from: process.env.EMAIL_FROM || 'suporte@seuapp.com',
    templates: {
      welcome: 'welcome',
      resetPassword: 'resetPassword',
      verifyEmail: 'verifyEmail',
      notification: 'notification',
    },
  },
  
  // Limite de solicitações para evitar ataques de força bruta
  rateLimits: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // número máximo de tentativas
    },
    register: {
      windowMs: 60 * 60 * 1000, // 1 hora
      max: 3, // número máximo de registros
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // número máximo de requisições por IP
    },
  },
  
  // Logs e monitoramento
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
};

module.exports = config; 