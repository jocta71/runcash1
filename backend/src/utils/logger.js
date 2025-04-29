/**
 * Utilitário de logging para a aplicação
 * Implementação simplificada sem dependências externas
 */
const fs = require('fs');
const path = require('path');

// Diretório para logs
const LOG_DIR = path.join(__dirname, '../../logs');

// Garante que o diretório de logs existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Mapeamento dos níveis de log para valores numéricos para comparação
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Nível de log padrão
const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Função para formatar a data atual
function formatDate(date) {
  const d = date || new Date();
  return d.toISOString();
}

// Função para formatar a mensagem de log
function formatLogMessage(level, message, data) {
  let formattedData = '';
  
  if (data) {
    try {
      formattedData = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (error) {
      formattedData = '[Erro ao serializar dados]';
    }
  }
  
  return `${formatDate()} [${level.toUpperCase()}] ${message} ${formattedData}`.trim();
}

// Função para obter o nome do arquivo de log baseado na data atual
function getLogFileName() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `webhook-${dateStr}.log`;
}

// Função para escrever no arquivo de log
function writeToLogFile(message) {
  const logFile = path.join(LOG_DIR, getLogFileName());
  
  try {
    fs.appendFileSync(logFile, message + '\n');
  } catch (error) {
    console.error(`Erro ao escrever no arquivo de log: ${error.message}`);
  }
}

// Função genérica de logging
function log(level, message, data) {
  // Verifica se o nível do log está habilitado
  if (LOG_LEVELS[level] > LOG_LEVELS[DEFAULT_LOG_LEVEL]) {
    return;
  }

  const formattedMessage = formatLogMessage(level, message, data);
  
  // Log no console
  if (level === 'error') {
    console.error(formattedMessage);
  } else if (level === 'warn') {
    console.warn(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
  
  // Escreve no arquivo de log
  writeToLogFile(formattedMessage);
}

// Exporta as funções de log para cada nível
module.exports = {
  error: (message, data) => log('error', message, data),
  warn: (message, data) => log('warn', message, data),
  info: (message, data) => log('info', message, data),
  debug: (message, data) => log('debug', message, data),
  
  // Método auxiliar para registrar erros com stack trace
  errorWithStack: (message, error) => {
    log('error', message, {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}; 