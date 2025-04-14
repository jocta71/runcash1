/**
 * Utilitário para exibição de mensagens toast
 * Funciona como fallback se react-toastify não estiver disponível
 */

// Tenta importar toast do react-toastify, se estiver disponível
let toastFunction: any;
try {
  // Importação dinâmica
  const reactToastify = require('react-toastify');
  toastFunction = reactToastify.toast;
} catch (error) {
  console.warn('react-toastify não está disponível, usando fallback interno');
  
  // Implementação de fallback
  toastFunction = {
    error: (message: string) => {
      console.error('Toast Error:', message);
      
      // Se estiver em um ambiente de browser, mostrar um alerta
      if (typeof window !== 'undefined') {
        alert(`Erro: ${message}`);
      }
    },
    success: (message: string) => {
      console.log('Toast Success:', message);
      
      // Se estiver em um ambiente de browser, mostrar um alerta
      if (typeof window !== 'undefined') {
        alert(`Sucesso: ${message}`);
      }
    },
    info: (message: string) => {
      console.info('Toast Info:', message);
      
      // Se estiver em um ambiente de browser, mostrar um alerta
      if (typeof window !== 'undefined') {
        alert(`Info: ${message}`);
      }
    },
    warning: (message: string) => {
      console.warn('Toast Warning:', message);
      
      // Se estiver em um ambiente de browser, mostrar um alerta
      if (typeof window !== 'undefined') {
        alert(`Aviso: ${message}`);
      }
    }
  };
}

// Exportar o toast (real ou fallback)
export const toast = toastFunction; 