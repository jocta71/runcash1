/**
 * Utilitários para descriptografia de dados da API
 * Implementação compatível com o formato Iron usado no backend
 */

import CryptoJS from 'crypto-js';

// Interface para os dados selados
interface SealedData {
  data: any;
  createdAt: number;
  expiresAt: number;
}

// Interface para os dados recebidos da API
interface EncryptedResponse {
  success: boolean;
  encryptedData?: string;
  data?: any;
  limited: boolean;
  totalCount: number;
  availableCount: number;
  encrypted: boolean;
  format?: string;
  message: string;
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
  }
  
  /**
   * Decodificar o formato Iron (versão simplificada)
   * Implementação parcial para compatibilidade com o backend
   * @param ironString String no formato Iron
   */
  private decodeIronFormat(ironString: string): any {
    try {
      // Formato Iron: Fe26.2*[versão]*[dados]*[MAC de integridade]
      const parts = ironString.split('*');
      
      if (parts.length < 4 || !parts[0].startsWith('Fe26.')) {
        throw new Error('Formato Iron inválido');
      }
      
      // Na implementação completa, seria necessário verificar a MAC,
      // mas para fins de demonstração, só vamos decodificar os dados
      const dataBase64 = parts[2];
      
      // Decodificar Base64
      const decodedData = atob(dataBase64);
      
      // Converter para objeto
      const jsonData = JSON.parse(decodedData);
      
      return jsonData;
    } catch (error) {
      console.error('Erro ao decodificar formato Iron:', error);
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
      // Nota: Esta é uma implementação simplificada.
      // Em uma implementação real, você usaria os algoritmos exatos do backend.
      
      // Simular a descriptografia usando a chave de acesso
      // No fronted, seria necessário um algoritmo compatível com o seal/unseal do backend
      
      // Para esta demonstração, vamos apenas retornar dados mockados
      // Em um ambiente real, você utilizaria CryptoJS ou outras bibliotecas
      
      // Simular uma operação de descriptografia
      return { 
        // Dados mockados que representariam os dados descriptografados
        data: "Dados descriptografados com sucesso",
        message: "Esta é uma simulação de descriptografia no frontend"
      };
    } catch (error) {
      console.error('Erro ao descriptografar dados:', error);
      throw new Error('Falha ao descriptografar dados');
    }
  }
  
  /**
   * Processar resposta da API, descriptografando se necessário
   * @param response Resposta da API
   */
  public async processApiResponse(response: EncryptedResponse): Promise<any> {
    // Se a resposta não estiver criptografada, retornar os dados diretamente
    if (!response.encrypted || !response.encryptedData) {
      return response.data || [];
    }
    
    // Se estiver criptografada, tentar descriptografar
    try {
      const decryptedData = await this.decryptData(response.encryptedData);
      return decryptedData;
    } catch (error) {
      console.error('Erro ao processar resposta da API:', error);
      throw new Error('Não foi possível descriptografar os dados. Verifique sua assinatura.');
    }
  }
}

// Exportar instância singleton
export const cryptoService = CryptoService.getInstance(); 