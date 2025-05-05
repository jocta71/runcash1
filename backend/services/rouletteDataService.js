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
const FETCH_INTERVAL = 2000; // 2 segundos
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
    this.lastDataTime = 0;
    
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
      
      // Configurar heartbeat periódico para manter conexões vivas
      this.heartbeatIntervalId = setInterval(() => {
        this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL);
      
      console.log(`[RouletteData] Serviço iniciado. Intervalo: ${FETCH_INTERVAL}ms, Heartbeat: ${HEARTBEAT_INTERVAL}ms`);
      
      // Remover agendamento de busca do scraper
      // this.scheduleScraperFetch();
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
      
      console.log(`[RouletteData] Buscando dados do MongoDB (execução #${this.fetchCounter})...`);
      
      // Conectar ao banco de dados (se ainda não estiver conectado)
      const { db } = await this.connectToDatabase();
      
      // Buscar roletas ativas
      // ATENÇÃO: Certifique-se que a coleção 'roletas' existe e tem o campo 'ativa'
      // Se não existir, busque direto os números ou ajuste a lógica
      let roletas = [];
      try {
         roletas = await db.collection('roletas').find({ ativa: true }).toArray();
      } catch (err) {
          console.warn("[RouletteData] Coleção 'roletas' não encontrada ou erro ao buscar. Tentando buscar todos os números recentes diretamente.");
          // Fallback: Buscar os últimos números de todas as roletas diretamente se a coleção 'roletas' não existir
          const numerosRecentes = await db.collection('roleta_numeros').aggregate([
              { $sort: { timestamp: -1 } },
              { $group: { 
                  _id: '$roleta_id', 
                  nome: { $first: '$roleta_nome' },
                  // Adicione outros campos se necessário
              }}
          ]).toArray();
          roletas = numerosRecentes.map(r => ({ id: r._id, nome: r.nome })); // Adaptar estrutura
      }
      
      if (!roletas || roletas.length === 0) {
        console.log('[RouletteData] Nenhuma roleta ativa encontrada ou sem dados recentes.');
        return;
      }
      
      console.log(`[RouletteData] Processando ${roletas.length} roletas`);
      
      // Para cada roleta, buscar os números mais recentes
      for (const roleta of roletas) {
        await this.processRoulette(roleta, db);
      }
      
      const endTime = Date.now();
      console.log(`[RouletteData] Busca no MongoDB completada em ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error('[RouletteData] Erro fatal ao buscar/processar dados do MongoDB:', error);
    }
  }

  /**
   * Processa uma roleta específica, busca seus últimos números e envia atualização se houver novidade
   * @param {Object} roleta - Objeto da roleta (precisa ter id e nome)
   * @param {Db} db - Instância do banco de dados MongoDB
   */
  async processRoulette(roleta, db) {
    if (!roleta || !roleta.id) {
        console.warn('[RouletteData] Tentativa de processar roleta inválida:', roleta);
        return;
    }
    
    const roletaId = roleta.id;
    const roletaNome = roleta.nome || roletaId;
    // console.log(`[DEBUG] Processando ${roletaNome} (ID: ${roletaId})`); // Log menos verboso

    try {
      // Buscar os números mais recentes desta roleta (ex: os últimos 20)
      // CORREÇÃO: Usar 'roleta_numeros' aqui
      const numeros = await db.collection('roleta_numeros') 
        .find({ roleta_id: roletaId })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();
      
      if (!numeros || numeros.length === 0) {
        // console.log(`[RouletteData] Nenhum número encontrado para roleta ${roletaNome}`);
        return;
      }
      
      // Pegar o número mais recente
      const numeroMaisRecente = numeros[0];
      
      // Verificar se é um número novo comparado ao último enviado para esta roleta
      const ultimoEnviado = this.latestNumbers[roletaId];
      
      // --- LOGS DE DEPURAÇÃO --- 
      console.log(`\n[DEBUG ${roletaNome}] ----- Verificando Atualização -----`);
      console.log(`[DEBUG ${roletaNome}] Mais Recente DB: Numero=${numeroMaisRecente.numero}, Timestamp=${numeroMaisRecente.timestamp?.toISOString()}`);
      if (ultimoEnviado) {
        console.log(`[DEBUG ${roletaNome}] Último Enviado:  Numero=${ultimoEnviado.numero}, Timestamp=${ultimoEnviado.timestamp?.toISOString()}`);
      } else {
        console.log(`[DEBUG ${roletaNome}] Último Enviado:  Nenhum (primeira vez para esta roleta)`);
      }
      // --- FIM LOGS --- 

      // Comparar pelo timestamp ou pelo próprio número se o timestamp for igual
      let isNew = false;
      if (!ultimoEnviado) {
        isNew = true; // Sempre novo se for a primeira vez
        console.log(`[DEBUG ${roletaNome}] Resultado: NOVO (primeira vez)`);
      } else if (numeroMaisRecente.timestamp > ultimoEnviado.timestamp) {
        isNew = true; // Novo se timestamp for maior
        console.log(`[DEBUG ${roletaNome}] Resultado: NOVO (timestamp maior)`);
      } else if (numeroMaisRecente.timestamp.getTime() === ultimoEnviado.timestamp.getTime() && 
                 numeroMaisRecente.numero !== ultimoEnviado.numero) {
        isNew = true; // Novo se timestamp igual mas número diferente
        console.log(`[DEBUG ${roletaNome}] Resultado: NOVO (timestamp igual, número diferente)`);
      } else {
         console.log(`[DEBUG ${roletaNome}] Resultado: NÃO NOVO`);
      }

      if (isNew) {
           
        console.log(`[RouletteData] Novo número detectado para ${roletaNome}: ${numeroMaisRecente.numero}`);
        
        // Atualizar o último número enviado para esta roleta
        this.latestNumbers[roletaId] = numeroMaisRecente;
        this.lastDataTime = Date.now(); // Atualizar tempo do último dado útil
        
        // Formatar o evento para enviar ao stream
        const formattedData = this.formatRouletteEvent(roleta, numeros);
        
        // Enviar atualização via serviço de stream
        console.log(`[DEBUG ${roletaNome}] Enviando atualização via broadcast...`);
        rouletteStreamService.broadcastUpdate(formattedData);
      } else {
        // console.log(`[RouletteData] Sem novos números para ${roletaNome}`);
      }
      console.log(`[DEBUG ${roletaNome}] ----- Fim Verificação -----`);
    } catch (error) {
      console.error(`[RouletteData] Erro ao processar roleta ${roletaNome}:`, error);
    }
  }

  /**
   * Formata os dados da roleta e seus números para o evento SSE
   * @param {Object} roleta - Objeto da roleta
   * @param {Array} numeros - Array dos últimos números (ordenados do mais recente para o mais antigo)
   * @returns {Object} - Objeto formatado para o evento SSE
   */
  formatRouletteEvent(roleta, numeros) {
    const ultimoNumeroObj = numeros.length > 0 ? numeros[0] : null;
    
    return {
      type: 'update', // Manter consistente com o frontend
      data: {
        id: roleta.id, // Usar ID do objeto roleta
        roleta_id: roleta.id, // Incluir ambos para compatibilidade
        nome: roleta.nome || 'Nome Desconhecido', 
        roleta_nome: roleta.nome || 'Nome Desconhecido',
        provider: roleta.provider || 'Desconhecido', // Adicionar se disponível
        status: roleta.status || 'online', // Adicionar se disponível
        numeros: numeros.map(n => n.numero), // Apenas os números
        ultimoNumero: ultimoNumeroObj ? ultimoNumeroObj.numero : null,
        horarioUltimaAtualizacao: ultimoNumeroObj ? ultimoNumeroObj.timestamp.toISOString() : new Date().toISOString(),
        timestamp: ultimoNumeroObj ? ultimoNumeroObj.timestamp.getTime() : Date.now(), // Timestamp em ms para compatibilidade
        // Adicionar cores se disponíveis
        cores: numeros.map(n => this.determinarCor(n.numero)),
        ultimaCor: ultimoNumeroObj ? this.determinarCor(ultimoNumeroObj.numero) : null,
      }
    };
  }

  /**
   * Determina a cor do número da roleta
   * @param {number} numero 
   * @returns {string} - 'vermelho', 'preto', ou 'verde'
   */
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
      lastDataTime: this.lastDataTime
    };
  }
}

// Exportar uma instância singleton do serviço
module.exports = new RouletteDataService(); 