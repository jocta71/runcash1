/**
 * Utilitário de logging para a aplicação
 */
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Garante que o diretório de logs existe
const logDir = config.logs.directory;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formatos personalizados
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    return logMessage;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Lista de transportes
const transports = [];

// Adiciona transporte para console se habilitado
if (config.logs.console.enabled) {
  transports.push(
    new winston.transports.Console({
      level: config.logs.console.level || config.logs.level,
      format: consoleFormat
    })
  );
}

// Adiciona transporte para arquivo se habilitado
if (config.logs.file.enabled) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, config.logs.file.filename),
      level: config.logs.file.level || config.logs.level,
      format: fileFormat,
      maxsize: config.logs.file.maxSize,
      maxFiles: config.logs.file.maxFiles
    })
  );
}

// Cria o logger
const logger = winston.createLogger({
  level: config.logs.level,
  defaultMeta: { 
    service: 'webhook-server',
    environment: process.env.NODE_ENV || 'development'
  },
  transports
});

// Método prático para logging de erros com stack trace
logger.errorWithStack = (message, error) => {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
};

// Log para inicialização
logger.info('Logger inicializado', { 
  level: config.logs.level,
  transports: transports.map(t => t.name)
});

module.exports = logger; 