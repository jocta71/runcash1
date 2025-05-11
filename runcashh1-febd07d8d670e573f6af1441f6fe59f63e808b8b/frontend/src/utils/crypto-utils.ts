/**
 * Utilitários para descriptografia de dados da API
 * Implementação compatível com o formato Iron usado no backend
 */

import CryptoJS from 'crypto-js';

// Interface para os dados da API
interface EncryptedResponse {
  success: boolean;
  encryptedData?: string;
  data?: any;
  limited: boolean;
  totalCount?: number;
  availableCount?: number;
  encrypted: boolean;
  format?: string;
  message?: string;
}

// Criar um polyfill para localStorage em ambiente Node.js
const createLocalStoragePolyfill = () => {
  // Armazenamento em memória para ambiente Node.js
  const storage: Record<string, string> = {};
  
  return {
    getItem: (key: string): string | null => {
      return storage[key] ?? null;
    },
    setItem: (key: string, value: string): void => {
      storage[key] = value;
    },
    removeItem: (key: string): void => {
      delete storage[key];
    },
    clear: (): void => {
      Object.keys(storage).forEach(key => delete storage[key]);
    }
  };
};

// Detectar ambiente e usar o localStorage apropriado
const getLocalStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  } else {
    // Estamos em um ambiente Node.js ou sem window
    return createLocalStoragePolyfill();
  }
};

// Usar o mesmo objeto de armazenamento em toda a aplicação
const safeLocalStorage = getLocalStorage();

// Valores de chaves para teste
const COMMON_ACCESS_KEYS = [
  'runcash2023',
  'runcash_test',
  'runcash_prod',
  'runcashdev',
  'runcashapi'
];

// Estado de desenvolvimento
let _isDevMode = false;

/**
 * Verificar se o modo de desenvolvimento está ativado
 */
export function isDevModeEnabled(): boolean {
  return _isDevMode || safeLocalStorage.getItem('crypto_dev_mode') === 'true';
}

/**
 * Ativa o modo de desenvolvimento
 */
export function enableDevMode(enabled = true): void {
  _isDevMode = enabled;
  console.log(`[CryptoUtils] ${enabled ? 'Ativando' : 'Desativando'} modo de desenvolvimento`);
  safeLocalStorage.setItem('crypto_dev_mode', enabled ? 'true' : 'false');
}

/**
 * Verifica se há uma chave de API no URL e a configura
 */
export function setupAccessKey(): void {
  try {
    // Verificar se estamos em um ambiente de navegador
    if (typeof window === 'undefined') {
      console.log('[CryptoUtils] Não estamos em um navegador, ignorando setupAccessKey');
      return;
    }

    const url = new URL(window.location.href);
    const accessKey = url.searchParams.get('key');
    
    if (accessKey) {
      console.log('[CryptoUtils] Chave de acesso encontrada na URL');
      // Importar o módulo crypto-service dinamicamente para evitar dependência circular
      import('./crypto-service').then(({ cryptoService }) => {
        cryptoService.setAccessKey(accessKey);
        
        // Remover o parâmetro da URL para segurança
        url.searchParams.delete('key');
        window.history.replaceState({}, document.title, url.toString());
      }).catch(error => {
        console.error('[CryptoUtils] Erro ao importar cryptoService:', error);
      });
    }
  } catch (e) {
    console.error('[CryptoUtils] Erro ao processar parâmetros de URL:', e);
  }
}

/**
 * Tenta extrair e configurar a chave de acesso a partir de um evento SSE
 */
export function extractAndSetAccessKeyFromEvent(eventData: any): Promise<boolean> {
  try {
    if (!eventData) return Promise.resolve(false);
    
    // Se eventData for uma string, tenta parsear como JSON
    let dataObj = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
    
    // Procurar por keys comuns que podem conter a chave de acesso
    const possibleFields = ['key', 'accessKey', 'token', 'apiKey', 'authKey'];
    
    for (const field of possibleFields) {
      if (dataObj[field]) {
        console.log(`[CryptoUtils] Encontrada possível chave de acesso no campo: ${field}`);
        
        // Importar o módulo crypto-service dinamicamente
        return import('./crypto-service').then(({ cryptoService }) => {
          return cryptoService.setAccessKey(dataObj[field]);
        }).catch(error => {
          console.error('[CryptoUtils] Erro ao importar cryptoService:', error);
          return false;
        });
      }
    }
    
    return Promise.resolve(false);
  } catch (e) {
    console.error('[CryptoUtils] Erro ao extrair chave de acesso do evento:', e);
    return Promise.resolve(false);
  }
}

/**
 * Tenta usar chaves comuns para decriptografia 
 */
export function tryCommonKeys(): Promise<boolean> {
  console.log('[CryptoUtils] Tentando chaves comuns');
  
  // Importar o módulo crypto-service dinamicamente
  return import('./crypto-service').then(({ cryptoService }) => {
    for (const key of COMMON_ACCESS_KEYS) {
      const result = cryptoService.setAccessKey(key);
      if (result) {
        console.log('[CryptoUtils] Chave comum configurada com sucesso');
        return true;
      }
    }
    
    console.log('[CryptoUtils] Nenhuma chave comum funcionou');
    return false;
  }).catch(error => {
    console.error('[CryptoUtils] Erro ao importar cryptoService:', error);
    return false;
  });
} 