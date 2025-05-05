/**
 * Serviço para buscar dados de roletas e alimentar o stream
 */

const { MongoClient } = require('mongodb');
const rouletteStreamService = require('./rouletteStreamService');
// const axios = require('axios'); // Remover dependência não utilizada

// Configuração do banco de dados
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = "runcash";

// Cliente MongoDB
let client;
let db;

// Intervalo para busca de dados (em ms)
const FETCH_INTERVAL = 8000; // ALTERADO: 8 segundos
const HEARTBEAT_INTERVAL = 30000; // 30 segundos

// Remover URL do Scraper - Leremos apenas do MongoDB
// const SCRAPER_URL = process.env.SCRAPER_URL || "https://backendscraper-production-ccda.up.railway.app/api/roulettes";

class RouletteDataService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.heartbeatIntervalId = null;
    this.lastFetchTime = 0;
    this.fetchCounter = 0;
    // REMOVIDO: Não precisamos mais rastrear o último número enviado por roleta
    // this.latestNumbers = {}; 
    // this.lastDataTime = 0;
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
      await this.connectToDatabase();
      this.isRunning = true;
      console.log('[RouletteData] Iniciando serviço de busca e envio de todas as roletas...');
      
      // Realizar busca inicial
      await this.fetchAndBroadcastAllRouletteData();
      
      // Configurar intervalo para buscas regulares
      this.intervalId = setInterval(() => {
        this.fetchAndBroadcastAllRouletteData()
          .catch(err => console.error('[RouletteData] Erro ao buscar e enviar todos os dados:', err));
      }, FETCH_INTERVAL);
      
      // Configurar heartbeat periódico
      this.heartbeatIntervalId = setInterval(() => {
        this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL);
      
      console.log(`[RouletteData] Serviço iniciado. Intervalo: ${FETCH_INTERVAL}ms, Heartbeat: ${HEARTBEAT_INTERVAL}ms`);

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
    
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
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
   * Envia heartbeat para manter conexões ativas
   */
  sendHeartbeat() {
    const clientCount = rouletteStreamService.getClientCount();
    
    if (clientCount === 0) {
      return; // Não há clientes conectados
    }
    
    console.log(`[RouletteData] Enviando heartbeat para ${clientCount} clientes...`);
    
    const heartbeatData = {
      type: 'heartbeat',
      timestamp: Date.now(),
      message: 'Conexão ativa'
    };
    
    rouletteStreamService.broadcastUpdate(heartbeatData);
  }

  // Remover função de busca do scraper e seus dependentes
  /* 
  scheduleScraperFetch() {
    // ... removido ... 
  }
  */
  
  /* 
  processScraperData(data) {
    // ... removido ...
  }
  */

  /**
   * Busca dados de TODAS as roletas do banco de dados e envia UM ÚNICO evento para o stream
   */
  async fetchAndBroadcastAllRouletteData() {
    this.fetchCounter++;
    const startTime = Date.now();
    this.lastFetchTime = startTime;
    
    try {
      const clientCount = rouletteStreamService.getClientCount();
      if (clientCount === 0) {
        return; // Pular se não houver clientes
      }
      
      console.log(`[RouletteData] Buscando dados de TODAS as roletas (execução #${this.fetchCounter})...`);
      
      const { db } = await this.connectToDatabase();
      
      // 1. Obter roletas distintas
      const distinctRoulettes = await db.collection('roleta_numeros').aggregate([
        { $sort: { timestamp: -1 } }, 
        { $group: { 
            _id: '$roleta_id', 
            nome: { $first: '$roleta_nome' },
            provider: { $first: '$provider'}, // Adicionar provider se existir
            status: { $first: '$status'} // Adicionar status se existir
        }},
        { $project: { 
            _id: 0,
            id: '$_id',
            nome: 1,
            provider: 1, 
            status: 1 
        }}
      ]).toArray();
      
      if (!distinctRoulettes || distinctRoulettes.length === 0) {
        console.log('[RouletteData] Nenhuma roleta encontrada na coleção roleta_numeros.');
        return;
      }
      
      // 2. Para cada roleta, buscar seus últimos 5 números e formatar
      const allRouletteData = [];
      for (const roletaInfo of distinctRoulettes) {
          const numeros = await db.collection('roleta_numeros') 
            .find({ roleta_id: roletaInfo.id })
            .sort({ timestamp: -1 })
            .limit(5)
            .toArray();
          
          if (numeros && numeros.length > 0) {
              // Usar a função formatRouletteEvent, mas pegar apenas o objeto 'data' interno
              const formattedEvent = this.formatRouletteEvent(roletaInfo, numeros);
              if (formattedEvent && formattedEvent.data) {
                 allRouletteData.push(formattedEvent.data);
              }
          } else {
              // Opcional: incluir roleta mesmo sem números?
              // allRouletteData.push({ id: roletaInfo.id, nome: roletaInfo.nome, numeros: [] });
              console.log(`[DEBUG ${roletaInfo.nome}] Nenhum número encontrado.`);
          }
      }

      // 3. Enviar o array completo em um único evento SSE
      if (allRouletteData.length > 0) {
          console.log(`[RouletteData] Enviando dados de ${allRouletteData.length} roletas em um único evento.`);
          rouletteStreamService.broadcastUpdate({
              type: 'all_roulettes_update', // Novo tipo de evento
              data: allRouletteData // Array com dados de todas as roletas
          });
      } else {
          console.log('[RouletteData] Nenhum dado de roleta para enviar.');
      }
      
      const endTime = Date.now();
      console.log(`[RouletteData] Ciclo completo de busca e envio concluído em ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error('[RouletteData] Erro fatal ao buscar/processar todos os dados:', error);
    }
  }

  /**
   * Formata os dados da roleta e seus números para o evento SSE
   * (Mantido para formatar dados de UMA roleta, chamado pelo loop em fetchAndBroadcastAllRouletteData)
   * @param {Object} roleta - Objeto da roleta (com id=string_numerica, nome, provider?, status?)
   * @param {Array} numeros - Array dos últimos 5 números
   * @returns {Object} - Objeto formatado para o evento SSE (incluindo type)
   */
  formatRouletteEvent(roleta, numeros) {
    const ultimoNumeroObj = numeros.length > 0 ? numeros[0] : null;
    
    // Retorna a estrutura COMPLETA do evento para uma roleta
    // A função chamadora pegará apenas o campo 'data'
    return {
      type: 'update', // Tipo individual, será agrupado em 'all_roulettes_update'
      data: {
        id: roleta.id,
        roleta_id: roleta.id,
        nome: roleta.nome || 'Nome Desconhecido', 
        roleta_nome: roleta.nome || 'Nome Desconhecido',
        provider: roleta.provider || 'Desconhecido', 
        status: roleta.status || 'online',
        numeros: numeros.map(n => n.numero), 
        ultimoNumero: ultimoNumeroObj ? ultimoNumeroObj.numero : null,
        timestamp: ultimoNumeroObj ? ultimoNumeroObj.timestamp.getTime() : Date.now(),
      }
    };
  }

  /**
   * Determina a cor do número da roleta
   * @param {number} numero 
   * @returns {string} - 'vermelho', 'preto', ou 'verde'
   */
  // A função determinarCor ainda pode ser útil se o frontend precisar dela no futuro,
  // mas não é mais usada diretamente no formatRouletteEvent
  determinarCor(numero) {
    if (numero === 0) return 'verde';
    const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return vermelhos.includes(numero) ? 'vermelho' : 'preto';
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastFetchTime: this.lastFetchTime,
      fetchCounter: this.fetchCounter,
      // lastDataTime não é mais relevante da mesma forma
    };
  }
}

// Exportar uma instância singleton do serviço
module.exports = new RouletteDataService(); 