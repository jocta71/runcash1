/**
 * Configurações da aplicação
 * Valores podem ser substituídos por variáveis de ambiente
 */

const path = require('path');

module.exports = {
  // Configurações do servidor
  server: {
    port: process.env.PORT || 3030,
    host: process.env.HOST || '0.0.0.0',
    // Número máximo de eventos a serem armazenados na memória
    maxStoredEvents: 100,
    // Tempo de expiração dos eventos em milissegundos (padrão: 7 dias)
    eventExpiryTime: 7 * 24 * 60 * 60 * 1000,
    // Intervalo em ms para limpeza de eventos antigos (padrão: 1 hora)
    cleanupInterval: 60 * 60 * 1000
  },
  
  // Configurações do ambiente
  env: process.env.NODE_ENV || 'development',
  
  // Configurações de segurança para o webhook
  webhook: {
    asaas: {
      // Token para validação do webhook
      token: process.env.ASAAS_WEBHOOK_TOKEN || 'seu-token-seguro',
      // Limites de tamanho para os payloads do webhook
      maxPayloadSize: process.env.ASAAS_WEBHOOK_MAX_SIZE || '1mb',
      // IPs permitidos (deixe vazio para permitir todos)
      allowedIps: process.env.ASAAS_WEBHOOK_ALLOWED_IPS 
        ? process.env.ASAAS_WEBHOOK_ALLOWED_IPS.split(',') 
        : [],
    }
  },
  
  // API do Asaas
  asaas: {
    apiKey: process.env.ASAAS_API_KEY || 'sua-api-key',
    baseUrl: process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3',
    timeout: process.env.ASAAS_API_TIMEOUT || 10000, // em milissegundos
  },
  
  // Configurações de CORS
  cors: {
    // Origens permitidas (domínios)
    origins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',') 
      : ['http://localhost:3000'],
    // Métodos HTTP permitidos
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // Cabeçalhos permitidos
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  
  // Configurações de logging
  logging: {
    // Nível de log (error, warn, info, debug)
    level: process.env.LOG_LEVEL || 'info',
    // Se deve armazenar logs em arquivo
    storeToFile: process.env.LOG_TO_FILE === 'true' || false,
    // Diretório para armazenar os logs (se storeToFile for true)
    directory: process.env.LOG_DIRECTORY || './logs',
  },
  
  // Configurações de armazenamento
  storage: {
    // Número máximo de eventos a serem mantidos em memória
    maxEvents: process.env.MAX_EVENTS || 100,
  },

  // Configurações para o servidor de webhook
  server: {
    port: process.env.WEBHOOK_PORT || 3030,
    host: process.env.WEBHOOK_HOST || 'localhost',
    basePath: '/api'
  },

  // Configurações do webhook Asaas
  asaas: {
    // Token usado para validar webhooks vindos do Asaas
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || 'seu-token-secreto',
    
    // IPs autorizados do Asaas (consulte documentação atual para lista atualizada)
    authorizedIps: [
      '191.235.90.238',
      '191.235.81.59',
      '191.235.87.143',
      '191.235.93.128',
      '191.235.94.244',
      '127.0.0.1',  // Para testes locais
      '::1'         // Para testes locais (IPv6)
    ]
  },

  // Limites de armazenamento em memória
  storage: {
    maxWebhookEvents: 100,       // Máximo de eventos armazenados
    webhookEventExpiry: 86400000, // 24 horas em milissegundos
    cleanupInterval: 3600000      // Intervalo de limpeza em milissegundos (1 hora)
  },

  // Limites para o body-parser
  bodyParser: {
    limit: '1mb',  // Tamanho máximo do payload
    extended: true
  },

  // Configurações de logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',  // error, warn, info, debug
    consoleEnabled: true,
    fileEnabled: true,
    directory: path.join(__dirname, '../logs')
  },

  // Configurações de segurança
  security: {
    enableIpValidation: process.env.VALIDATE_ASAAS_IPS !== 'false',
    enableTokenValidation: process.env.VALIDATE_ASAAS_TOKEN !== 'false',
    // Para configurações CORS
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'asaas-access-token', 'Authorization']
    },
    // Token de autenticação para webhooks do Asaas
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || 'seu-token-aqui',
    
    // Endereços IP permitidos - se vazio, aceita qualquer IP
    // Formato: ['123.123.123.123', '234.234.234.234']
    allowedIPs: (process.env.ALLOWED_IPS || '').split(',').filter(ip => ip.trim().length > 0),
    
    // Se deve verificar o token de autenticação
    validateToken: process.env.VALIDATE_TOKEN !== 'false',
    
    // Se deve verificar o IP de origem
    validateIP: process.env.VALIDATE_IP === 'true'
  },

  // Configurações da Asaas
  asaas: {
    // URL base da API Asaas
    apiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3',
    
    // Chave de API para comunicação com a Asaas
    apiKey: process.env.ASAAS_API_KEY,
    
    // Se deve usar o ambiente sandbox
    sandbox: process.env.ASAAS_SANDBOX === 'true',
    
    // Status de assinatura válidos para considerar um usuário como ativo
    validSubscriptionStatuses: ['ACTIVE'],
    
    // Status de pagamento válidos para considerar um pagamento como confirmado
    validPaymentStatuses: ['CONFIRMED', 'RECEIVED']
  },

  // Configurações de logging
  logs: {
    // Nível de log global (error, warn, info, debug)
    level: process.env.LOG_LEVEL || 'info',
    
    // Diretório para armazenar logs
    directory: process.env.LOG_DIR || './logs',
    
    // Configurações para logging no console
    console: {
      enabled: process.env.CONSOLE_LOGGING !== 'false',
      level: process.env.CONSOLE_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
      colorize: true
    },
    
    // Configurações para logging em arquivo
    file: {
      enabled: process.env.FILE_LOGGING === 'true',
      level: process.env.FILE_LOG_LEVEL || process.env.LOG_LEVEL || 'info',
      filename: process.env.LOG_FILENAME || 'webhook-server.log',
      maxSize: parseInt(process.env.LOG_MAX_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5')
    }
  },

  // Configurações de rotas
  routes: {
    // Rota principal para receber webhooks da Asaas
    webhook: '/api/asaas-webhook',
    
    // Prefixo para rotas de debug
    debug: '/debug',
    
    // Rota para health check
    health: '/health'
  }
}; 