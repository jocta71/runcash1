/**
 * Serviço para consumir eventos SSE (Server-Sent Events) de roletas
 * Lida com criptografia e atualização em tempo real
 */

import CryptoUtil from '../utils/cryptoUtil';

class RouletteSSEService {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.listeners = [];
    this.lastData = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // 2 segundos
  }

  /**
   * Conecta ao endpoint SSE
   * @returns {Promise<boolean>} Verdadeiro se conectado com sucesso
   */
  async connect() {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      // Usar a nova URL de streaming
      const url = `${process.env.REACT_APP_API_URL || ''}/api/stream/roulettes`;
      
      this.eventSource = new EventSource(url);
      
      // Configurar handlers de eventos
      this.eventSource.onopen = this.handleOpen.bind(this);
      this.eventSource.onerror = this.handleError.bind(this);
      
      // Configurar listeners para tipos específicos de eventos
      this.eventSource.addEventListener('connect', this.handleConnect.bind(this));
      this.eventSource.addEventListener('update', this.handleUpdate.bind(this));
      this.eventSource.addEventListener('ping', this.handlePing.bind(this));
      
      return new Promise((resolve) => {
        // Resolver a promessa quando a conexão for estabelecida
        const checkConnection = () => {
          if (this.isConnected) {
            resolve(true);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        
        checkConnection();
      });
    } catch (error) {
      console.error('Erro ao conectar ao SSE:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Desconecta do endpoint SSE
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.isConnected = false;
    console.log('Desconectado do serviço SSE');
  }

  /**
   * Manipula evento de abertura da conexão
   */
  handleOpen() {
    console.log('Conexão SSE aberta');
    this.reconnectAttempts = 0;
  }

  /**
   * Manipula evento de conexão estabelecida
   * @param {Event} event - Evento de conexão
   */
  handleConnect(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('Conexão SSE estabelecida:', data);
      this.isConnected = true;
      
      // Notificar sobre conexão
      this.notifyListeners('connection', data);
    } catch (error) {
      console.error('Erro ao processar evento de conexão:', error);
    }
  }

  /**
   * Manipula evento de atualização de dados
   * @param {Event} event - Evento de atualização
   */
  async handleUpdate(event) {
    try {
      // Os dados recebidos são criptografados
      const encryptedData = event.data;
      
      // Tentar descriptografar
      const decryptedData = await CryptoUtil.decryptData(encryptedData);
      
      if (decryptedData) {
        this.lastData = decryptedData;
        
        // Notificar ouvintes sobre os novos dados
        this.notifyListeners('data', decryptedData);
      }
    } catch (error) {
      console.error('Erro ao processar evento de atualização:', error);
    }
  }

  /**
   * Manipula evento de ping (manter conexão viva)
   * @param {Event} event - Evento de ping
   */
  handlePing(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('Ping recebido:', new Date(data.timestamp).toLocaleTimeString());
    } catch (error) {
      console.error('Erro ao processar evento de ping:', error);
    }
  }

  /**
   * Manipula erros de conexão
   * @param {Event} error - Evento de erro
   */
  handleError(error) {
    console.error('Erro na conexão SSE:', error);
    this.isConnected = false;
    
    // Notificar ouvintes sobre o erro
    this.notifyListeners('error', { message: 'Erro na conexão SSE' });
    
    // Tentar reconectar
    this.attemptReconnect();
  }

  /**
   * Tenta reconectar ao serviço SSE
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Máximo de tentativas de reconexão atingido');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Registra um ouvinte para eventos
   * @param {Function} listener - Função que será chamada quando houver novos dados
   * @returns {Function} Função para cancelar o registro
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('O ouvinte deve ser uma função');
    }
    
    this.listeners.push(listener);
    
    // Se já tivermos dados disponíveis, notificar imediatamente
    if (this.lastData) {
      listener('data', this.lastData);
    }
    
    // Retornar função para cancelar a inscrição
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifica todos os ouvintes sobre um evento
   * @param {String} type - Tipo de evento
   * @param {Object} data - Dados do evento
   */
  notifyListeners(type, data) {
    this.listeners.forEach(listener => {
      try {
        listener(type, data);
      } catch (error) {
        console.error('Erro ao notificar ouvinte:', error);
      }
    });
  }

  /**
   * Obter dados alternativos via chamada REST em vez de SSE
   * Útil como fallback se SSE falhar
   * @returns {Promise<Object>} Dados obtidos da API REST
   */
  async fetchDataFromREST() {
    try {
      const url = `${process.env.REACT_APP_API_URL || ''}/api/public/roulettes`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const { data: encryptedData } = await response.json();
      
      // Descriptografar dados
      const decryptedData = await CryptoUtil.decryptData(encryptedData);
      
      if (decryptedData) {
        this.lastData = decryptedData;
        this.notifyListeners('data', decryptedData);
        return decryptedData;
      }
      
      throw new Error('Falha ao descriptografar dados');
    } catch (error) {
      console.error('Erro ao buscar dados via REST:', error);
      this.notifyListeners('error', { message: 'Erro ao buscar dados' });
      throw error;
    }
  }
}

// Exportar instância singleton
const instance = new RouletteSSEService();
export default instance; 