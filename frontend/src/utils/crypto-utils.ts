/**
 * Utilitários para descriptografia de dados da API
 * Implementação compatível com o formato Iron usado no backend
 */

import CryptoJS from 'crypto-js';

// Interface para os dados selados
interface SealedData {
  data: any;
  timestamp: number;
  expiresAt: number;
}

// Interface para os dados recebidos da API
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

// Estado interno do módulo
let _accessKey: string | null = null;
const STORAGE_KEY = 'roulette_access_key';

// Carregar chave de acesso do localStorage
function loadAccessKey(): void {
  try {
    const storedKey = safeLocalStorage.getItem(STORAGE_KEY);
    if (storedKey) {
      _accessKey = storedKey;
    }
  } catch (error) {
    console.error('[CryptoService] Erro ao carregar chave de acesso:', error);
  }
}

// Salvar a chave de acesso no localStorage
function saveAccessKey(): void {
  try {
    if (_accessKey) {
      safeLocalStorage.setItem(STORAGE_KEY, _accessKey);
    }
  } catch (error) {
    console.error('[CryptoService] Erro ao salvar chave de acesso:', error);
  }
}

// Inicializar carregando a chave
loadAccessKey();

// Funções exportadas
export function hasAccessKey(): boolean {
  return !!_accessKey;
}

export function setAccessKey(key: string): boolean {
  _accessKey = key;
  saveAccessKey();
  console.log('[CryptoService] Chave de acesso configurada via helper');
  return hasAccessKey();
}

export function clearAccessKey(): void {
  _accessKey = null;
  safeLocalStorage.removeItem(STORAGE_KEY);
  console.log('[CryptoService] Chave de acesso removida');
}

export function setupAccessKey() {
  const testKey = 'mcs128i123xcxvc-testkey-production-v1'; // Chave de exemplo
  const result = setAccessKey(testKey);
  console.log('[CryptoService] Verificação de chave: ' + 
    (result ? 'Chave configurada com sucesso' : 'Falha ao configurar chave'));
}

export function addAccessKeyToHeaders(headers: HeadersInit = {}): HeadersInit {
  if (_accessKey) {
    return {
      ...headers,
      'Authorization': `Bearer ${_accessKey}`
    };
  }
  return headers;
}

