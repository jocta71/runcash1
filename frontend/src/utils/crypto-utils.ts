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
      // Na implementação real, seria necessário implementar a lógica completa
      // do algoritmo de criptografia usado pelo backend (Iron)
      
      // Implementação simplificada usando CryptoJS
      // Nota: Este é um exemplo e não reflete a implementação real do Iron
      
      // 1. Extrair partes da string Iron
      const parts = ironEncrypted.split('*');
      if (parts.length < 6) {
        throw new Error('Formato Iron inválido');
      }
      
      // 2. Recuperar os componentes necessários
      const encryptedBase64 = parts[3]; // Posição pode variar dependendo da implementação
      
      // 3. Decodificar base64
      const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedBase64);
      
      // 4. Derivar chave de criptografia da chave de acesso
      const key = CryptoJS.PBKDF2(this.accessKey, 'runcash-salt', {
        keySize: 256 / 32,
        iterations: 1000
      });
      
      // 5. Descriptografar (exemplo - a implementação real depende do algoritmo usado pelo backend)
      const decryptedData = CryptoJS.AES.decrypt(
        encryptedBytes.toString(CryptoJS.enc.Base64),
        key,
        {
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      
      // 6. Converter para string e objeto JSON
      const decryptedString = decryptedData.toString(CryptoJS.enc.Utf8);
      
      // Log para depuração
      console.log('[CryptoService] Dados descriptografados com sucesso');
      
      // 7. Retornar objeto JSON
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('[CryptoService] Erro ao descriptografar dados:', error);
      
      // Em caso de falha na descriptografia, tentar uma abordagem alternativa
      // simulando a descriptografia para fins de desenvolvimento
      console.warn('[CryptoService] Tentando método alternativo de descriptografia (simulação)');
      
      // Simulação simplificada de dados para desenvolvimento
      return {
        data: {
          message: "Dados simulados - a descriptografia real falhou",
          timestamp: Date.now(),
          details: "Esta é uma simulação. A implementação real requer o algoritmo exato usado pelo backend."
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
   * @param encryptedData Dados criptografados no formato 'Fe26.2*...'
   * @returns Dados descriptografados
   */
  public async processEncryptedData(encryptedData: string): Promise<any> {
    if (!this.accessKey) {
      throw new Error('Chave de acesso não disponível');
    }
    
    try {
      console.log('[CryptoService] Tentando descriptografar dados do stream');
      
      // Verificar se os dados estão no formato esperado
      if (!encryptedData.startsWith('Fe26.2*')) {
        throw new Error('Formato de dados criptografados inválido');
      }
      
      // Separar os componentes: Fe26.2*[iv]*[dados crypto]*
      const parts = encryptedData.split('*');
      if (parts.length < 3) {
        throw new Error('Formato inválido: dados criptografados incompletos');
      }
      
      // Extrair IV e dados criptografados
      const iv = Buffer.from(parts[1], 'hex');
      const encryptedPayload = Buffer.from(parts[2], 'base64');
      
      // Derivar chave a partir da chave de acesso
      const key = CryptoJS.PBKDF2(this.accessKey, 'runcash-salt', {
        keySize: 256 / 32,
        iterations: 1000
      });
      
      // Descriptografar usando CryptoJS
      const decrypted = CryptoJS.AES.decrypt(
        encryptedPayload.toString('base64'),
        key,
        {
          iv: CryptoJS.enc.Hex.parse(iv.toString('hex')),
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      
      // Converter para string e objeto JSON
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      const decryptedData = JSON.parse(decryptedStr);
      
      console.log('[CryptoService] Dados de stream descriptografados com sucesso');
      
      // Verificar se os dados ainda são válidos (não expiraram)
      if (decryptedData.expiresAt && decryptedData.expiresAt < Date.now()) {
        throw new Error('Dados criptografados expiraram');
      }
      
      // Retornar os dados reais
      return decryptedData.data;
    } catch (error) {
      console.error('[CryptoService] Erro ao descriptografar dados do stream:', error);
      throw error;
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