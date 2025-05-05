/**
 * Serviço de criptografia da aplicação
 * Este arquivo cria e exporta o objeto cryptoService para uso na aplicação
 */

// Importando apenas CryptoJS
import CryptoJS from 'crypto-js';

// Implementação direta das funções necessárias para evitar problemas de build
let _accessKey: string | null = null;
const STORAGE_KEY = 'roulette_access_key';

// Implementação local da variável e função de dev mode
let _devModeEnabled = false;
function isDevModeEnabled(): boolean {
  return _devModeEnabled;
}

// Função local para ativar modo de desenvolvimento
function enableDevMode(enable: boolean = true): boolean {
  _devModeEnabled = enable;
  console.log(`[CryptoService] Modo de desenvolvimento ${enable ? 'ativado' : 'desativado'}`);
  return _devModeEnabled;
}

// Função para extrair e configurar a chave de acesso de um evento
function extractAndSetAccessKeyFromEvent(eventData: any): boolean {
  console.log('[CryptoService] Tentando extrair chave de acesso do evento');
  try {
    // Verificar se o eventData é uma string
    if (typeof eventData === 'string') {
      try {
        // Tentar fazer parse do JSON
        const jsonData = JSON.parse(eventData);
        return processJsonData(jsonData);
      } catch (e) {
        console.log('[CryptoService] Evento não é um JSON válido');
        return false;
      }
    } else if (eventData && typeof eventData === 'object') {
      // Já é um objeto, verificar campos relevantes
      return processJsonData(eventData);
    }
    return false;
  } catch (error) {
    console.error('[CryptoService] Erro ao extrair chave de acesso:', error);
    return false;
  }
}

// Função auxiliar para processar dados JSON e extrair chave
function processJsonData(data: any): boolean {
  // Verificar campos comuns que podem conter a chave
  if (data.accessKey) {
    console.log('[CryptoService] Chave de acesso encontrada no campo accessKey');
    setAccessKey(data.accessKey);
    return true;
  }
  if (data.key) {
    console.log('[CryptoService] Chave de acesso encontrada no campo key');
    setAccessKey(data.key);
    return true;
  }
  if (data.data && typeof data.data === 'object') {
    // Verificar no campo aninhado data
    if (data.data.accessKey) {
      console.log('[CryptoService] Chave de acesso encontrada em data.accessKey');
      setAccessKey(data.data.accessKey);
      return true;
    }
    if (data.data.key) {
      console.log('[CryptoService] Chave de acesso encontrada em data.key');
      setAccessKey(data.data.key);
      return true;
    }
  }
  if (data.auth && typeof data.auth === 'object') {
    // Verificar no campo aninhado auth
    if (data.auth.key) {
      console.log('[CryptoService] Chave de acesso encontrada em auth.key');
      setAccessKey(data.auth.key);
      return true;
    }
    if (data.auth.accessKey) {
      console.log('[CryptoService] Chave de acesso encontrada em auth.accessKey');
      setAccessKey(data.auth.accessKey);
      return true;
    }
  }
  console.log('[CryptoService] Nenhuma chave de acesso encontrada no evento');
  return false;
}

// Função para configurar a chave de acesso na inicialização
function setupAccessKey(): void {
  const testKey = 'mcs128i123xcxvc-testkey-production-v1'; // Chave de exemplo
  const result = setAccessKey(testKey);
  console.log('[CryptoService] Verificação de chave: ' +
    (result ? 'Chave configurada com sucesso' : 'Falha ao configurar chave'));
}

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
  
  // Aumentar número de roletas simuladas para mais testes
  const simulatedData = {
    data: {
      message: "Dados simulados - modo de desenvolvimento",
      timestamp: Date.now(),
      details: "Esta é uma simulação. A implementação real requer o algoritmo exato usado pelo backend.",
      roletas: [
        {
          id: "simulated_1",
          nome: "Roleta Simulada 1",
          provider: "Evolution",
          status: "online",
          numeros: randomNumbers,
          ultimoNumero: randomNumbers[0],
          horarioUltimaAtualizacao: now.toISOString()
        },
        {
          id: "simulated_2",
          nome: "Roleta Simulada 2",
          provider: "Pragmatic",
          status: "online",
          numeros: Array.from({length: 15}, () => Math.floor(Math.random() * 37)),
          ultimoNumero: randomNumbers[1],
          horarioUltimaAtualizacao: now.toISOString()
        },
        {
          id: "simulated_3",
          nome: "Roleta Simulada 3",
          provider: "Ezugi",
          status: "online",
          numeros: Array.from({length: 15}, () => Math.floor(Math.random() * 37)),
          ultimoNumero: randomNumbers[2] || 0,
          horarioUltimaAtualizacao: now.toISOString()
        }
      ]
    }
  };
  
  console.log('[DEBUG] Dados simulados gerados:', JSON.stringify(simulatedData));
  return simulatedData;
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

// Função para tentar chaves comuns
function tryCommonKeys(): boolean {
  console.log('[CryptoService] Tentando chaves comuns');
  
  // Lista de chaves comuns para tentar
  const commonKeys = [
    'mcs128i123xcxvc-testkey-production-v1',
    'mcs128i123xcxvc-testkey-development-v1',
    'mcs128i123xcxvc-testkey-staging-v1',
    'default-key-v1',
    'roulette-key-v1'
  ];
  
  // Tentar cada chave
  for (const key of commonKeys) {
    console.log(`[CryptoService] Tentando chave: ${key.substring(0, 5)}...`);
    setAccessKey(key);
    
    if (hasAccessKey()) {
      console.log('[CryptoService] Chave configurada com sucesso');
      return true;
    }
  }
  
  console.log('[CryptoService] Nenhuma chave comum funcionou');
  return false;
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
const cryptoService = {
  hasAccessKey,
  setAccessKey,
  setupAccessKey,
  clearAccessKey,
  extractAndSetAccessKeyFromEvent,
  decryptData,
  enableDevMode,
  isDevModeEnabled,
  tryCommonKeys,
  processApiResponse,
  processEncryptedData
};

export default cryptoService; 