import { getLogger, loggerConfig, LogLevel } from './logger';

// Logger para inicialização
const initLogger = getLogger('Init');

/**
 * Inicializa o sistema de log com base no ambiente
 */
export function initializeLogging(): void {
  const isDevelopment = import.meta.env.MODE !== 'production';
  const logParam = new URLSearchParams(window.location.search).get('log');
  
  // Configurar nível de log global
  if (isDevelopment) {
    initLogger.info('Inicializando logger em modo de desenvolvimento');
    
    if (logParam === 'verbose') {
      loggerConfig.level = LogLevel.VERBOSE;
      initLogger.info('Nível de log definido como VERBOSE');
    } else if (logParam === 'debug') {
      loggerConfig.level = LogLevel.DEBUG;
      initLogger.info('Nível de log definido como DEBUG');
    } else if (logParam === 'info') {
      loggerConfig.level = LogLevel.INFO;
      initLogger.info('Nível de log definido como INFO');
    } else if (logParam === 'warn') {
      loggerConfig.level = LogLevel.WARN;
      initLogger.info('Nível de log definido como WARN');
    } else if (logParam === 'error') {
      loggerConfig.level = LogLevel.ERROR;
      initLogger.info('Nível de log definido como ERROR');
    } else if (logParam === 'none') {
      loggerConfig.enabled = false;
      initLogger.info('Logging desativado');
    } else {
      // Padrão para desenvolvimento é DEBUG
      loggerConfig.level = LogLevel.DEBUG;
    }
  } else {
    // Em produção, usar nível INFO por padrão
    loggerConfig.level = LogLevel.INFO;
    
    // Apenas permitir níveis mais restritivos em produção
    if (logParam === 'warn') {
      loggerConfig.level = LogLevel.WARN;
    } else if (logParam === 'error') {
      loggerConfig.level = LogLevel.ERROR;
    } else if (logParam === 'none') {
      loggerConfig.enabled = false;
    }
  }
  
  // Gerenciar categorias específicas
  configureCategories();
  
  initLogger.info(`Sistema de log inicializado (nível: ${LogLevel[loggerConfig.level]})`);
}

/**
 * Configura quais categorias devem ser logadas
 */
function configureCategories(): void {
  // Parâmetro para ativar categorias específicas
  const categoriesParam = new URLSearchParams(window.location.search).get('logcat');
  
  if (categoriesParam) {
    // Desativar todas as categorias por padrão se especificado explicitamente
    const categories = ['Socket', 'Repository', 'API', 'Component', 'Strategy', 'Main'];
    categories.forEach(category => loggerConfig.disableCategory(category));
    
    // Ativar apenas as categorias especificadas
    categoriesParam.split(',').forEach(category => {
      loggerConfig.enableCategory(category);
      initLogger.info(`Categoria ${category} ativada para logging`);
    });
  } else if (import.meta.env.MODE === 'production') {
    // Em produção, desativar logs de categorias específicas para reduzir ruído
    loggerConfig.disableCategory('Socket');
    loggerConfig.disableCategory('Repository');
  }
}

// Exportar uma função para alterar o nível de log em tempo de execução
export function setLogLevel(level: LogLevel): void {
  loggerConfig.level = level;
  initLogger.info(`Nível de log alterado para: ${LogLevel[level]}`);
}

// Exportar uma função para ativar/desativar uma categoria
export function toggleLogCategory(category: string, enabled: boolean): void {
  if (enabled) {
    loggerConfig.enableCategory(category);
    initLogger.info(`Categoria ${category} ativada para logging`);
  } else {
    loggerConfig.disableCategory(category);
    initLogger.info(`Categoria ${category} desativada para logging`);
  }
} 