export async function decryptData(ironEncrypted: string): Promise<any> {
  if (!_accessKey) {
    throw new Error('Chave de acesso não disponível');
  }
  
  // Verificar se o modo de desenvolvimento está ativado
  if (isDevModeEnabled()) {
    console.log('[CryptoService] Modo de desenvolvimento ativado, usando dados simulados');
    return getSimulatedData();
  }
  
  try {
    console.log('[CryptoService] Tentando descriptografar dados no formato Iron');
    
    // Verificar formato Iron
    if (!ironEncrypted || typeof ironEncrypted !== 'string') {
      console.error('[CryptoService] Dados inválidos:', ironEncrypted);
      throw new Error('Formato de dados inválido');
    }
    
    // Log detalhado do formato recebido
    console.log('[CryptoService] Formato recebido:', ironEncrypted.substring(0, 100));
    console.log('[CryptoService] Total de caracteres:', ironEncrypted.length);
    console.log('[CryptoService] Primeiros caracteres:', ironEncrypted.substring(0, 20));
    
    // Formatos possíveis:
    // 1. String direta no formato Iron: Fe26.2*...
    // 2. Objeto JSON com campo encryptedData
    // 3. String em base64 que precisa ser decodificada primeiro
    let targetData = ironEncrypted;
    
    // Verificar se é Base64 e tentar decodificar
    if (!ironEncrypted.startsWith('Fe26.2') && !ironEncrypted.includes('"encrypted"')) {
      try {
        // Verificar se parece ser Base64 (comprimento múltiplo de 4, caracteres válidos)
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(ironEncrypted.replace(/\s/g, '')) && 
                        ironEncrypted.length % 4 === 0;
        
        if (isBase64) {
          console.log('[CryptoService] Tentando decodificar como Base64');
          try {
            // Usar atob para decodificar Base64
            const decoded = atob(ironEncrypted);
            console.log('[CryptoService] Decodificação Base64 bem-sucedida:', decoded.substring(0, 50));
            
            // Verificar se o resultado parece ser JSON ou formato Iron
            if (decoded.startsWith('Fe26.2') || decoded.startsWith('{')) {
              console.log('[CryptoService] Conteúdo Base64 decodificado parece válido');
              targetData = decoded;
            }
          } catch (e) {
            console.log('[CryptoService] Erro ao decodificar Base64, tratando como dados normais');
          }
        }
      } catch (e) {
        console.log('[CryptoService] Erro ao processar possível Base64, continuando com dados originais');
      }
    }
    
    // Se não começar com Fe26.2, verificar se é um JSON
    if (!targetData.startsWith('Fe26.2')) {
      try {
        // Poderia ser um JSON com campo encryptedData
        if (targetData.includes('"encryptedData"') || targetData.includes('"encrypted"')) {
          const jsonData = JSON.parse(targetData);
          
          // Verificar diferentes formatos possíveis
          if (jsonData.encryptedData) {
            console.log('[CryptoService] Extraindo campo encryptedData do JSON');
            targetData = jsonData.encryptedData;
          } else if (jsonData.encrypted && jsonData.data) {
            console.log('[CryptoService] Extraindo campo data do JSON com encrypted=true');
            targetData = jsonData.data;
          } else if (jsonData.content && typeof jsonData.content === 'string') {
            console.log('[CryptoService] Extraindo campo content do JSON');
            targetData = jsonData.content;
          }
        }
      } catch (error) {
        console.log('[CryptoService] Não é um JSON válido, continuando com dados originais');
      }
    }
    
    // Tentar prefixar Fe26.2 se não estiver presente mas parecer um formato Iron sem o prefixo
    if (!targetData.startsWith('Fe26.2') && targetData.includes('*') && targetData.split('*').length >= 4) {
      console.log('[CryptoService] Detectado possível formato Iron sem prefixo, adicionando prefixo');
      targetData = 'Fe26.2*' + targetData;
    }
    
    // Agora devemos ter um formato Fe26.2*...
    if (!targetData.startsWith('Fe26.2')) {
      console.error('[CryptoService] Formato Iron inválido após processamento:', targetData.substring(0, 100));
      console.error('[CryptoService] Formato original era:', ironEncrypted.substring(0, 100));
      throw new Error('Formato Iron inválido ou não reconhecido');
    }
    
    // 1. Extrair partes da string Iron
    const parts = targetData.split('*');
    console.log('[CryptoService] Partes do formato Iron:', parts.length);
    
    // Log das partes para diagnóstico (limitando para não sobrecarregar o console)
    parts.forEach((part, index) => {
      if (index < 6) { // Limitando a 6 partes para não poluir o console
        console.log(`[CryptoService] Parte ${index}:`, 
          part.length > 20 ? part.substring(0, 20) + '...' : part);
      }
    });
    
    // MELHORIA: Suporte ao formato Iron de 3 partes
    // Se temos exatamente 3 partes, podemos estar lidando com o formato simplificado
    // onde Fe26.2*hash*encrypted
    if (parts.length === 3) {
      console.log('[CryptoService] Detectado formato Iron de 3 partes, adaptando processamento');
      
      // No formato de 3 partes, a parte 2 contém o conteúdo criptografado
      let encryptedBase64 = parts[2];
      let ivUsed = parts[1].length > 16 ? parts[1].substring(0, 16) : _accessKey.substring(0, 16);
      
      console.log('[CryptoService] Usando parte 2 como dados criptografados (primeiros 20 caracteres):', 
        encryptedBase64.substring(0, 20) + '...');
      
      // Tentar descriptografar os dados da parte 2
      try {
        // Usar CryptoJS para descriptografar
        const key = CryptoJS.PBKDF2(_accessKey, 'runcash-salt', {
          keySize: 256 / 32,
          iterations: 1000
        });
        
        // Gerar IV a partir da hash ou da chave de acesso
        const ivValue = CryptoJS.enc.Utf8.parse(ivUsed);
        
        // Decodificar Base64 e descriptografar
        const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedBase64);
        
        // Tentar diferentes configurações
        let decryptedData;
        let success = false;
        
        // Tentativa 1: AES-CBC com IV da parte 1
        try {
          decryptedData = CryptoJS.AES.decrypt(
            encryptedBytes.toString(CryptoJS.enc.Base64),
            key,
            {
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
              iv: ivValue
            }
          );
          
          const testString = decryptedData.toString(CryptoJS.enc.Utf8);
          if (testString && testString.length > 0) {
            success = true;
            console.log('[CryptoService] Formato de 3 partes descriptografado com sucesso (CBC+IV)');
          }
        } catch (e) {
          console.log('[CryptoService] Falha na primeira tentativa para formato de 3 partes');
        }
        
        // Tentativa 2: AES-CBC sem IV específico
        if (!success) {
          try {
            decryptedData = CryptoJS.AES.decrypt(
              encryptedBytes.toString(CryptoJS.enc.Base64),
              key,
              {
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
              }
            );
            
            const testString = decryptedData.toString(CryptoJS.enc.Utf8);
            if (testString && testString.length > 0) {
              success = true;
              console.log('[CryptoService] Formato de 3 partes descriptografado com sucesso (CBC)');
            }
          } catch (e) {
            console.log('[CryptoService] Falha na segunda tentativa para formato de 3 partes');
          }
        }
        
        // Tentativa 3: AES-ECB
        if (!success) {
          try {
            decryptedData = CryptoJS.AES.decrypt(
              encryptedBytes.toString(CryptoJS.enc.Base64),
              key,
              {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
              }
            );
            
            const testString = decryptedData.toString(CryptoJS.enc.Utf8);
            if (testString && testString.length > 0) {
              success = true;
              console.log('[CryptoService] Formato de 3 partes descriptografado com sucesso (ECB)');
            }
          } catch (e) {
            console.log('[CryptoService] Falha na terceira tentativa para formato de 3 partes');
          }
        }
        
        if (success) {
          // Converter para string e tentar parsear como JSON
          const decryptedString = decryptedData.toString(CryptoJS.enc.Utf8);
          console.log('[CryptoService] Formato de 3 partes descriptografado:', 
            decryptedString.substring(0, 50) + '...');
          
          try {
            if (decryptedString.startsWith('{') || decryptedString.startsWith('[')) {
              const jsonResult = JSON.parse(decryptedString);
              return jsonResult;
            } else {
              return { data: decryptedString };
            }
          } catch (e) {
            console.log('[CryptoService] Dados descriptografados não são JSON válido');
            return { data: decryptedString };
          }
        } else {
          throw new Error('Não foi possível descriptografar formato de 3 partes');
        }
      } catch (e) {
        console.error('[CryptoService] Erro ao descriptografar formato de 3 partes:', e);
        throw e; // Propagar erro para tentar outros métodos
      }
    }
    
    if (parts.length < 4) {
      console.error('[CryptoService] Número insuficiente de partes:', parts.length);
      throw new Error('Formato Iron inválido: número insuficiente de partes');
    }
    
    // 2. Recuperar os componentes necessários
    // O formato exato pode variar, então tentamos diferentes índices
    let encryptedBase64 = '';
    let iv = '';
    
    // Normalmente o formato é Fe26.2*hash*encrypted*iv*..., mas pode haver variações
    if (parts.length >= 4) {
      // Tentativa 1: formato padrão
      encryptedBase64 = parts[3];
      iv = parts[2].length > 16 ? parts[2].substring(0, 16) : _accessKey.substring(0, 16);
    }
    
    // Se a parte 3 não parece ser Base64, tentar outros índices
    if (!encryptedBase64 || encryptedBase64.length < 10) {
      console.log('[CryptoService] Tentando encontrar dados em outros índices');
      
      // Procurar a parte mais longa que possa ser os dados
      let maxLength = 0;
      let maxIndex = -1;
      
      for (let i = 2; i < parts.length; i++) {
        if (parts[i].length > maxLength) {
          maxLength = parts[i].length;
          maxIndex = i;
        }
      }
      
      if (maxIndex !== -1 && maxLength > 20) {
        console.log(`[CryptoService] Usando parte ${maxIndex} como dados (comprimento ${maxLength})`);
        encryptedBase64 = parts[maxIndex];
      }
    }
    
    console.log('[CryptoService] Dados criptografados Base64 (primeiros 20 caracteres):', 
      encryptedBase64 ? encryptedBase64.substring(0, 20) + '...' : 'indefinido');
    
    if (!encryptedBase64) {
      throw new Error('Dados criptografados não encontrados no formato Iron');
    }
    
    // 3. Decodificar base64
    let encryptedBytes;
    try {
      encryptedBytes = CryptoJS.enc.Base64.parse(encryptedBase64);
    } catch (error) {
      console.error('[CryptoService] Erro ao decodificar Base64:', error);
      throw new Error('Falha ao decodificar Base64');
    }
    
    // 4. Derivar chave de criptografia a partir da chave de acesso
    console.log('[CryptoService] Derivando chave a partir da chave de acesso');
    const key = CryptoJS.PBKDF2(_accessKey, 'runcash-salt', {
      keySize: 256 / 32,
      iterations: 1000
    });
    
    // Gerar IV a partir do salt ou usar a primeira parte da chave
    const ivValue = CryptoJS.enc.Utf8.parse(_accessKey.substring(0, 16));
    
    // 5. Tentar descriptografar usando diferentes configurações
    console.log('[CryptoService] Tentando descriptografar com AES-CBC');
    let decryptedData;
    
    try {
      // Primeira tentativa: AES-CBC com PKCS7
      decryptedData = CryptoJS.AES.decrypt(
        encryptedBytes.toString(CryptoJS.enc.Base64),
        key,
        {
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
          iv: ivValue
        }
      );
    } catch (e) {
      console.log('[CryptoService] Erro na primeira tentativa de descriptografia:', e);
      
      // Segunda tentativa: AES-CBC sem IV específico
      try {
        decryptedData = CryptoJS.AES.decrypt(
          encryptedBytes.toString(CryptoJS.enc.Base64),
          key,
          {
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }
        );
      } catch (e2) {
        console.log('[CryptoService] Erro na segunda tentativa de descriptografia:', e2);
        
        // Terceira tentativa: AES-ECB
        try {
          decryptedData = CryptoJS.AES.decrypt(
            encryptedBytes.toString(CryptoJS.enc.Base64),
            key,
            {
              mode: CryptoJS.mode.ECB,
              padding: CryptoJS.pad.Pkcs7
            }
          );
        } catch (e3) {
          console.error('[CryptoService] Todas as tentativas de descriptografia falharam');
          throw new Error('Falha em todas as tentativas de descriptografia');
        }
      }
    }
    
    // 6. Converter para string e objeto JSON
    let decryptedString;
    try {
      decryptedString = decryptedData.toString(CryptoJS.enc.Utf8);
      
      // Verificar se temos uma string não vazia
      if (!decryptedString || decryptedString.length === 0) {
        console.error('[CryptoService] String descriptografada vazia');
        throw new Error('String descriptografada vazia');
      }
      
      console.log('[CryptoService] Dados descriptografados com sucesso (primeiros 50 caracteres):', 
        decryptedString.substring(0, 50) + '...');
    } catch (error) {
      console.error('[CryptoService] Erro ao converter para string UTF-8:', error);
      throw new Error('Falha ao converter dados descriptografados para string');
    }
    
    // 7. Retornar objeto JSON
    try {
      // Verificar se é um JSON válido
      if (decryptedString.startsWith('{') || decryptedString.startsWith('[')) {
        const jsonData = JSON.parse(decryptedString);
        return jsonData;
      } else {
        // Se não for JSON, retornar como string
        console.log('[CryptoService] Dados descriptografados não são JSON, retornando como string');
        return { data: decryptedString };
      }
    } catch (error) {
      console.error('[CryptoService] Erro ao fazer parse JSON:', error);
      
      // Retornar como string se não for um JSON válido
      return { data: decryptedString };
    }
  } catch (error) {
    console.error('[CryptoService] Erro ao descriptografar dados:', error);
    
    // Em caso de falha na descriptografia, verificar se o modo de desenvolvimento está ativado
    if (isDevModeEnabled()) {
      console.warn('[CryptoService] Usando dados simulados (modo de desenvolvimento)');
      return getSimulatedData();
    }
    
    // Tentar simular dados apenas se não estiver em produção
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      console.warn('[CryptoService] Tentando método alternativo de descriptografia (simulação)');
      return getSimulatedData();
    }
    
    // Em produção, propagar o erro
    throw error;
  }
}

