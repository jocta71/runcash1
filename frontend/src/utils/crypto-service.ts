/**
 * Serviço de criptografia da aplicação
 * Este arquivo cria e exporta o objeto cryptoService para uso na aplicação
 */

// Importando apenas CryptoJS
import CryptoJS from 'crypto-js';

// Classe CryptoService que implementa toda a funcionalidade
class CryptoService {
  private _accessKey: string | null = null;
  private _devModeEnabled = false;
  private readonly STORAGE_KEY = 'roulette_access_key';
  
  // Variável para localStorage seguro
  private safeLocalStorage = (() => {
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
  
  // Dados do simulador
  private sequenciasReais = {
    // Evolution - Sequências reais típicas
    evolution: [
      [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30],  // Lightning Roulette
      [0, 26, 3, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1],    // Immersive Roulette
      [5, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31]     // Auto Roulette
    ],
    // Pragmatic - Sequências reais típicas
    pragmatic: [
      [23, 8, 15, 36, 10, 17, 13, 27, 6, 34, 17, 25, 2, 21, 4],    // Mega Roulette
      [11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22],    // Speed Roulette
      [12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16, 24, 5]     // Auto Roulette
    ],
    // Ezugi - Sequências reais típicas
    ezugi: [
      [26, 3, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33],    // Auto Roulette
      [13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31],   // Speed Roulette
      [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14]     // OTT Roulette
    ]
  };
  
  // Índices para rotação das sequências
  private indexRotacao = {
    evolution: [0, 0, 0],
    pragmatic: [0, 0, 0],
    ezugi: [0, 0, 0]
  };
  
  // Timer para atualização automática
  private atualizacaoTimer: number | null = null;
  
  // Flag para usar dados reais do scraper
  private _useRealScraperData = false;
  // URL do scraper para buscar dados reais
  private scraperUrl = '/api/scraper/roulettes';
  // Último timestamp de dados recebidos do scraper
  private lastScraperFetch = 0;
  // Cache de dados do scraper
  private scraperDataCache: any = null;
  
  constructor() {
    // Tentar carregar a chave do armazenamento
    try {
      const storedKey = this.safeLocalStorage.getItem(this.STORAGE_KEY);
      if (storedKey) {
        this._accessKey = storedKey;
      }
    } catch (e) {
      console.error('[CryptoService] Erro ao carregar chave inicial');
    }
    
    // Verificar configurações do localStorage para o uso do scraper
    try {
      this._useRealScraperData = this.safeLocalStorage.getItem('useRealScraper') === 'true';
      const savedScraperUrl = this.safeLocalStorage.getItem('scraperUrl');
      if (savedScraperUrl) {
        this.scraperUrl = savedScraperUrl;
      } else {
        // Verificar variáveis de ambiente (no Vite, usamos importação.meta.env)
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          if (import.meta.env.VITE_USE_REAL_SCRAPER === 'true') {
            this._useRealScraperData = true;
          }
          
          if (import.meta.env.VITE_SCRAPER_URL) {
            this.scraperUrl = import.meta.env.VITE_SCRAPER_URL;
          }
        }
      }
      
      if (this._useRealScraperData) {
        console.log(`[CryptoService] Usando dados reais do scraper: ${this.scraperUrl}`);
      }
    } catch (e) {
      console.error('[CryptoService] Erro ao carregar configurações do scraper:', e);
    }
    
    // Iniciar timer de atualização automática (se necessário)
    if (typeof window !== 'undefined') {
      this.iniciarAtualizacaoAutomatica();
      
      // Adicionar listener para forçar atualização
      window.addEventListener('forceDataUpdate', () => {
        console.log('[CryptoService] Forçando atualização de dados');
        this.scraperDataCache = null;
        this.lastScraperFetch = 0;
        this.rotacionarSequencias();
      });
    }
  }
  
  /**
   * Inicia a atualização automática das sequências para simular novos números
   */
  private iniciarAtualizacaoAutomatica(): void {
    // Limpar timer existente se houver
    if (this.atualizacaoTimer !== null) {
      window.clearInterval(this.atualizacaoTimer);
    }
    
    // Criar novo timer para executar a cada 30 segundos
    this.atualizacaoTimer = window.setInterval(() => {
      if (this._devModeEnabled || this._useRealScraperData) {
        console.log('[CryptoService] Atualizando dados');
        
        if (this._devModeEnabled) {
          this.rotacionarSequencias();
        }
        
        if (this._useRealScraperData) {
          // Forçar atualização do cache após 2 minutos
          const now = Date.now();
          if (now - this.lastScraperFetch > 120000) {
            this.scraperDataCache = null;
            this.lastScraperFetch = 0;
          }
        }
      }
    }, 30000) as unknown as number;
  }
  
  /**
   * Rotaciona as sequências para simular novos números
   */
  private rotacionarSequencias(): void {
    // Rotacionar sequências de cada provedor
    for (const provedor of ['evolution', 'pragmatic', 'ezugi'] as const) {
      for (let i = 0; i < this.sequenciasReais[provedor].length; i++) {
        // Avançar o índice de rotação
        this.indexRotacao[provedor][i] = (this.indexRotacao[provedor][i] + 1) % this.sequenciasReais[provedor][i].length;
        
        // Gerar um novo número aleatório ocasionalmente para aumentar a variabilidade
        if (Math.random() > 0.7) {
          const novoNumero = Math.floor(Math.random() * 37);
          // Substituir um número aleatório na sequência pelo novo número
          const indiceParaSubstituir = Math.floor(Math.random() * this.sequenciasReais[provedor][i].length);
          this.sequenciasReais[provedor][i][indiceParaSubstituir] = novoNumero;
        }
      }
    }
  }
  
  /**
   * Verifica se o modo de desenvolvimento está ativado
   */
  public isDevModeEnabled(): boolean {
    return this._devModeEnabled;
  }
  
  /**
   * Ativa ou desativa o modo de desenvolvimento
   */
  public enableDevMode(enable: boolean = true): boolean {
    this._devModeEnabled = enable;
    console.log(`[CryptoService] Modo de desenvolvimento ${enable ? 'ativado' : 'desativado'}`);
    
    // Iniciar ou parar a atualização automática baseada no modo de desenvolvimento
    if (enable && this.atualizacaoTimer === null && typeof window !== 'undefined') {
      this.iniciarAtualizacaoAutomatica();
    } else if (!enable && this.atualizacaoTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.atualizacaoTimer);
      this.atualizacaoTimer = null;
    }
    
    return this._devModeEnabled;
  }
  
