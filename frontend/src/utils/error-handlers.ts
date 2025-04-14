/**
 * Utilitários para lidar com erros comuns no frontend
 */

const loggedErrors = new Set<string>();

/**
 * Inicializa manipuladores globais de erro
 */
export function setupGlobalErrorHandlers() {
  // Tratamento global de erros de Promise não tratados
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || 'Erro desconhecido';
    const errorStack = event.reason?.stack || '';
    
    // Evitar logar o mesmo erro repetidamente
    const errorKey = `${errorMessage}:${errorStack.substring(0, 100)}`;
    if (loggedErrors.has(errorKey)) {
      // Evitar spam no console
      event.preventDefault();
      return;
    }
    
    // Registrar este erro para evitar spam
    loggedErrors.add(errorKey);
    
    // Limitar o tamanho do conjunto para evitar vazamento de memória
    if (loggedErrors.size > 100) {
      const iterator = loggedErrors.values();
      loggedErrors.delete(iterator.next().value);
    }
    
    console.error('Erro assíncrono não tratado:', errorMessage);
    
    // Lidar com erro específico de canal de mensagem
    if (errorMessage.includes('message channel closed before a response was received')) {
      console.warn('Detectado erro de canal de mensagem fechado - este é um problema conhecido');
      
      // Suprimir o erro no console (opcional, pode ajudar a reduzir o ruído)
      event.preventDefault();
    }
  });
  
  // Tratamento global de erros não capturados
  window.addEventListener('error', (event) => {
    // Evitar logar erros de recursos (como imagens que não carregaram)
    if (event.target && (event.target as HTMLElement).tagName) {
      return;
    }
    
    console.error('Erro global não tratado:', event.error || event.message);
  });
}

/**
 * Identifica e trata erros comuns relacionados ao Socket.IO
 * @param error O erro a ser tratado
 * @returns true se o erro foi tratado, false caso contrário
 */
export function handleSocketErrors(error: any): boolean {
  const errorMessage = error?.message || String(error);
  
  // Erro de canal de mensagem fechado
  if (errorMessage.includes('message channel closed before a response was received')) {
    console.warn('Erro de canal de mensagem fechado detectado - este é um erro comum de sockets');
    // Este erro geralmente ocorre quando o socket é fechado antes de uma resposta ser recebida
    // Não é crítico e pode ser ignorado na maioria dos casos
    return true;
  }
  
  // Erro de conexão do socket
  if (errorMessage.includes('socket.io') || errorMessage.includes('websocket')) {
    console.warn('Erro de socket detectado:', errorMessage);
    return true;
  }
  
  return false;
}

/**
 * Envolver chamadas de API para tratar erros comuns
 * @param apiCall Função que faz a chamada à API
 * @returns Resultado da chamada à API
 */
export async function withErrorHandling<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (handleSocketErrors(error)) {
      console.warn('Erro de socket tratado em withErrorHandling');
    } else {
      console.error('Erro não tratado em chamada de API:', error);
    }
    throw error;
  }
} 