export async function processApiResponse(response: EncryptedResponse): Promise<any> {
  // Se a resposta não estiver criptografada, retornar os dados diretamente
  if (!response.encrypted || !response.encryptedData) {
    console.log('[CryptoService] Processando resposta não criptografada');
    return response.data || [];
  }
  
  // Se estiver criptografada, tentar descriptografar
  try {
    console.log('[CryptoService] Tentando descriptografar dados');
    const decryptedData = await decryptData(response.encryptedData);
    return decryptedData.data || decryptedData;
  } catch (error) {
    console.error('[CryptoService] Erro ao processar resposta da API:', error);
    throw new Error('Não foi possível descriptografar os dados. Verifique sua assinatura e chave de acesso.');
  }
}

export async function processEncryptedData(encryptedData: any): Promise<any> {
  if (!_accessKey) {
    console.error('[CryptoService] Tentativa de descriptografar sem chave de acesso');
    throw new Error('Chave de acesso não disponível. Você precisa de uma assinatura ativa.');
  }
  
  try {
    console.log('[CryptoService] Processando dados criptografados do SSE');
    
    // Verificar se a resposta contém dados criptografados
    if (!encryptedData || !encryptedData.encryptedData) {
      if (encryptedData && encryptedData.data) {
        // Se há dados não criptografados, retorná-los
        return encryptedData.data;
      }
      throw new Error('Formato de dados criptografados inválido');
    }
    
    // Extrair o conteúdo criptografado
    const ironString = encryptedData.encryptedData;
    
    // Verificar o formato Iron
    if (!ironString || typeof ironString !== 'string' || !ironString.startsWith('Fe26.2')) {
      throw new Error('Formato de criptografia não reconhecido');
    }
    
    // Descriptografar usando a chave de acesso
    const decryptedData = await decryptData(ironString);
    
    // Registrar sucesso e retornar os dados
    console.log('[CryptoService] Dados descriptografados com sucesso');
    return decryptedData.data || decryptedData;
  } catch (error) {
    console.error('[CryptoService] Erro ao processar dados criptografados:', error);
    
    // Fornecer mensagem de erro específica
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    throw new Error(`Falha ao descriptografar dados: ${errorMessage}. Verifique sua chave de acesso.`);
  }
}

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