  /**
   * Extrai e configura a chave de acesso de um evento
   */
  public extractAndSetAccessKeyFromEvent(eventData: any): boolean {
    console.log('[CryptoService] Tentando extrair chave de acesso do evento');
    try {
      // Verificar se o eventData é uma string
      if (typeof eventData === 'string') {
        try {
          // Tentar fazer parse do JSON
          const jsonData = JSON.parse(eventData);
          return this.processJsonData(jsonData);
        } catch (e) {
          console.log('[CryptoService] Evento não é um JSON válido');
          return false;
        }
      } else if (eventData && typeof eventData === 'object') {
        // Já é um objeto, verificar campos relevantes
        return this.processJsonData(eventData);
      }
      return false;
    } catch (error) {
      console.error('[CryptoService] Erro ao extrair chave de acesso:', error);
      return false;
    }
  }
  
  /**
   * Função auxiliar para processar dados JSON e extrair chave
   */
  private processJsonData(data: any): boolean {
    // Verificar campos comuns que podem conter a chave
    if (data.accessKey) {
      console.log('[CryptoService] Chave de acesso encontrada no campo accessKey');
      this.setAccessKey(data.accessKey);
      return true;
    }
    if (data.key) {
      console.log('[CryptoService] Chave de acesso encontrada no campo key');
      this.setAccessKey(data.key);
      return true;
    }
    if (data.data && typeof data.data === 'object') {
      // Verificar no campo aninhado data
      if (data.data.accessKey) {
        console.log('[CryptoService] Chave de acesso encontrada em data.accessKey');
        this.setAccessKey(data.data.accessKey);
        return true;
      }
      if (data.data.key) {
        console.log('[CryptoService] Chave de acesso encontrada em data.key');
        this.setAccessKey(data.data.key);
        return true;
      }
    }
    if (data.auth && typeof data.auth === 'object') {
      // Verificar no campo aninhado auth
      if (data.auth.key) {
        console.log('[CryptoService] Chave de acesso encontrada em auth.key');
        this.setAccessKey(data.auth.key);
        return true;
      }
      if (data.auth.accessKey) {
        console.log('[CryptoService] Chave de acesso encontrada em auth.accessKey');
        this.setAccessKey(data.auth.accessKey);
        return true;
      }
    }
    console.log('[CryptoService] Nenhuma chave de acesso encontrada no evento');
    return false;
  }
  
