import axios from 'axios';

class RouletteFeedService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3002';
    this.pollingInterval = null;
    this.pollingDelay = 5000; // 5 segundos
    this.callbacks = {
      onUpdate: null,
      onError: null
    };
    this.lastUpdateTimestamp = null;
    this.rouletteData = {};
  }

  /**
   * Inicia o serviço de polling para obter dados das roletas
   * @param {Function} onUpdate - Callback chamado quando novos dados são recebidos
   * @param {Function} onError - Callback chamado quando ocorre um erro
   * @param {Number} delay - Intervalo de polling em milissegundos (opcional)
   */
  start(onUpdate, onError, delay = null) {
    // Limpar intervalo existente se houver
    if (this.pollingInterval) {
      this.stop();
    }

    // Configurar callbacks
    this.callbacks.onUpdate = onUpdate;
    this.callbacks.onError = onError;
    
    // Configurar delay personalizado se fornecido
    if (delay && typeof delay === 'number' && delay > 0) {
      this.pollingDelay = delay;
    }

    // Fazer primeira requisição imediatamente
    this.fetchRouletteData();

    // Configurar intervalo para as próximas requisições
    this.pollingInterval = setInterval(() => {
      this.fetchRouletteData();
    }, this.pollingDelay);

    console.log(`Serviço de roletas iniciado com intervalo de ${this.pollingDelay}ms`);
  }

  /**
   * Para o serviço de polling
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('Serviço de roletas parado');
    }
  }
  
  /**
   * Busca dados atualizados de todas as roletas
   * @private
   */
  async fetchRouletteData() {
    try {
      // Construir URL com timestamp da última atualização, se disponível
      let url = `${this.baseUrl}/api/roletas`;
      if (this.lastUpdateTimestamp) {
        url += `?since=${this.lastUpdateTimestamp}`;
      }
      
      const response = await axios.get(url);
      
      if (response.status === 200) {
        // Atualizar dados das roletas
        this.processRouletteData(response.data);
        
        // Chamar callback de atualização
        if (this.callbacks.onUpdate) {
          this.callbacks.onUpdate(this.rouletteData);
        }
      }
    } catch (error) {
      console.error('Erro ao obter dados das roletas:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    }
  }
  
  /**
   * Processa os dados recebidos das roletas
   * @param {Array} data - Dados recebidos da API
   * @private
   */
  processRouletteData(data) {
    // Atualizar timestamp da última requisição bem-sucedida
    this.lastUpdateTimestamp = Date.now();
    
    // Processar cada roleta recebida
    data.forEach(roulette => {
      const id = roulette._id || roulette.id;
      
      // Se ainda não temos esta roleta, inicializar
      if (!this.rouletteData[id]) {
        this.rouletteData[id] = {
          id,
          name: roulette.name,
          numbers: [],
          lastUpdated: null
        };
      }
      
      // Atualizar informações da roleta
      if (roulette.name) {
        this.rouletteData[id].name = roulette.name;
      }
      
      // Adicionar novos números, se presentes
      if (roulette.recentNumbers && roulette.recentNumbers.length > 0) {
        this.rouletteData[id].numbers = roulette.recentNumbers;
        
        // Atualizar timestamp da última atualização desta roleta
        if (roulette.lastUpdated) {
          this.rouletteData[id].lastUpdated = roulette.lastUpdated;
        } else {
          this.rouletteData[id].lastUpdated = this.lastUpdateTimestamp;
        }
      }
    });
  }
  
  /**
   * Obtém os dados mais recentes de todas as roletas
   * @returns {Object} Objeto com dados de todas as roletas
   */
  getAllRouletteData() {
    return this.rouletteData;
  }
  
  /**
   * Obtém os dados mais recentes de uma roleta específica
   * @param {String} id - ID da roleta
   * @returns {Object|null} Dados da roleta ou null se não encontrada
   */
  getRouletteData(id) {
    return this.rouletteData[id] || null;
  }
  
  /**
   * Obtém os últimos N números de uma roleta específica
   * @param {String} id - ID da roleta
   * @param {Number} count - Quantidade de números a retornar (opcional)
   * @returns {Array} Array com os últimos números da roleta
   */
  getLatestNumbers(id, count = null) {
    const roulette = this.rouletteData[id];
    if (!roulette || !roulette.numbers) {
      return [];
    }
    
    if (count && typeof count === 'number') {
      return roulette.numbers.slice(0, count);
    }
    
    return roulette.numbers;
  }
}

// Exporta uma instância singleton
export default new RouletteFeedService(); 