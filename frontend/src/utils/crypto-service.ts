/**
 * Serviço de criptografia da aplicação
 * Este arquivo cria e exporta o objeto cryptoService para uso na aplicação
 */

// Importando CryptoJS e funções de crypto-utils que não conflitam
import CryptoJS from 'crypto-js';
import { 
  extractAndSetAccessKeyFromEvent, 
  enableDevMode, 
  isDevModeEnabled, 
  setupAccessKey, 
  tryCommonKeys
} from './crypto-utils';

// Implementação direta das funções necessárias para evitar problemas de build
let _accessKey: string | null = null;
const STORAGE_KEY = 'roulette_access_key';

// Variável para localStorage seguro
const safeLocalStorage = (() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  } else {
    // Polyfill para Node.js ou SSR
    const storage: Record<string, string> = {};
    return {
      getItem: (key: string): string | null => storage[key] ?? null,
      setItem: (key: string, value: string): void => { storage[key] = value; },
      removeItem: (key: string): void => { delete storage[key]; },
      clear: (): void => { Object.keys(storage).forEach(key => delete storage[key]); }
    };
  }
})();

// Tentar carregar a chave do armazenamento
try {
  const storedKey = safeLocalStorage.getItem(STORAGE_KEY);
  if (storedKey) {
    _accessKey = storedKey;
  }
} catch (e) {
  console.error('[CryptoService] Erro ao carregar chave inicial');
}

// Funções do serviço
function hasAccessKey(): boolean {
  return !!_accessKey;
}

function setAccessKey(key: string): boolean {
  _accessKey = key;
  try {
    safeLocalStorage.setItem(STORAGE_KEY, key);
  } catch (e) {
    console.error('[CryptoService] Erro ao salvar chave:', e);
  }
  return hasAccessKey();
}

function clearAccessKey(): void {
  _accessKey = null;
  safeLocalStorage.removeItem(STORAGE_KEY);
}

function addAccessKeyToHeaders(headers: HeadersInit = {}): HeadersInit {
  if (_accessKey) {
    return {
      ...headers,
      'Authorization': `Bearer ${_accessKey}`
    };
  }
  return headers;
}

// Função para gerar dados simulados
function getSimulatedData(): any {
  const now = new Date();
  const randomNumbers = Array.from({length: 15}, () => Math.floor(Math.random() * 37));
  
  return {
    data: {
      message: "Dados simulados - modo de desenvolvimento",
      timestamp: Date.now(),
      details: "Esta é uma simulação. A implementação real requer o algoritmo exato usado pelo backend.",
      roletas: [
        {
          id: "simulated_1",
          nome: "Roleta Simulada 1",
          provider: "Simulação",
          status: "online",
          numeros: randomNumbers,
          ultimoNumero: randomNumbers[0],
          horarioUltimaAtualizacao: now.toISOString()
        },
        {
          id: "simulated_2",
          nome: "Roleta Simulada 2",
          provider: "Simulação",
          status: "online",
          numeros: Array.from({length: 15}, () => Math.floor(Math.random() * 37)),
          ultimoNumero: randomNumbers[1],
          horarioUltimaAtualizacao: now.toISOString()
        }
      ]
    }
  };
}