  /**
   * Configura a chave de acesso na inicialização
   */
  public setupAccessKey(): void {
    const testKey = 'mcs128i123xcxvc-testkey-production-v1'; // Chave de exemplo
    const result = this.setAccessKey(testKey);
    console.log('[CryptoService] Verificação de chave: ' +
      (result ? 'Chave configurada com sucesso' : 'Falha ao configurar chave'));
  }
  
  /**
   * Verifica se existe uma chave de acesso configurada
   */
  public hasAccessKey(): boolean {
    return !!this._accessKey;
  }
  
  /**
   * Define a chave de acesso e salva no localStorage
   */
  public setAccessKey(key: string): boolean {
    this._accessKey = key;
    try {
      this.safeLocalStorage.setItem(this.STORAGE_KEY, key);
    } catch (e) {
      console.error('[CryptoService] Erro ao salvar chave:', e);
    }
    return this.hasAccessKey();
  }
  
  /**
   * Limpa a chave de acesso
   */
  public clearAccessKey(): void {
    this._accessKey = null;
    this.safeLocalStorage.removeItem(this.STORAGE_KEY);
  }
  
  /**
   * Adiciona a chave de acesso aos headers de uma requisição
   */
  public addAccessKeyToHeaders(headers: HeadersInit = {}): HeadersInit {
    if (this._accessKey) {
      return {
        ...headers,
        'Authorization': `Bearer ${this._accessKey}`
      };
    }
    return headers;
  }
  
  /**
   * Retorna dados simulados para desenvolvimento
   */
  private getSimulatedData(): any {
    console.log('[CryptoService] Gerando dados simulados com sequências reais de roletas');
    
    // Obter timestamp atual
    const timestamp = Date.now();
    const formattedDate = new Date(timestamp).toISOString();
    
    // Preparar dados para cada roleta com rotação de sequências
    const obterSequenciaRotacionada = (provedor: 'evolution' | 'pragmatic' | 'ezugi', indice: number) => {
      const sequencia = [...this.sequenciasReais[provedor][indice]]; // Copiar array
      const rotacao = this.indexRotacao[provedor][indice];
      
      // Rotacionar a sequência
      return [
        ...sequencia.slice(rotacao),
        ...sequencia.slice(0, rotacao)
      ];
    };
    
    // Criar roletas simuladas
    const simulatedRoulettes = [
      {
        id: "simulated_1",
        nome: "Lightning Roulette",
        provider: "Evolution",
        status: "online",
        numeros: obterSequenciaRotacionada('evolution', 0),
        ultimoNumero: obterSequenciaRotacionada('evolution', 0)[0],
        horarioUltimaAtualizacao: formattedDate
      },
      {
        id: "simulated_2",
        nome: "Mega Roulette",
        provider: "Pragmatic",
        status: "online",
        numeros: obterSequenciaRotacionada('pragmatic', 0),
        ultimoNumero: obterSequenciaRotacionada('pragmatic', 0)[0],
        horarioUltimaAtualizacao: formattedDate
      },
      {
        id: "simulated_3",
        nome: "Auto Roulette",
        provider: "Ezugi",
        status: "online",
        numeros: obterSequenciaRotacionada('ezugi', 0),
        ultimoNumero: obterSequenciaRotacionada('ezugi', 0)[0],
        horarioUltimaAtualizacao: formattedDate
      },
      {
        id: "simulated_4",
        nome: "Immersive Roulette",
        provider: "Evolution",
        status: "online",
        numeros: obterSequenciaRotacionada('evolution', 1),
        ultimoNumero: obterSequenciaRotacionada('evolution', 1)[0],
        horarioUltimaAtualizacao: formattedDate
      },
      {
        id: "simulated_5",
        nome: "Speed Roulette",
        provider: "Pragmatic",
        status: "online",
        numeros: obterSequenciaRotacionada('pragmatic', 1),
        ultimoNumero: obterSequenciaRotacionada('pragmatic', 1)[0],
        horarioUltimaAtualizacao: formattedDate
      }
    ];
    
    // Estrutura final dos dados simulados
    const simulatedData = {
      data: simulatedRoulettes
    };
    
    console.log('[DEBUG] Dados simulados gerados com sequências reais');
    return simulatedData;
  }
  
