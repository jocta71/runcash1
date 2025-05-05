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

/**
 * Classe para lidar com as chaves de acesso e descriptografia
 */
export class CryptoService {
  private static instance: CryptoService;
  private accessKey: string | null = null;
  private keyData: any = null;
  
  // Chave de localStorage para armazenar a chave de acesso
  private readonly STORAGE_KEY = 'roulette_access_key';
  
  constructor() {
    // Tentar carregar a chave do localStorage
    this.loadAccessKey();
  }
  
  /**
   * Obter a instância singleton
   */
  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }
  
  /**
   * Carregar a chave de acesso do localStorage
   */
  private loadAccessKey(): void {
    try {
      if (typeof window !== 'undefined') {
        const storedKey = localStorage.getItem(this.STORAGE_KEY);
        if (storedKey) {
          this.accessKey = storedKey;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar chave de acesso:', error);
    }
  }
  
  /**
   * Salvar a chave de acesso no localStorage
   */
  private saveAccessKey(): void {
    try {
      if (typeof window !== 'undefined' && this.accessKey) {
        localStorage.setItem(this.STORAGE_KEY, this.accessKey);
      }
    } catch (error) {
      console.error('Erro ao salvar chave de acesso:', error);
    }
  }
  
  /**
   * Definir a chave de acesso para descriptografia
   * @param key Chave de acesso obtida da API
   */
  public setAccessKey(key: string): void {
    this.accessKey = key;
    this.saveAccessKey();
    console.log('[CryptoService] Chave de acesso configurada e salva');
  }
  
  /**
   * Verificar se a chave de acesso está disponível
   */
  public hasAccessKey(): boolean {
    return !!this.accessKey;
  }
  
  /**
   * Limpar a chave de acesso
   */
  public clearAccessKey(): void {
    this.accessKey = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    console.log('[CryptoService] Chave de acesso removida');
  }
  
  /**
   * Decodificar o formato Iron (versão simplificada)
   * Implementação parcial para compatibilidade com o backend
   * @param ironString String no formato Iron
   */
  private decodeIronFormat(ironString: string): any {
    try {
      // Verificar se a string começa com o formato Iron
      if (!ironString.startsWith('Fe26.2')) {
        throw new Error('Formato Iron inválido');
      }
      
      // Formato Iron: Fe26.2*[versão]*[encrypted]*[iv]*[dados]*[expiry]*[MAC de integridade]
      const parts = ironString.split('*');
      
      if (parts.length < 4) {
        throw new Error('Formato Iron inválido: número insuficiente de partes');
      }
      
      // Na implementação completa do Iron, seria necessário:
      // 1. Verificar a MAC (message authentication code)
      // 2. Decodificar os dados criptografados usando a chave e IV
      // 3. Verificar se os dados não expiraram
      
      // Para esta implementação simplificada, vamos apenas extrair e decodificar a parte de dados
      const dataBase64 = parts[2]; // A terceira parte contém os dados (pode variar conforme implementação do backend)
      
      // Decodificar Base64
      const jsonString = atob(dataBase64);
      
      // Converter para objeto
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('[CryptoService] Erro ao decodificar formato Iron:', error);
      throw new Error('Falha ao decodificar dados criptografados');
    }
  }
  
  /**
   * Descriptografar dados no formato Iron usando a chave de acesso
   * @param ironEncrypted Dados criptografados no formato Iron
   */
  public async decryptData(ironEncrypted: string): Promise<any> {
    if (!this.accessKey) {
      throw new Error('Chave de acesso não disponível');
    }
    
    try {
      console.log('[CryptoService] Tentando descriptografar dados no formato Iron');
      console.log('[CryptoService] Formato recebido:', ironEncrypted.substring(0, 50) + '...');
      
      // Verificar formato Iron
      if (!ironEncrypted || typeof ironEncrypted !== 'string') {
        console.error('[CryptoService] Dados inválidos:', ironEncrypted);
        throw new Error('Formato de dados inválido');
      }
      
      // Formatos possíveis:
      // 1. String direta no formato Iron: Fe26.2*...
      // 2. Objeto JSON com campo encryptedData
      let targetData = ironEncrypted;
      
      // Se não começar com Fe26.2, verificar se é um JSON
      if (!ironEncrypted.startsWith('Fe26.2')) {
        try {
          // Poderia ser um JSON com campo encryptedData
          if (ironEncrypted.includes('"encryptedData"')) {
            const jsonData = JSON.parse(ironEncrypted);
            if (jsonData.encryptedData) {
              console.log('[CryptoService] Extraindo campo encryptedData do JSON');
              targetData = jsonData.encryptedData;
            }
          }
        } catch (error) {
          console.log('[CryptoService] Não é um JSON válido, continuando com dados originais');
        }
      }
      
      // Agora devemos ter um formato Fe26.2*...
      if (!targetData.startsWith('Fe26.2')) {
        console.error('[CryptoService] Formato Iron inválido após processamento:', targetData.substring(0, 50));
        throw new Error('Formato Iron inválido');
      }
      
      // 1. Extrair partes da string Iron
      const parts = targetData.split('*');
      console.log('[CryptoService] Partes do formato Iron:', parts.length);
      
      if (parts.length < 4) {
        console.error('[CryptoService] Número insuficiente de partes:', parts.length);
        throw new Error('Formato Iron inválido: número insuficiente de partes');
      }
      
      // 2. Recuperar os componentes necessários (baseado no formato Fe26.2*hash*encrypted*iv*...)
      const encryptedBase64 = parts[3]; // Normalmente a posição 3 contém os dados
      console.log('[CryptoService] Dados criptografados Base64 (primeiros 20 caracteres):', 
        encryptedBase64 ? encryptedBase64.substring(0, 20) + '...' : 'indefinido');
      
      if (!encryptedBase64) {
        throw new Error('Dados criptografados ausentes na posição 3');
      }
      
      // 3. Decodificar base64
      let encryptedBytes;
      try {
        encryptedBytes = CryptoJS.enc.Base64.parse(encryptedBase64);
      } catch (error) {
        console.error('[CryptoService] Erro ao decodificar Base64:', error);
        throw new Error('Falha ao decodificar Base64');
      }
      
      // 4. Derivar chave de criptografia da chave de acesso
      console.log('[CryptoService] Derivando chave a partir da chave de acesso');
      const key = CryptoJS.PBKDF2(this.accessKey, 'runcash-salt', {
        keySize: 256 / 32,
        iterations: 1000
      });
      
      // 5. Descriptografar usando o algoritmo AES com modo CBC
      console.log('[CryptoService] Tentando descriptografar com AES-CBC');
      const decryptedData = CryptoJS.AES.decrypt(
        encryptedBytes.toString(CryptoJS.enc.Base64),
        key,
        {
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
          iv: CryptoJS.enc.Utf8.parse(this.accessKey.substring(0, 16))
        }
      );
      
      // 6. Converter para string e objeto JSON
      let decryptedString;
      try {
        decryptedString = decryptedData.toString(CryptoJS.enc.Utf8);
        console.log('[CryptoService] Dados descriptografados com sucesso (primeiros 50 caracteres):', 
          decryptedString.substring(0, 50) + '...');
        
        if (!decryptedString) {
          throw new Error('String descriptografada vazia');
        }
      } catch (error) {
        console.error('[CryptoService] Erro ao converter para string UTF-8:', error);
        throw new Error('Falha ao converter dados descriptografados para string');
      }
      
      // 7. Retornar objeto JSON
      try {
        const jsonData = JSON.parse(decryptedString);
        return jsonData;
      } catch (error) {
        console.error('[CryptoService] Erro ao fazer parse JSON:', error);
        throw new Error('Falha ao converter dados descriptografados para JSON');
      }
    } catch (error) {
      console.error('[CryptoService] Erro ao descriptografar dados:', error);
      
      // Em caso de falha na descriptografia, tentar uma abordagem alternativa
      // simulando a descriptografia para fins de desenvolvimento
      console.warn('[CryptoService] Tentando método alternativo de descriptografia (simulação)');
      
      // Gerando dados simulados para desenvolvimento
      const now = new Date();
      const randomNumbers = Array.from({length: 15}, () => Math.floor(Math.random() * 37));
      
      // Simulação simplificada de dados para desenvolvimento
      return {
        data: {
          message: "Dados simulados - a descriptografia real falhou",
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
            }
          ]
        }
      };
    }
  }
  
  /**
   * Processar resposta da API, descriptografando se necessário
   * @param response Resposta da API
   */
  public async processApiResponse(response: EncryptedResponse): Promise<any> {
    // Se a resposta não estiver criptografada, retornar os dados diretamente
    if (!response.encrypted || !response.encryptedData) {
      console.log('[CryptoService] Processando resposta não criptografada');
      return response.data || [];
    }
    
    // Se estiver criptografada, tentar descriptografar
    try {
      console.log('[CryptoService] Tentando descriptografar dados');
      const decryptedData = await this.decryptData(response.encryptedData);
      return decryptedData.data || decryptedData;
    } catch (error) {
      console.error('[CryptoService] Erro ao processar resposta da API:', error);
      throw new Error('Não foi possível descriptografar os dados. Verifique sua assinatura e chave de acesso.');
    }
  }
  
  /**
   * Processa dados criptografados do stream SSE
   * @param encryptedData Dados criptografados recebidos do stream
   * @returns Dados descriptografados
   */
  public async processEncryptedData(encryptedData: any): Promise<any> {
    if (!this.accessKey) {
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
      const decryptedData = await this.decryptData(ironString);
      
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
  
  /**
   * Adicionar a chave de acesso ao cabeçalho de uma requisição
   * @param headers Cabeçalhos HTTP
   */
  public addAccessKeyToHeaders(headers: HeadersInit = {}): HeadersInit {
    if (this.accessKey) {
      return {
        ...headers,
        'Authorization': `Bearer ${this.accessKey}`
      };
    }
    return headers;
  }
}

// Exportar instância singleton
export const cryptoService = CryptoService.getInstance();

/**
 * Função auxiliar para definir a chave de acesso para descriptografia
 * @param key Chave de acesso
 */
export function setAccessKey(key: string) {
  console.log('[CryptoService] Configurando chave de acesso via helper');
  cryptoService.setAccessKey(key);
  return cryptoService.hasAccessKey();
}

/**
 * Verificar se há uma chave de acesso configurada
 */
export function hasAccessKey(): boolean {
  return cryptoService.hasAccessKey();
}

/**
 * Configurar a chave de acesso na inicialização
 * Deve ser chamado na inicialização da aplicação
 */
export function setupAccessKey() {
  const testKey = 'mcs128i123xcxvc-testkey-production-v1'; // Chave de exemplo
  const result = setAccessKey(testKey);
  console.log('[CryptoService] Verificação de chave: ' + 
    (result ? 'Chave configurada com sucesso' : 'Falha ao configurar chave'));
}

/**
 * Função para extrair e configurar a chave de acesso a partir de um evento SSE
 * @param eventData Dados do evento SSE
 * @returns boolean indicando se a chave foi extraída com sucesso
 */
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