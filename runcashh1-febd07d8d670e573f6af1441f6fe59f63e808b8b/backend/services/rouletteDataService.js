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

// Mapeamento de UUIDs para IDs numéricos conhecidos
const UUID_PARA_ID_NUMERICO = {
  // Mapeamento principal baseado nos logs e arquivos existentes
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
};

// Mapeamento de nomes para IDs numéricos (backup)
const NOME_PARA_ID_NUMERICO = {
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

  /**
   * Obtém o ID numérico conhecido para um UUID de roleta
   * @param {string} uuid - UUID da roleta
   * @param {string} nome - Nome da roleta (caso não encontre pelo UUID)
   * @returns {string|null} - ID numérico ou null se não encontrado
   */
  getIdNumericoPorUUID(uuid, nome) {
    // Verificar diretamente no mapeamento
    if (UUID_PARA_ID_NUMERICO[uuid]) {
      return UUID_PARA_ID_NUMERICO[uuid];
    }
    
    // Se não encontrar pelo UUID, procurar pelo nome
    if (nome && NOME_PARA_ID_NUMERICO[nome]) {
      return NOME_PARA_ID_NUMERICO[nome];
    }
    
    // Tentar extrair dígitos do UUID
    if (uuid && uuid.includes('-')) {
      const digits = uuid.replace(/\D/g, '');
      if (digits && digits.length > 0) {
        // Limitar tamanho para evitar problemas
        return digits.substring(0, 10);
      }
    }
    
    // Se o UUID já for numérico, retornar ele mesmo
    if (uuid && /^\d+$/.test(uuid)) {
      return uuid;
    }
    
    return null;
  }

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
      
      // Verificar se a coleção comum existe
      const colecaoComumExiste = await db.listCollections({name: 'roleta_numeros'}).toArray();
      const temColecaoComum = colecaoComumExiste.length > 0;
      
      // Obter lista de todas as coleções numéricas disponíveis
      const todasColecoes = await db.listCollections().toArray();
      const colecoesNumericas = todasColecoes
        .filter(col => /^\d+$/.test(col.name))
        .map(col => col.name);
      
      if (colecoesNumericas.length > 0) {
        console.log(`[RouletteData] Encontradas ${colecoesNumericas.length} coleções numéricas no banco de dados`);
      }
      
      // 2. Para cada roleta, buscar seus últimos 5 números
      const allRouletteData = [];
      for (const roletaMetadata of roletasMetadados) {
        const roleta_id = roletaMetadata.roleta_id;
        const roleta_nome = roletaMetadata.roleta_nome;
        
        try {
          // Verificar se a roleta já tem ID numérico
          const roleta_id_eh_numerico = /^\d+$/.test(roleta_id);
          let id_numerico = null;
          let colecao_id = null;
          let numerosEncontrados = null;
          
          // CASO 1: Roleta já tem ID numérico
          if (roleta_id_eh_numerico) {
            id_numerico = roleta_id;
            console.log(`[RouletteData] Roleta ${roleta_nome} já tem ID numérico: ${id_numerico}`);
          } 
          // CASO 2: Roleta tem UUID e precisamos do mapeamento
          else {
            // Obter ID numérico mapeado para esta roleta
            id_numerico = this.getIdNumericoPorUUID(roleta_id, roleta_nome);
            
            // Usar mapeamento direto em vez de tentar extrair ID da string
            if (id_numerico) {
              console.log(`[RouletteData] Usando mapeamento: ${roleta_nome} (${roleta_id}) -> ID numérico: ${id_numerico}`);
            } else {
              console.log(`[RouletteData] Nenhum mapeamento encontrado para: ${roleta_nome} (${roleta_id})`);
            }
          }
          
          // Estratégia 1: Verificar se existe a coleção com ID numérico (mapeado ou direto)
          if (id_numerico && colecoesNumericas.includes(id_numerico)) {
            colecao_id = id_numerico;
            console.log(`[RouletteData] Usando coleção numérica ${colecao_id} para roleta ${roleta_nome}`);
            
            // Buscar números na coleção específica
            numerosEncontrados = await db.collection(colecao_id)
              .find({})
              .sort({ timestamp: -1 })
              .limit(5)
              .toArray();
              
            if (numerosEncontrados && numerosEncontrados.length > 0) {
              console.log(`[RouletteData] Encontrados ${numerosEncontrados.length} números na coleção ${colecao_id} para roleta ${roleta_nome}`);
            } else {
              console.log(`[RouletteData] Coleção ${colecao_id} existe, mas não contém números para roleta ${roleta_nome}`);
            }
          }
          // Estratégia 2: Se roleta não tiver ID numérico ou não encontrar coleção, tentar UUID original
          else if (!roleta_id_eh_numerico) {
            // Verificar se a coleção UUID existe
            const collections = await db.listCollections({name: roleta_id}).toArray();
            
            if (collections.length > 0) {
              colecao_id = roleta_id;
              console.log(`[RouletteData] Usando coleção UUID original ${colecao_id} para roleta ${roleta_nome}`);
              
              // Buscar números na coleção específica
              numerosEncontrados = await db.collection(colecao_id)
                .find({})
                .sort({ timestamp: -1 })
                .limit(5)
                .toArray();
                
              if (numerosEncontrados && numerosEncontrados.length > 0) {
                console.log(`[RouletteData] Encontrados ${numerosEncontrados.length} números na coleção UUID para roleta ${roleta_nome}`);
              } else {
                console.log(`[RouletteData] Coleção UUID existe, mas não contém números para roleta ${roleta_nome}`);
              }
            }
          }
          
          // Estratégia 3: Tentar na coleção comum 'roleta_numeros' usando o ID como filtro
          if ((!numerosEncontrados || numerosEncontrados.length === 0) && temColecaoComum) {
            console.log(`[RouletteData] Tentando buscar na coleção comum para roleta ${roleta_nome}`);
            
            // Queries a serem tentadas, em ordem de prioridade
            const queries = [];
            
            // 1. Tentar com ID numérico (se disponível)
            if (id_numerico) {
              queries.push({ roleta_id: id_numerico });
            }
            
            // 2. Tentar com UUID original (se não for numérico)
            if (!roleta_id_eh_numerico) {
              queries.push({ roleta_id: roleta_id });
            }
            
            // 3. Tentar com nome da roleta
            queries.push({ roleta_nome: roleta_nome });
            
            // Tentar cada query em sequência
            for (let i = 0; i < queries.length; i++) {
              const query = queries[i];
              const queryDesc = JSON.stringify(query);
              
              console.log(`[RouletteData] Tentando query ${i+1}/${queries.length}: ${queryDesc}`);
              
              const numerosQuery = await db.collection('roleta_numeros')
                .find(query)
                .sort({ timestamp: -1 })
                .limit(5)
                .toArray();
                
              if (numerosQuery && numerosQuery.length > 0) {
                numerosEncontrados = numerosQuery;
                console.log(`[RouletteData] Encontrados ${numerosEncontrados.length} números na coleção comum com query ${queryDesc}`);
                break; // Sair do loop se encontrou
              }
            }
          }
          
          // Se encontrou números em qualquer uma das estratégias
          if (numerosEncontrados && numerosEncontrados.length > 0) {
            // Criar objeto da roleta
            const roletaInfo = {
              id: roleta_id,
              nome: roleta_nome,
              provider: roletaMetadata.provider || 'Desconhecido',
              status: roletaMetadata.status || 'online'
            };
            
            // Formatar dados da roleta
            const formattedEvent = this.formatRouletteEvent(roletaInfo, numerosEncontrados);
            if (formattedEvent && formattedEvent.data) {
               allRouletteData.push(formattedEvent.data);
            }
          } else {
            console.log(`[RouletteData] Nenhum número encontrado para roleta ${roleta_nome} (ID: ${roleta_id}).`);
            
            // Para depuração: verificar se a roleta com ID numérico existe mas está vazia
            if (id_numerico && colecoesNumericas.includes(id_numerico)) {
              const contagem = await db.collection(id_numerico).countDocuments();
              console.log(`[RouletteData] A coleção numérica ${id_numerico} existe mas contém apenas ${contagem} documentos`);
            }
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