  /**
   * Ativa o uso de dados reais do scraper
   */
  public enableRealScraperData(enable: boolean = true): boolean {
    this._useRealScraperData = enable;
    console.log(`[CryptoService] Uso de dados reais do scraper ${enable ? 'ativado' : 'desativado'}`);
    return this._useRealScraperData;
  }

  /**
   * Verifica se está usando dados reais do scraper
   */
  public isUsingRealScraperData(): boolean {
    return this._useRealScraperData;
  }

  /**
   * Define a URL do scraper
   */
  public setScraperUrl(url: string): void {
    this.scraperUrl = url;
    console.log(`[CryptoService] URL do scraper configurada: ${url}`);
    // Limpar cache ao mudar a URL
    this.scraperDataCache = null;
    this.lastScraperFetch = 0;
  }

  /**
   * Formata os dados do scraper para o formato esperado pelo UnifiedRouletteClient
   */
  private formatScraperData(data: any): any {
    console.log('[CryptoService] Formatando dados do scraper');
    
    try {
      // Verificar se já está no formato esperado
      if (data && data.data && Array.isArray(data.data)) {
        console.log('[CryptoService] Dados já estão no formato esperado');
        return data;
      }
      
      // Verificar se é um array direto de roletas
      if (Array.isArray(data)) {
        console.log('[CryptoService] Convertendo array direto para formato padrão');
        return { data };
      }
      
      // Verificar estrutura específica do scraper (ajustar conforme necessário)
      if (data && data.roulettes && Array.isArray(data.roulettes)) {
        console.log('[CryptoService] Convertendo formato do scraper para formato padrão');
        
        // Mapear dados do scraper para o formato esperado
        const formattedData = data.roulettes.map((roulette: any) => {
          return {
            id: roulette.id || `scraper_${Math.random().toString(36).substring(7)}`,
            nome: roulette.name || roulette.nome || 'Roleta sem nome',
            provider: roulette.provider || 'Scraper',
            status: roulette.status || 'online',
            numeros: roulette.last_numbers || roulette.numeros || [],
            ultimoNumero: roulette.last_number || roulette.ultimoNumero || 
                          (roulette.last_numbers && roulette.last_numbers[0]) || 
                          (roulette.numeros && roulette.numeros[0]) || 0,
            horarioUltimaAtualizacao: roulette.updated_at || roulette.horarioUltimaAtualizacao || new Date().toISOString()
          };
        });
        
        return { data: formattedData };
      }
      
      // Se chegou aqui, o formato é desconhecido
      console.warn('[CryptoService] Formato de dados do scraper desconhecido:', data);
      // Retornar no formato esperado, mas vazio
      return { data: [] };
      
    } catch (error) {
      console.error('[CryptoService] Erro ao formatar dados do scraper:', error);
      return { data: [] };
    }
  }

  /**
   * Busca dados reais do scraper
   */
  private async fetchScraperData(): Promise<any> {
    const now = Date.now();
    
    // Usar cache se tiver menos de 10 segundos
    if (this.scraperDataCache && now - this.lastScraperFetch < 10000) {
      console.log('[CryptoService] Usando cache de dados do scraper');
      return Promise.resolve(this.scraperDataCache);
    }
    
    console.log(`[CryptoService] Buscando dados reais do scraper: ${this.scraperUrl}`);
    
    try {
      // Fazer requisição para o scraper
      const response = await fetch(this.scraperUrl);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar dados do scraper: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Formatar dados para o formato esperado
      const formattedData = this.formatScraperData(data);
      
      this.lastScraperFetch = now;
      this.scraperDataCache = formattedData;
      
      console.log('[CryptoService] Dados do scraper recebidos e formatados com sucesso');
      return formattedData;
    } catch (error) {
      console.error('[CryptoService] Erro ao buscar dados do scraper:', error);
      
      // Se tiver cache, usar mesmo desatualizado
      if (this.scraperDataCache) {
        console.warn('[CryptoService] Usando cache desatualizado do scraper');
        return this.scraperDataCache;
      }
      
      // Sem cache, usar dados simulados
      console.warn('[CryptoService] Usando dados simulados como fallback');
      return this.getSimulatedData();
    }
  }