// Função para descriptografar dados no formato Iron
async function decryptData(ironEncrypted: string): Promise<any> {
  if (!_accessKey) {
    throw new Error('Chave de acesso não disponível');
  }
  
  // Verificar se o modo de desenvolvimento está ativado
  if (isDevModeEnabled()) {
    console.log('[CryptoService] Modo de desenvolvimento ativado, usando dados simulados');
    return getSimulatedData();
  }
  
  try {
    console.log('[CryptoService] Tentando descriptografar dados');
    
    // Verificar formato
    if (!ironEncrypted || typeof ironEncrypted !== 'string') {
      throw new Error('Formato de dados inválido');
    }
    
    // Processar diferentes formatos
    let targetData = ironEncrypted;
    
    // Se não começar com Fe26.2, verificar se é um JSON
    if (!targetData.startsWith('Fe26.2')) {
      try {
        if (targetData.includes('"encryptedData"') || targetData.includes('"encrypted"')) {
          const jsonData = JSON.parse(targetData);
          if (jsonData.encryptedData) {
            targetData = jsonData.encryptedData;
          }
        }
      } catch (error) {
        console.log('[CryptoService] Não é um JSON válido');
      }
    }
    
    // Extrair partes da string Iron
    const parts = targetData.split('*');
    console.log('[CryptoService] Formato Iron partes:', parts.length);
    
    // Tentar processar formato de 3 partes
    if (parts.length === 3) {
      console.log('[CryptoService] Processando formato de 3 partes');
      
      // Derivar chave e IV
      const key = CryptoJS.PBKDF2(_accessKey, 'runcash-salt', {
        keySize: 256 / 32,
        iterations: 1000
      });
      
      const ivValue = CryptoJS.enc.Utf8.parse(_accessKey.substring(0, 16));
      
      // Decodificar e descriptografar
      const encryptedBytes = CryptoJS.enc.Base64.parse(parts[2]);
      const decryptedData = CryptoJS.AES.decrypt(
        encryptedBytes.toString(CryptoJS.enc.Base64),
        key,
        {
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
          iv: ivValue
        }
      );
      
      // Converter resultado
      const decryptedString = decryptedData.toString(CryptoJS.enc.Utf8);
      
      // Tentar parsear como JSON
      try {
        if (decryptedString.startsWith('{') || decryptedString.startsWith('[')) {
          return JSON.parse(decryptedString);
        } else {
          return { data: decryptedString };
        }
      } catch (e) {
        return { data: decryptedString };
      }
    }
    
    // Se não for formato de 3 partes, precisamos de pelo menos 4 partes
    if (parts.length < 4) {
      throw new Error('Formato Iron inválido: número insuficiente de partes');
    }
    
    // Processo para formato de 4+ partes
    const encryptedBase64 = parts[3];
    const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedBase64);
    const key = CryptoJS.PBKDF2(_accessKey, 'runcash-salt', {
      keySize: 256 / 32,
      iterations: 1000
    });
    const ivValue = CryptoJS.enc.Utf8.parse(_accessKey.substring(0, 16));
    
    // Descriptografar
    const decryptedData = CryptoJS.AES.decrypt(
      encryptedBytes.toString(CryptoJS.enc.Base64),
      key,
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: ivValue
      }
    );
    
    // Processar resultado
    const decryptedString = decryptedData.toString(CryptoJS.enc.Utf8);
    
    // Tentar parsear como JSON
    if (decryptedString.startsWith('{') || decryptedString.startsWith('[')) {
      return JSON.parse(decryptedString);
    } else {
      return { data: decryptedString };
    }
  } catch (error) {
    console.error('[CryptoService] Erro ao descriptografar:', error);
    
    // Usar simulação se modo de desenvolvimento estiver ativado
    if (isDevModeEnabled()) {
      return getSimulatedData();
    }
    
    throw error;
  }
}

// Processar resposta da API
async function processApiResponse(response: any): Promise<any> {
  if (!response.encrypted || !response.encryptedData) {
    return response.data || [];
  }
  
  try {
    const decryptedData = await decryptData(response.encryptedData);
    return decryptedData.data || decryptedData;
  } catch (error) {
    throw new Error('Falha ao descriptografar dados da API');
  }
}

// Processar dados criptografados
async function processEncryptedData(encryptedData: any): Promise<any> {
  if (!hasAccessKey()) {
    throw new Error('Chave de acesso não disponível');
  }
  
  try {
    if (!encryptedData || !encryptedData.encryptedData) {
      if (encryptedData && encryptedData.data) {
        return encryptedData.data;
      }
      throw new Error('Formato de dados inválido');
    }
    
    const decryptedData = await decryptData(encryptedData.encryptedData);
    return decryptedData.data || decryptedData;
  } catch (error) {
    throw new Error('Falha ao processar dados criptografados');
  }
}

// Objeto de serviço de criptografia
export const cryptoService = {
  hasAccessKey,
  setAccessKey,
  clearAccessKey,
  addAccessKeyToHeaders,
  decryptData,
  processApiResponse,
  processEncryptedData
}; 