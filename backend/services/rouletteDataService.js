/**
 * Serviço para buscar dados de roletas e alimentar o stream
 */

const { MongoClient } = require('mongodb');
const rouletteStreamService = require('./rouletteStreamService');

// Configuração do banco de dados
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = "runcash";

// Cliente MongoDB
let client;
let db;

// Intervalo para busca de dados (em ms)
const FETCH_INTERVAL = 2000; // 2 segundos

class RouletteDataService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.lastFetchTime = 0;
    this.fetchCounter = 0;
    
    // Estrutura para armazenar os últimos números por roleta
    this.latestNumbers = {};
  }

  /**
   * Inicia o serviço de busca e streaming de dados
   */
  async start() {
    if (this.isRunning) {
      console.log('[RouletteData] Serviço já está em execução');
      return;
    }
    
    try {
      // Conectar ao banco de dados
      await this.connectToDatabase();
      
      // Iniciar o intervalo de busca
      this.isRunning = true;
      console.log('[RouletteData] Iniciando serviço de streaming de roletas...');
      
      // Realizar busca inicial
      await this.fetchAndBroadcastRouletteData();
      
      // Configurar intervalo para buscas regulares
      this.intervalId = setInterval(() => {
        this.fetchAndBroadcastRouletteData()
          .catch(err => console.error('[RouletteData] Erro ao buscar dados:', err));
      }, FETCH_INTERVAL);
      
      console.log(`[RouletteData] Serviço iniciado. Intervalo: ${FETCH_INTERVAL}ms`);
    } catch (error) {
      console.error('[RouletteData] Erro ao iniciar serviço:', error);
      this.isRunning = false;
    }
  }

  /**
   * Para o serviço de busca e streaming
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('[RouletteData] Parando serviço de streaming...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('[RouletteData] Serviço parado');
  }

  /**
   * Conecta ao banco de dados MongoDB
   */
  async connectToDatabase() {
    if (!client) {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db(DB_NAME);
      console.log('[RouletteData] Conectado ao MongoDB');
    }
    return { client, db };
  }

  /**
   * Busca dados de roletas do banco de dados e envia para o stream
   */
  async fetchAndBroadcastRouletteData() {
    this.fetchCounter++;
    const startTime = Date.now();
    this.lastFetchTime = startTime;
    
    try {
      // Verificar se há clientes conectados
      const clientCount = rouletteStreamService.getClientCount();
      if (clientCount === 0) {
        // Não há clientes conectados, pular esta iteração
        return;
      }
      
      console.log(`[RouletteData] Buscando dados de roletas (execução #${this.fetchCounter})...`);
      
      // Conectar ao banco de dados (se ainda não estiver conectado)
      const { db } = await this.connectToDatabase();
      
      // Buscar roletas ativas
      const roletas = await db.collection('roletas').find({ ativa: true }).toArray();
      
      if (!roletas || roletas.length === 0) {
        console.log('[RouletteData] Nenhuma roleta ativa encontrada');
        return;
      }
      
      console.log(`[RouletteData] Encontradas ${roletas.length} roletas ativas`);
      
      // Para cada roleta, buscar os números mais recentes
      for (const roleta of roletas) {
        // Buscar os números mais recentes desta roleta
        await this.processRoulette(roleta, db);
      }
      
      const endTime = Date.now();
      console.log(`[RouletteData] Busca completada em ${endTime - startTime}ms`);
    } catch (error) {
      console.error('[RouletteData] Erro ao buscar dados de roletas:', error);
    }
  }

  /**
   * Processa uma roleta individual, buscando seus números e enviando atualizações
   * @param {Object} roleta - Dados da roleta
   * @param {Object} db - Conexão com o banco de dados
   */
  async processRoulette(roleta, db) {
    try {
      // Buscar os números mais recentes desta roleta (limitar a 20)
      const numeros = await db.collection('numeros')
        .find({ roleta_id: roleta.id })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();
      
      if (!numeros || numeros.length === 0) {
        return; // Nenhum número encontrado para esta roleta
      }
      
      const numeroMaisRecente = numeros[0];
      
      // Verificar se temos uma atualização para esta roleta
      // Comparar com o último número conhecido
      const ultimoConhecido = this.latestNumbers[roleta.id];
      
      if (!ultimoConhecido || 
          ultimoConhecido.timestamp !== numeroMaisRecente.timestamp ||
          ultimoConhecido.numero !== numeroMaisRecente.numero) {
        
        // Há uma atualização, salvar o novo número
        this.latestNumbers[roleta.id] = numeroMaisRecente;
        
        // Formatar dados para envio no padrão do concorrente
        const updateData = this.formatRouletteEvent(roleta, numeros);
        
        // Enviar para o stream
        rouletteStreamService.broadcastUpdate(updateData);
        
        console.log(`[RouletteData] Atualização para ${roleta.nome}: número ${numeroMaisRecente.numero}`);
      }
    } catch (error) {
      console.error(`[RouletteData] Erro ao processar roleta ${roleta.id}:`, error);
    }
  }

  /**
   * Formata os dados de roleta para o formato esperado pelo stream
   * Emula o formato visto no concorrente
   * @param {Object} roleta - Dados da roleta
   * @param {Array} numeros - Lista de números da roleta
   * @returns {Object} - Dados formatados
   */
  formatRouletteEvent(roleta, numeros) {
    // Criar uma estrutura similar à vista no concorrente
    return {
      id: roleta.id,
      nome: roleta.nome,
      ativa: roleta.ativa,
      numero: numeros.map(num => ({
        numero: num.numero,
        roleta_id: num.roleta_id,
        roleta_nome: roleta.nome,
        cor: this.determinarCor(num.numero),
        timestamp: num.timestamp
      }))
    };
  }

  /**
   * Determina a cor de um número na roleta
   * @param {number} numero - O número da roleta
   * @returns {string} - A cor correspondente
   */
  determinarCor(numero) {
    if (numero === 0) return 'verde';
    
    // Números vermelhos na roleta europeia
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      fetchCounter: this.fetchCounter,
      lastFetchTime: this.lastFetchTime,
      rouletteCount: Object.keys(this.latestNumbers).length,
      connectedClients: rouletteStreamService.getClientCount()
    };
  }
}

// Criar e exportar instância única
const rouletteDataService = new RouletteDataService();
module.exports = rouletteDataService; 