  /**
   * Descriptografa dados fornecidos
   */
  public async decryptData(encryptedData: string): Promise<any> {
    if (!encryptedData || encryptedData.trim() === '') {
      return null;
    }
  
    try {
      // Se estamos usando dados reais do scraper, tentar buscar
      if (this._useRealScraperData) {
        console.log("[crypto-service] Modo scraper real ativo, buscando dados");
        try {
          return await this.fetchScraperData();
        } catch (scraperError) {
          console.error("[crypto-service] Erro ao buscar dados do scraper:", scraperError);
          
          // Se modo de desenvolvimento também estiver ativo, usar simulação como fallback
          if (this._devModeEnabled) {
            console.warn("[crypto-service] Usando dados simulados como fallback após erro do scraper");
            return this.getSimulatedData();
          }
        }
      }
      
      // Se estamos no modo de desenvolvimento, retornar dados simulados
      if (this._devModeEnabled) {
        console.log("[crypto-service] Modo de desenvolvimento ativo, retornando dados simulados");
        return this.getSimulatedData();
      }
  
      // Se não tivermos uma chave de acesso, retornar erro
      if (!this.hasAccessKey()) {
        throw new Error("Chave de acesso não encontrada");
      }
  
      // Verificar se os dados já estão descriptografados
      if (typeof encryptedData === 'object') {
        return encryptedData;
      }
  
      // Tentativa de descriptografia com a chave atual
      let decrypted = null;
      
      try {
        // Tratamento para diferentes formatos possíveis de dados
        if (encryptedData.startsWith('{"') || encryptedData.startsWith('[')) {
          // Dados já estão em formato JSON, apenas parse
          return JSON.parse(encryptedData);
        } else {
          // Dados provavelmente estão criptografados
          const bytes = CryptoJS.AES.decrypt(encryptedData, this._accessKey!);
          decrypted = bytes.toString(CryptoJS.enc.Utf8);
          
          // Se a descriptografia resultou em string vazia, provavelmente falhou
          if (!decrypted) {
            throw new Error("Falha na descriptografia - resultado vazio");
          }
          
          return JSON.parse(decrypted);
        }
      } catch (innerError) {
        console.error("[crypto-service] Erro na descriptografia:", innerError);
        
        // Em desenvolvimento, retornar dados simulados mesmo com erro
        if (this._devModeEnabled) {
          console.warn("[crypto-service] Usando dados simulados devido a erro de descriptografia");
          return this.getSimulatedData();
        }
        
        throw innerError;
      }
    } catch (error) {
      console.error("[crypto-service] Erro geral:", error);
      
      // Se modo de desenvolvimento ativo, retornar dados simulados mesmo com erro
      if (this._devModeEnabled) {
        console.warn("[crypto-service] Retornando dados simulados após erro");
        return this.getSimulatedData();
      }
      
      throw error;
    }
  }
  
  /**
   * Tenta usar chaves comuns para configurar o acesso
   */
  public tryCommonKeys(): boolean {
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
      this.setAccessKey(key);
      
      if (this.hasAccessKey()) {
        console.log('[CryptoService] Chave configurada com sucesso');
        return true;
      }
    }
    
    console.log('[CryptoService] Nenhuma chave comum funcionou');
    return false;
  }
  
  /**
   * Processa resposta da API
   */
  public async processApiResponse(response: any): Promise<any> {
    if (!response.encrypted && !response.encryptedData) {
      return response.data || [];
    }
    
    try {
      const decryptedData = await this.decryptData(response.encryptedData);
      return decryptedData.data || decryptedData;
    } catch (error) {
      throw new Error('Falha ao descriptografar dados da API');
    }
  }
  
  /**
   * Processa dados criptografados
   */
  public async processEncryptedData(encryptedData: any): Promise<any> {
    if (!this.hasAccessKey()) {
      throw new Error('Chave de acesso não disponível');
    }
    
    try {
      if (!encryptedData || !encryptedData.encryptedData) {
        if (encryptedData && encryptedData.data) {
          return encryptedData.data;
        }
        throw new Error('Formato de dados inválido');
      }
      
      const decryptedData = await this.decryptData(encryptedData.encryptedData);
      return decryptedData.data || decryptedData;
    } catch (error) {
      throw new Error('Falha ao processar dados criptografados');
    }
  }
  
  /**
   * Limpa recursos ao destruir o serviço
   */
  public dispose(): void {
    if (this.atualizacaoTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.atualizacaoTimer);
      this.atualizacaoTimer = null;
    }
  }
}

// Criar e exportar instância única do serviço
const cryptoService = new CryptoService();
export { cryptoService };
export default cryptoService; 