/**
 * Serviço para buscar dados de roletas e alimentar o stream
 */

const { MongoClient } = require('mongodb');
const rouletteStreamService = require('./rouletteStreamService');
// const axios = require('axios'); // Remover dependência não utilizada

// Configuração do banco de dados
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Usar o novo banco de dados roletas_db
const DB_NAME = process.env.ROLETAS_MONGODB_DB_NAME || "roletas_db";

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
      console.log(`[RouletteData] Conectado ao MongoDB (Banco: ${DB_NAME})`);
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
      
      // 1. Obter roletas da coleção metadados
      const roletasMetadados = await db.collection('metadados').find({
        ativa: true
      }).toArray();
      
      if (!roletasMetadados || roletasMetadados.length === 0) {
        console.log('[RouletteData] Nenhuma roleta encontrada na coleção metadados.');
        return;
      }
      
      console.log(`[RouletteData] Encontradas ${roletasMetadados.length} roletas ativas.`);
      
      // 2. Para cada roleta, buscar seus últimos 5 números de sua coleção específica
      const allRouletteData = [];
      for (const roletaMetadata of roletasMetadados) {
        const roleta_id = roletaMetadata.roleta_id;
        const roleta_nome = roletaMetadata.roleta_nome;
        
        try {
          // Verificar se a coleção existe
          const collections = await db.listCollections({name: roleta_id}).toArray();
          
          if (collections.length === 0) {
            console.log(`[RouletteData] Coleção para roleta ${roleta_id} não encontrada.`);
            continue;
          }
          
          // Buscar os números da coleção específica da roleta
          const numeros = await db.collection(roleta_id) 
            .find({})
            .sort({ timestamp: -1 })
            .limit(5)
            .toArray();
          
          if (numeros && numeros.length > 0) {
            // Criar objeto da roleta
            const roletaInfo = {
              id: roleta_id,
              nome: roleta_nome,
              provider: roletaMetadata.provider || 'Desconhecido',
              status: roletaMetadata.status || 'online'
            };
            
            // Formatar dados da roleta
            const formattedEvent = this.formatRouletteEvent(roletaInfo, numeros);
            if (formattedEvent && formattedEvent.data) {
               allRouletteData.push(formattedEvent.data);
            }
          } else {
            console.log(`[RouletteData] Nenhum número encontrado para roleta ${roleta_nome} (ID: ${roleta_id}).`);
          }
        } catch (err) {
          console.error(`[RouletteData] Erro ao processar roleta ${roleta_id}:`, err);
        }
      }

      // 3. Enviar o array completo em um único evento SSE
      if (allRouletteData.length > 0) {
        console.log(`[RouletteData] Enviando dados de ${allRouletteData.length} roletas em um único evento.`);
        rouletteStreamService.broadcastUpdate({
          type: 'all_roulettes_update',
          data: allRouletteData
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
   * Determina a cor de um número da roleta
   */
  determinarCor(numero) {
    if (numero === 0) return 'verde';
    const pretos = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    return pretos.includes(numero) ? 'preto' : 'vermelho';
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