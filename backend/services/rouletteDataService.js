/**
 * Serviço para buscar dados de roletas e alimentar o stream em tempo real usando Change Streams
 */

const { MongoClient } = require('mongodb');
const rouletteStreamService = require('./rouletteStreamService');

// Configuração do banco de dados
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = process.env.ROLETAS_MONGODB_DB_NAME || "roletas_db";

// Cliente MongoDB
let client;
let db;

// Intervalos de tempo (em ms)
const HEARTBEAT_INTERVAL = 30000; // 30 segundos para heartbeat

// Active change streams
let activeChangeStreams = [];

// Mapeamento de IDs de roleta para formato padronizado
const MAPEAMENTO_ROLETAS = {
  // UUID para ID numérico
  "a8a1f746-6002-eabf-b14d-d78d13877599": "2010097", // VIP Roulette
  "ab0ab995-bb00-9b42-57fe-856838109c3d": "2010440", // XXXtreme Lightning Roulette
  "0b8fdb47-e536-6f43-bf53-96b9a34af3b7": "2010099", // Football Studio Roulette
  "a11fd7c4-3ce0-9115-fe95-e761637969ad": "2010012", // American Roulette
  "1fa13bd8-47f4-eaeb-1540-f203da568290": "2010165", // Roulette
  "ec79f914-5261-e90b-45cc-ebe65b0c96a2": "2330057", // Ruleta Relámpago en Vivo
  "eabd279d-90cf-74f7-c080-a2240dca6517": "2010186", // Gold Vault Roulette
  "c4b2e581-2699-3705-490d-9b89fe85c16a": "2330057", // Ruleta en Vivo
  "18bdc4ea-d884-c47a-d33f-27a268a4eead": "2010096", // Speed Auto Roulette
  "a0f21bd0-6156-1c4e-b05c-b630ce563fbb": "2330053", // Roulette Macao
  "1dfb0fcd-76dd-2fe9-27fe-fe35c87cd4a4": "2330049", // Bucharest Roulette
  "e3345af9-e387-9412-209c-e793fe73e520": "2330049", // Bucharest Auto-Roulette
  "4cf27e48-2b9d-b58e-7dcc-48264c51d639": "2330047", // Immersive Roulette
  "1c34d1e0-6d96-6f5b-3c53-bc6852bf9fd8": "2010201", // Lightning Roulette Italia
  "96a31ffc-7c6e-3980-395c-aa163c6d5759": "2010179", // Russian Roulette
  "419aa56c-bcff-67d2-f424-a6501bac4a36": "2330051", // Auto-Roulette VIP
  "278b90ba-c190-f5ac-e214-c40b1474e9f7": "2010118", // Lightning Roulette
  "a92e8f3b-665f-aec7-5e07-a8ef91818cda": "2010097", // VIP Auto Roulette
  "bc007d81-eb92-96a5-573c-2a2ee28c2fd7": "2010141", // Roulette 1
  "1b4131a6-307a-6a64-974d-d03b2d107002": "2010178", // Fortune Roulette
  "206f0db9-84b9-888a-8b4c-f3b1b2b5c4da": "2010091", // Mega Roulette
  "fe79694c-6212-6ae6-47ad-0593c35ded71": "2010202", // Roulette Italia Tricolore
  "1920129d-760a-1755-c393-03d05c9de118": "2010200", // Türkçe Lightning Rulet
  "8663c411-e6af-e341-3854-b163e3d349a3": "2010176", // Turkish Roulette
  "afc07eb8-a37c-48af-c6ff-5de999e1871b": "2010177", // Romanian Roulette
  "14f70979-2311-5460-1fec-b722322d353e": "2330054", // Speed Roulette 1
  "2cc41e23-fb04-2926-77d5-d55831e97bab": "2010180", // Dansk Roulette
  "7d3c2c9f-2850-f642-861f-5bb4daf1806a": "2330048", // Brazilian Mega Roulette
  "f27dd03e-5282-fc78-961c-6375cef91565": "2010183", // Ruleta Automática
  "5403e259-2f6c-cd2d-324c-63f0a00dee05": "2010184", // Jawhara Roulette
  
  // Nome para ID numérico
  "Speed Roulette": "2330046",
  "Immersive Roulette": "2330047",
  "Brazilian Mega Roulette": "2330048",
  "Bucharest Auto-Roulette": "2330049",
  "Auto-Roulette": "2330050",
  "Auto-Roulette VIP": "2330051",
  "VIP Roulette": "2330052",
  "Roulette Macao": "2330053",
  "Speed Roulette 1": "2330054",
  "Hippodrome Grand Casino": "2330055",
  "Ruleta Bola Rapida en Vivo": "2330056",
  "Ruleta en Vivo": "2330057"
};

