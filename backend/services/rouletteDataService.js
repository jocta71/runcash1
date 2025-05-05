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
        return; // Pular se não houver clientes
      }
      
      console.log(`[RouletteData] Buscando dados do MongoDB (execução #${this.fetchCounter})...`);
      
      const { db } = await this.connectToDatabase();
      
      // Obter roletas distintas diretamente da coleção de números
      // Agrupar por roleta_id e pegar o nome mais recente
      const distinctRoulettes = await db.collection('roleta_numeros').aggregate([
        { $sort: { timestamp: -1 } }, // Ordenar por timestamp para pegar o nome mais recente
        { $group: { 
            _id: '$roleta_id', // Agrupar pelo ID da roleta (string numérica)
            nome: { $first: '$roleta_nome' }, // Pegar o primeiro nome (mais recente)
            ultimoTimestamp: { $first: '$timestamp' } // Opcional: pegar último timestamp
        }},
        { $project: { // Renomear _id para id para consistência
            _id: 0,
            id: '$_id',
            nome: 1,
            ultimoTimestamp: 1
        }}
      ]).toArray();
      
      if (!distinctRoulettes || distinctRoulettes.length === 0) {
        console.log('[RouletteData] Nenhuma roleta encontrada na coleção roleta_numeros.');
        return;
      }
      
      console.log(`[RouletteData] Processando ${distinctRoulettes.length} roletas distintas encontradas em roleta_numeros`);
      
      // Para cada roleta distinta encontrada, processar
      for (const roleta of distinctRoulettes) {
        // Passar o objeto { id: "string_numerica", nome: "Nome Roleta" }
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
   * @param {Object} roleta - Objeto da roleta (com id=string_numerica e nome)
   * @param {Db} db - Instância do banco de dados MongoDB
   */
  async processRoulette(roleta, db) {
    // Agora esperamos um objeto { id: "string_numerica", nome: "..." }
    if (!roleta || !roleta.id) {
        console.warn('[RouletteData] Tentativa de processar roleta inválida (sem id string):', roleta);
        return;
    }
    
    // Usar o ID string diretamente
    const roletaId = roleta.id; 
    const roletaNome = roleta.nome || roletaId;

    try {
      // Buscar os números mais recentes usando o roleta.id (string numérica)
      const findQuery = { roleta_id: roletaId }; 
      // console.log(`[DEBUG ${roletaNome}] Usando query:`, findQuery); // Log menos verboso

      const numeros = await db.collection('roleta_numeros') 
        .find(findQuery)
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray();
      
      if (!numeros || numeros.length === 0) {
        console.log(`[DEBUG ${roletaNome}] Nenhum número encontrado na coleção roleta_numeros para query:`, findQuery);
        return;
      }
      
      const numeroMaisRecente = numeros[0];
      
      // Usar roletaId (string numérica) como chave
      const ultimoEnviado = this.latestNumbers[roletaId];
      
      console.log(`\n[DEBUG ${roletaNome}] ----- Verificando Atualização -----`);
      console.log(`[DEBUG ${roletaNome}] Mais Recente DB: Numero=${numeroMaisRecente.numero}, Timestamp=${numeroMaisRecente.timestamp?.toISOString()}`);
      if (ultimoEnviado) {
        console.log(`[DEBUG ${roletaNome}] Último Enviado:  Numero=${ultimoEnviado.numero}, Timestamp=${ultimoEnviado.timestamp?.toISOString()}`);
      } else {
        console.log(`[DEBUG ${roletaNome}] Último Enviado:  Nenhum (primeira vez para esta roleta)`);
      }

      let isNew = false;
      if (!ultimoEnviado) {
        isNew = true;
        console.log(`[DEBUG ${roletaNome}] Resultado: NOVO (primeira vez)`);
      } else if (numeroMaisRecente.timestamp > ultimoEnviado.timestamp) {
        isNew = true;
        console.log(`[DEBUG ${roletaNome}] Resultado: NOVO (timestamp maior)`);
      } else if (numeroMaisRecente.timestamp.getTime() === ultimoEnviado.timestamp.getTime() && 
                 numeroMaisRecente.numero !== ultimoEnviado.numero) {
        isNew = true;
        console.log(`[DEBUG ${roletaNome}] Resultado: NOVO (timestamp igual, número diferente)`);
      } else {
         console.log(`[DEBUG ${roletaNome}] Resultado: NÃO NOVO`);
      }

      if (isNew) {
           
        console.log(`[RouletteData] Novo número detectado para ${roletaNome}: ${numeroMaisRecente.numero}`);
        
        // Usar roletaId (string numérica) como chave
        this.latestNumbers[roletaId] = numeroMaisRecente;
        this.lastDataTime = Date.now();
        
        // Passar o objeto roleta { id: string, nome: string } para formatação
        const formattedData = this.formatRouletteEvent(roleta, numeros);
        
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
   * @param {Object} roleta - Objeto da roleta (AGORA ESPERA TER O CAMPO 'id' COMO STRING)
   * @param {Array} numeros - Array dos últimos números (ordenados do mais recente para o mais antigo)
   * @returns {Object} - Objeto formatado para o evento SSE
   */
  formatRouletteEvent(roleta, numeros) {
    const ultimoNumeroObj = numeros.length > 0 ? numeros[0] : null;
    
    // Log para depurar o array numeros
    // console.log(`[DEBUG formatRouletteEvent ${roleta.nome}] Recebeu ${numeros?.length} números. Primeiro número obj:`, ultimoNumeroObj);

    const eventoFormatado = {
      type: 'update', // Manter consistente com o frontend
      data: {
        id: roleta.id, // Usar ID que foi passado (provavelmente string de _id)
        roleta_id: roleta.id, // Incluir ambos para compatibilidade
        nome: roleta.nome || 'Nome Desconhecido', 
        roleta_nome: roleta.nome || 'Nome Desconhecido',
        provider: roleta.provider || 'Desconhecido', // Adicionar se disponível
        status: roleta.status || 'online', // Adicionar se disponível
        numeros: numeros.map(n => n.numero), // Apenas os números
        ultimoNumero: ultimoNumeroObj ? ultimoNumeroObj.numero : null,
        timestamp: ultimoNumeroObj ? ultimoNumeroObj.timestamp.getTime() : Date.now(), // Timestamp em ms para compatibilidade
      }
    };

    // LOG ADICIONADO PARA VER O RESULTADO DA FORMATAÇÃO
    console.log(`[DEBUG formatRouletteEvent ${roleta.nome}] Evento formatado:`, JSON.stringify(eventoFormatado));

    return eventoFormatado;
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