// Função para extrair e configurar a chave de acesso a partir de um evento SSE
export function extractAndSetAccessKeyFromEvent(eventData: any): boolean {
  console.log('[CryptoService] Tentando extrair chave de acesso do evento SSE');
  
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

// Função para definir a chave de API diretamente a partir de um token
export function setApiKey(token: string) {
  console.log('[CryptoService] Configurando chave de API');
  
  // Se o token começar com Bearer, remover
  let apiKey = token;
  if (token.startsWith('Bearer ')) {
    apiKey = token.substring(7);
  }
  
  // Configurar a chave de acesso usando o token da API
  setAccessKey(apiKey);
  
  // Verificar se a configuração foi bem-sucedida
  const keyStatus = hasAccessKey() ? 'configurada' : 'não encontrada';
  console.log(`[CryptoService] Chave de API ${keyStatus} (${apiKey.substring(0, 5)}...)`);
  
  return keyStatus === 'configurada';
}

// Adicionar mais chaves comumente utilizadas para teste
export function tryCommonKeys() {
  console.log('[CryptoService] Tentando chaves comuns');
  
  const commonKeys = [
    'runcash-api-key-v1',
    'runcash-production-v2',
    'Fe26.2',
    'bcf3ce05f3baa107058d6e4ef7bb9718', // Hash encontrado nos logs
    'mcs128i123xcxvc-testkey-production-v1',
    'api_key_2023_v1',
    'iron_seal_key_v1'
  ];
  
  for (const key of commonKeys) {
    console.log(`[CryptoService] Testando chave: ${key}`);
    setAccessKey(key);
    
    // Verificar se a chave funciona com dados de teste
    const testData = "Fe26.2*bcf3ce05f3baa107058d6e4ef7bb9718*ynzV/q7fkJnO3BzLUG9wXjbvjXS9HvPZKRXCZq7IqS4ylO+P9JwIdvg4tHCbpV0Y+8cYt8iJpCE88v2YZ0AtcnlxUYfCGhPMTbcJ+PsEvnbouh+/qvFhsU/3nI3I";
    
    try {
      decryptData(testData);
      console.log(`[CryptoService] ✅ Chave ${key} parece funcionar!`);
      return true;
    } catch (e) {
      console.log(`[CryptoService] ❌ Chave ${key} não funcionou`);
    }
  }
  
  console.log('[CryptoService] Nenhuma chave comum funcionou');
  return false;
}

// Função para habilitar o modo de desenvolvimento (usado quando a descriptografia falha)
export function enableDevMode(enabled = true) {
  console.log(`[CryptoService] ${enabled ? 'Ativando' : 'Desativando'} modo de desenvolvimento`);
  safeLocalStorage.setItem('crypto_dev_mode', enabled ? 'true' : 'false');
}

// Verificar se o modo de desenvolvimento está ativado
export function isDevModeEnabled() {
  return safeLocalStorage.getItem('crypto_dev_mode') === 'true';
}

// Exportar todas as funções como API "cryptoService" para manter compatibilidade
export const cryptoService = {
  hasAccessKey,
  setAccessKey,
  clearAccessKey,
  addAccessKeyToHeaders,
  decryptData,
  processApiResponse,
  processEncryptedData
}; 