// Números vermelhos na roleta europeia (formato padrão para backend e frontend)
const NUMEROS_VERMELHOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

class RouletteDataService {
  constructor() {
    this.isRunning = false;
    this.heartbeatIntervalId = null;
    this.fetchCounter = 0;
    this.lastEventTime = 0;
    this.colecoesMonitoradas = new Set();
    this.roletasAtivas = [];
  }

  /**
   * Inicia o serviço de monitoramento e streaming de dados usando Change Streams
   */
  async start() {
    if (this.isRunning) {
      console.log('[RouletteData] Serviço já está em execução');
      return;
    }
    
    try {
      await this.connectToDatabase();
      this.isRunning = true;
      console.log('[RouletteData] Iniciando serviço de monitoramento em tempo real...');
      
      // Carregar metadados das roletas ativas
      await this.carregarMetadados();
      
      // Configurar monitoramento de change streams
      await this.configureChangeStreams();
      
      // Realizar busca inicial
      await this.fetchAndBroadcastAllRouletteData();
      
      // Configurar heartbeat periódico
      this.heartbeatIntervalId = setInterval(() => {
        this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL);
      
      console.log('[RouletteData] Serviço iniciado com monitoramento em tempo real via Change Streams');

    } catch (error) {
      console.error('[RouletteData] Erro ao iniciar serviço:', error);
      this.isRunning = false;
    }
  }

  /**
   * Para o serviço de monitoramento e streaming
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log('[RouletteData] Parando serviço de streaming...');
    
    // Fechar todos os change streams ativos
    for (const stream of activeChangeStreams) {
      try {
        await stream.close();
        console.log('[RouletteData] Change stream fechado');
      } catch (err) {
        console.error('[RouletteData] Erro ao fechar change stream:', err);
      }
    }
    activeChangeStreams = [];
    
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    
    this.isRunning = false;
    this.colecoesMonitoradas.clear();
    console.log('[RouletteData] Serviço parado');
  }

  /**
   * Carrega metadados das roletas ativas
   */
  async carregarMetadados() {
    try {
      // Obter roletas ativas da coleção metadados
      this.roletasAtivas = await db.collection('metadados').find({
        ativa: true
      }).toArray();
      
      console.log(`[RouletteData] Carregados metadados de ${this.roletasAtivas.length} roletas ativas`);
      return this.roletasAtivas;
    } catch (error) {
      console.error('[RouletteData] Erro ao carregar metadados:', error);
      return [];
    }
  }

  /**
   * Configura change streams para monitorar coleções de roletas
   */
  async configureChangeStreams() {
    try {
      // 1. Configurar change stream para coleção comum roleta_numeros
      const commonCollectionExists = await db.listCollections({name: 'roleta_numeros'}).toArray();
      if (commonCollectionExists.length > 0) {
        await this.monitorarColecaoComum();
      }
      
      // 2. Monitorar coleções numéricas (uma por roleta)
      const todasColecoes = await db.listCollections().toArray();
      const colecoesNumericas = todasColecoes.filter(col => /^\d+$/.test(col.name)).map(col => col.name);
      
      for (const colecaoId of colecoesNumericas) {
        await this.monitorarColecaoIndividual(colecaoId);
      }
      
      // 3. Monitorar coleções com UUID
      for (const roleta of this.roletasAtivas) {
        const roletaId = roleta.roleta_id;
        if (!roletaId || /^\d+$/.test(roletaId)) continue; // Pular se for numérico ou nulo
        
        const collections = await db.listCollections({name: roletaId}).toArray();
        if (collections.length > 0 && !this.colecoesMonitoradas.has(roletaId)) {
          await this.monitorarColecaoIndividual(roletaId, roleta);
        }
      }
      
      console.log(`[RouletteData] Change Streams configurados para ${this.colecoesMonitoradas.size} coleções`);
      
    } catch (error) {
      console.error('[RouletteData] Erro ao configurar Change Streams:', error);
    }
  }
  
  /**
   * Monitora a coleção comum roleta_numeros
   */
  async monitorarColecaoComum() {
    try {
      const collection = db.collection('roleta_numeros');
      const changeStream = collection.watch([], { fullDocument: 'updateLookup' });
      
      changeStream.on('change', async (change) => {
        if (change.operationType === 'insert' || change.operationType === 'update') {
          const documento = change.fullDocument;
          
          if (!documento) return;
          
          const roletaId = documento.roleta_id;
          const roletaNome = documento.roleta_nome;
          
          if (!roletaId && !roletaNome) return;
          
          // Buscar metadados da roleta
          const roleta = this.roletasAtivas.find(r => 
            r.roleta_id === roletaId || r.roleta_nome === roletaNome);
          
          if (!roleta) return;
          
          // Processar e enviar atualização
          await this.processarAtualizacaoRoleta(roleta);
        }
      });
      
      changeStream.on('error', (error) => {
        console.error('[RouletteData] Erro no change stream da coleção comum:', error);
      });
      
      activeChangeStreams.push(changeStream);
      this.colecoesMonitoradas.add('roleta_numeros');
      console.log('[RouletteData] Monitorando coleção comum roleta_numeros');
      
    } catch (error) {
      console.error('[RouletteData] Erro ao monitorar coleção comum:', error);
    }
  }
  
  /**
   * Monitora uma coleção individual de roleta
   */
  async monitorarColecaoIndividual(colecaoId, roletaMetadata = null) {
    if (this.colecoesMonitoradas.has(colecaoId)) return;
    
    try {
      const collection = db.collection(colecaoId);
      const changeStream = collection.watch([], { fullDocument: 'updateLookup' });
      
      // Identificar metadados da roleta correspondente
      let roleta = roletaMetadata;
      
      if (!roleta) {
        // Buscar roleta associada a esta coleção
        roleta = this.roletasAtivas.find(r => {
          // Verificar ID direto
          if (r.roleta_id === colecaoId) return true;
          
          // Verificar ID mapeado
          const idNumerico = this.getIdNumericoPorIdentificador(r.roleta_id, r.roleta_nome);
          return idNumerico === colecaoId;
        });
      }
      
      if (!roleta) {
        console.log(`[RouletteData] Não foi possível identificar a roleta para coleção ${colecaoId}`);
        return;
      }
      
      changeStream.on('change', async (change) => {
        if (change.operationType === 'insert' || change.operationType === 'update') {
          await this.processarAtualizacaoRoleta(roleta);
        }
      });
      
      changeStream.on('error', (error) => {
        console.error(`[RouletteData] Erro no change stream da coleção ${colecaoId}:`, error);
      });
      
      activeChangeStreams.push(changeStream);
      this.colecoesMonitoradas.add(colecaoId);
      console.log(`[RouletteData] Monitorando coleção individual ${colecaoId} para roleta ${roleta.roleta_nome}`);
      
    } catch (error) {
      console.error(`[RouletteData] Erro ao monitorar coleção ${colecaoId}:`, error);
    }
  }
  
  /**
   * Processa uma atualização de roleta e envia para os clientes
   */
  async processarAtualizacaoRoleta(roleta) {
    try {
      const roletaId = roleta.roleta_id;
      const roletaNome = roleta.roleta_nome;
      
      // Verificar se há clientes conectados
      const clientCount = rouletteStreamService.getClientCount();
      if (clientCount === 0) return;
      
      // Obter ID numérico
      const idNumerico = this.getIdNumericoPorIdentificador(roletaId, roletaNome);
      
      // Buscar os últimos números desta roleta
      const numerosEncontrados = await this.buscarNumerosRoleta(roletaId, roletaNome, idNumerico);
      
      if (numerosEncontrados && numerosEncontrados.length > 0) {
        // Formatar os dados
        const roletaInfo = {
          id: roletaId,
          nome: roletaNome,
          provider: roleta.provider || 'Desconhecido',
          status: roleta.status || 'online'
        };
        
        const eventData = this.formatRouletteEvent(roletaInfo, numerosEncontrados);
        
        // Enviar atualização individual em tempo real
        rouletteStreamService.broadcastUpdate({
          type: 'roulette_update',
          data: eventData.data
        });
        
        this.lastEventTime = Date.now();
        this.fetchCounter++;
        
        console.log(`[RouletteData] Atualização em tempo real enviada para roleta ${roletaNome}`);
      }
    } catch (error) {
      console.error(`[RouletteData] Erro ao processar atualização da roleta:`, error);
    }
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

  /**
   * Obtém o ID numérico conhecido para um UUID ou nome de roleta
   * @param {string} uuid - UUID ou nome da roleta
   * @param {string} nome - Nome alternativo da roleta
   * @returns {string|null} - ID numérico ou null se não encontrado
   */
  getIdNumericoPorIdentificador(uuid, nome) {
    // Verificar diretamente no mapeamento unificado
    if (MAPEAMENTO_ROLETAS[uuid]) {
      return MAPEAMENTO_ROLETAS[uuid];
    }
    
    // Verificar pelo nome
    if (nome && MAPEAMENTO_ROLETAS[nome]) {
      return MAPEAMENTO_ROLETAS[nome];
    }
    
    // Se o uuid já for numérico, retornar ele mesmo
    if (uuid && /^\d+$/.test(uuid)) {
      return uuid;
    }
    
    // Tentar extrair dígitos do UUID como último recurso
    if (uuid && uuid.includes('-')) {
      const digits = uuid.replace(/\D/g, '');
      if (digits && digits.length > 0) {
        return digits.substring(0, 10);
      }
    }
    
    return null;
  }

  /**
   * Busca números de uma roleta específica no banco de dados
   * @param {string} roletalId - ID da roleta
   * @param {string} roletaNome - Nome da roleta
   * @param {string} idNumerico - ID numérico da roleta
   * @returns {Array} - Array de números encontrados
   */
  async buscarNumerosRoleta(roletaId, roletaNome, idNumerico) {
    try {
      let numerosEncontrados = null;
      
      // Estratégia 1: Verificar coleção com ID numérico
      if (idNumerico) {
        const colecoesDisponiveis = await db.listCollections().toArray();
        const colecoes = colecoesDisponiveis.map(c => c.name);
        
        if (colecoes.includes(idNumerico)) {
          numerosEncontrados = await db.collection(idNumerico)
            .find({})
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();
            
          if (numerosEncontrados && numerosEncontrados.length > 0) {
            return numerosEncontrados;
          }
        }
      }
      
      // Estratégia 2: Usar UUID original como nome da coleção
      if (roletaId && !/^\d+$/.test(roletaId)) {
        const collections = await db.listCollections({name: roletaId}).toArray();
        
        if (collections.length > 0) {
          numerosEncontrados = await db.collection(roletaId)
            .find({})
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();
            
          if (numerosEncontrados && numerosEncontrados.length > 0) {
            return numerosEncontrados;
          }
        }
      }
      
      // Estratégia 3: Buscar na coleção comum 'roleta_numeros'
      const colecaoComumExiste = await db.listCollections({name: 'roleta_numeros'}).toArray();
      
      if (colecaoComumExiste.length > 0) {
        // Queries a tentar em ordem de prioridade
        const queries = [];
        
        if (idNumerico) {
          queries.push({ roleta_id: idNumerico });
        }
        
        if (roletaId) {
          queries.push({ roleta_id: roletaId });
        }
        
        if (roletaNome) {
          queries.push({ roleta_nome: roletaNome });
        }
        
        // Tentar cada query em sequência
        for (const query of queries) {
          const numerosQuery = await db.collection('roleta_numeros')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(20)
            .toArray();
            
          if (numerosQuery && numerosQuery.length > 0) {
            return numerosQuery;
          }
        }
      }
      
      return [];
    } catch (error) {
      console.error(`[RouletteData] Erro ao buscar números para roleta ${roletaNome}:`, error);
      return [];
    }
  }

  /**
   * Busca dados de TODAS as roletas do banco de dados e envia UM ÚNICO evento para o stream
   * Usado principalmente para a inicialização
   */
  async fetchAndBroadcastAllRouletteData() {
    this.fetchCounter++;
    const startTime = Date.now();
    
    try {
      const clientCount = rouletteStreamService.getClientCount();
      if (clientCount === 0) {
        return; // Pular se não houver clientes
      }
      
      console.log(`[RouletteData] Buscando dados iniciais de todas as roletas...`);
      
      if (!this.roletasAtivas || this.roletasAtivas.length === 0) {
        await this.carregarMetadados();
      }
      
      // Para cada roleta, buscar seus últimos números
      const allRouletteData = [];
      
      for (const roletaMetadata of this.roletasAtivas) {
        const roleta_id = roletaMetadata.roleta_id;
        const roleta_nome = roletaMetadata.roleta_nome;
        
        try {
          // Obter ID numérico da roleta
          const id_numerico = this.getIdNumericoPorIdentificador(roleta_id, roleta_nome);
          
          // Buscar números para esta roleta
          const numerosEncontrados = await this.buscarNumerosRoleta(
            roleta_id, 
            roleta_nome, 
            id_numerico
          );
          
          // Se encontrou números, formatar e adicionar ao array de resultado
          if (numerosEncontrados && numerosEncontrados.length > 0) {
            const roletaInfo = {
              id: roleta_id,
              nome: roleta_nome,
              provider: roletaMetadata.provider || 'Desconhecido',
              status: roletaMetadata.status || 'online'
            };
            
            const formattedData = this.formatRouletteEvent(roletaInfo, numerosEncontrados).data;
            
            if (formattedData) {
              allRouletteData.push(formattedData);
            }
          }
        } catch (err) {
          console.error(`[RouletteData] Erro ao processar roleta ${roleta_id}:`, err);
        }
      }

      // Enviar o array completo em um único evento SSE
      if (allRouletteData.length > 0) {
        console.log(`[RouletteData] Enviando dados iniciais de ${allRouletteData.length} roletas em um único evento.`);
        
        rouletteStreamService.broadcastUpdate({
          type: 'all_roulettes_update',
          data: allRouletteData
        });
      }
      
      const endTime = Date.now();
      console.log(`[RouletteData] Carga inicial concluída em ${endTime - startTime}ms`);
      
    } catch (error) {
      console.error('[RouletteData] Erro ao buscar/processar dados iniciais:', error);
    }
  }

  /**
   * Formata os dados da roleta e seus números para o evento SSE
   * @param {Object} roleta - Objeto da roleta
   * @param {Array} numeros - Array dos últimos números
   * @returns {Object} - Objeto formatado para o evento SSE
   */
  formatRouletteEvent(roleta, numeros) {
    const ultimoNumeroObj = numeros.length > 0 ? numeros[0] : null;
    
    return {
      type: 'update',
      data: {
        id: roleta.id,
        nome: roleta.nome || 'Nome Desconhecido',
        provider: roleta.provider || 'Desconhecido', 
        status: roleta.status || 'online',
        numeros: numeros.map(n => n.numero),
        ultimoNumero: ultimoNumeroObj ? ultimoNumeroObj.numero : null,
        timestamp: ultimoNumeroObj ? 
          (ultimoNumeroObj.timestamp instanceof Date ? 
            ultimoNumeroObj.timestamp.getTime() : 
            Date.now()) 
          : Date.now(),
      }
    };
  }

  /**
   * Determina a cor de um número da roleta
   * @param {number} numero - Número da roleta
   * @returns {string} - Cor do número (vermelho, preto ou verde)
   */
  determinarCor(numero) {
    if (numero === 0) return 'verde';
    return NUMEROS_VERMELHOS.includes(numero) ? 'vermelho' : 'preto';
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastEventTime: this.lastEventTime,
      fetchCounter: this.fetchCounter,
      clientCount: rouletteStreamService.getClientCount(),
      collectionsMonitored: Array.from(this.colecoesMonitoradas),
      activeStreams: activeChangeStreams.length
    };
  }
}

// Exportar uma instância singleton do serviço
module.exports = new RouletteDataService(); 