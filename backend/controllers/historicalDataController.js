const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Mapeamento de UUIDs para IDs numéricos conhecidos
const UUID_PARA_ID_NUMERICO = {
  // Mapeamento baseado nos dados existentes
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

/**
 * Obtém o ID numérico conhecido para um UUID de roleta
 * @param {string} uuid - UUID da roleta
 * @param {string} nome - Nome da roleta (caso não encontre pelo UUID)
 * @returns {string|null} - ID numérico ou null se não encontrado
 */
const getIdNumericoPorUUID = (uuid, nome) => {
  // Verificar se o UUID já é numérico
  if (uuid && /^\d+$/.test(uuid)) {
    return uuid;
  }
  
  // Verificar diretamente no mapeamento
  if (UUID_PARA_ID_NUMERICO[uuid]) {
    return UUID_PARA_ID_NUMERICO[uuid];
  }
  
  // Se não encontrar pelo UUID, procurar pelo nome
  if (nome && NOME_PARA_ID_NUMERICO[nome]) {
    return NOME_PARA_ID_NUMERICO[nome];
  }
  
  // Tentar extrair dígitos do UUID como último recurso
  if (uuid && uuid.includes('-')) {
    const digits = uuid.replace(/\D/g, '');
    if (digits && digits.length > 0) {
      return digits.substring(0, 10);
    }
  }
  
  return null;
};

// Função auxiliar para buscar histórico de uma roleta
const fetchHistoryForRoulette = async (db, rouletteId, limit = 200) => {
    try {
        console.log(`[Histórico] Buscando histórico para roleta ${rouletteId} (limite: ${limit})`);
        
        let numerosEncontrados = null;
        let id_numerico = null;
        
        // Verificar se o ID já é numérico
        const roleta_id_eh_numerico = /^\d+$/.test(rouletteId);
        
        // CASO 1: Roleta já tem ID numérico
        if (roleta_id_eh_numerico) {
            id_numerico = rouletteId;
            console.log(`[Histórico] Roleta com ID numérico: ${id_numerico}`);
        } 
        // CASO 2: Roleta tem UUID e precisamos do mapeamento
        else {
            // Obter o nome da roleta para tentar encontrar ID numérico
            const roletaMetadata = await db.collection('metadados').findOne({ roleta_id: rouletteId.toString() });
            const roleta_nome = roletaMetadata?.roleta_nome || '';
            
            // Obter ID numérico mapeado para esta roleta
            id_numerico = getIdNumericoPorUUID(rouletteId, roleta_nome);
            
            if (id_numerico) {
                console.log(`[Histórico] Usando mapeamento: ${roleta_nome} (${rouletteId}) -> ID numérico: ${id_numerico}`);
            } else {
                console.log(`[Histórico] Nenhum mapeamento encontrado para: ${roleta_nome} (${rouletteId})`);
            }
        }
        
        // Obter lista de todas as coleções numéricas disponíveis
        const todasColecoes = await db.listCollections().toArray();
        const colecoesNumericas = todasColecoes
          .filter(col => /^\d+$/.test(col.name))
          .map(col => col.name);
        
        // Estratégia 1: Verificar se existe a coleção com ID numérico
        if (id_numerico && colecoesNumericas.includes(id_numerico)) {
            console.log(`[Histórico] Buscando na coleção numérica ${id_numerico}`);
            
            numerosEncontrados = await db.collection(id_numerico)
                .find({})
                .sort({ timestamp: -1 })
                .limit(limit)
                .project({ _id: 0, numero: 1, timestamp: 1 })
                .toArray();
                
            if (numerosEncontrados && numerosEncontrados.length > 0) {
                console.log(`[Histórico] Encontrados ${numerosEncontrados.length} números na coleção ${id_numerico}`);
                return numerosEncontrados;
            }
        }
        
        // Estratégia 2: Se roleta não tiver ID numérico ou coleção numérica vazia, tentar UUID original
        if (!roleta_id_eh_numerico) {
            // Verificar se a coleção UUID existe
            const collections = await db.listCollections({name: rouletteId}).toArray();
            
            if (collections.length > 0) {
                console.log(`[Histórico] Buscando na coleção UUID original ${rouletteId}`);
                
                numerosEncontrados = await db.collection(rouletteId)
                    .find({})
                    .sort({ timestamp: -1 })
                    .limit(limit)
                    .project({ _id: 0, numero: 1, timestamp: 1 })
                    .toArray();
                    
                if (numerosEncontrados && numerosEncontrados.length > 0) {
                    console.log(`[Histórico] Encontrados ${numerosEncontrados.length} números na coleção UUID`);
                    return numerosEncontrados;
                }
            }
        }
        
        // Estratégia 3: Buscar na coleção comum 'roleta_numeros'
        console.log(`[Histórico] Buscando na coleção comum 'roleta_numeros' para roleta ${rouletteId}`);
        
        // Queries a serem tentadas, em ordem de prioridade
        const queries = [];
        
        // 1. Tentar com ID numérico (se disponível)
        if (id_numerico) {
            queries.push({ roleta_id: id_numerico });
        }
        
        // 2. Tentar com UUID original (se não for numérico)
        if (!roleta_id_eh_numerico) {
            queries.push({ roleta_id: rouletteId.toString() });
        }
        
        // 3. Tentar com ObjectId (caso seja um ObjectId válido)
        if (ObjectId.isValid(rouletteId)) {
            queries.push({ roleta_id: new ObjectId(rouletteId).toString() });
        }
        
        // Tentar cada query em sequência
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            const queryDesc = JSON.stringify(query);
            
            console.log(`[Histórico] Tentando query ${i+1}/${queries.length}: ${queryDesc}`);
            
            const numerosQuery = await db.collection('roleta_numeros')
                .find(query)
                .sort({ timestamp: -1 })
                .limit(limit)
                .project({ _id: 0, numero: 1, timestamp: 1 })
                .toArray();
                
            if (numerosQuery && numerosQuery.length > 0) {
                console.log(`[Histórico] Encontrados ${numerosQuery.length} números na coleção comum com query ${queryDesc}`);
                return numerosQuery;
            }
        }
        
        // Se chegou aqui, não encontrou em nenhuma das estratégias
        console.log(`[Histórico] Nenhum número encontrado para roleta ${rouletteId}`);
        return [];
    } catch (error) {
        console.error(`[Histórico] Erro ao buscar histórico para roleta ${rouletteId}:`, error);
        return []; // Retorna array vazio em caso de erro para não quebrar a agregação
    }
};

/**
 * @description Busca os últimos N números históricos (padrão 200) para todas as roletas ativas.
 *              Ideal para pré-carregamento inicial no frontend.
 * @route GET /api/historical/all-roulettes
 */
const getAllRoulettesInitialHistory = async (req, res) => {
    console.log('[Histórico] Requisição recebida para /api/historical/all-roulettes');
    const HISTORY_LIMIT = 200; // Definir o limite mínimo de números por roleta

    try {
        const db = await getDb();
        console.log('[Histórico] Conexão DB obtida:', db ? `Database: ${db.databaseName}` : 'DB NULO/Inválido');

        if (!db) {
             throw new Error('Falha ao obter conexão com o banco de dados a partir de getDb()');
        }

        // 1. Buscar todas as roletas ativas a partir da coleção metadados
        const roletasMetadados = await db.collection('metadados').find({
            ativa: true
        }).toArray();
        
        console.log(`[Histórico] Encontradas ${roletasMetadados?.length || 0} roletas ativas na coleção metadados`);
        
        if (!roletasMetadados || roletasMetadados.length === 0) {
            // Fallback: Buscar todas as roletas distintas na coleção 'roleta_numeros'
            console.log(`[Histórico] Nenhuma roleta na coleção metadados. Buscando roletas distintas na coleção 'roleta_numeros'...`);
            
            const allRoulettes = await db.collection('roleta_numeros').aggregate([
                { $sort: { timestamp: -1 } }, 
                { $group: { 
                    _id: '$roleta_id', 
                    name: { $first: '$roleta_nome' }
                }},
                { $project: { 
                    _id: 1,
                    name: 1 
                }}
              ]).toArray();
            
            console.log('[Histórico] Resultado da busca por roletas distintas:', JSON.stringify(allRoulettes));

            if (!allRoulettes || allRoulettes.length === 0) {
                console.warn('[Histórico] Nenhuma roleta distinta encontrada. Retornando erro 404.');
                return res.status(404).json({
                    success: false,
                    message: 'Nenhuma roleta encontrada.'
                });
            }
            
            // 2. Para cada roleta encontrada, buscar seu histórico em paralelo
            const historyPromises = allRoulettes.map(roulette =>
                fetchHistoryForRoulette(db, roulette._id, HISTORY_LIMIT)
                    .then(history => ({
                        name: roulette.name,
                        history: history
                    }))
            );
            
            // 3. Aguardar todas as buscas de histórico
            const results = await Promise.all(historyPromises);
            
            // 4. Estruturar a resposta final { rouletteName: historyArray }
            const responseData = results.reduce((acc, current) => {
                if (current.name) {
                    acc[current.name] = current.history;
                }
                return acc;
            }, {});
            
            // 5. Retornar os dados agregados
            console.log('[Histórico] Enviando resposta com sucesso (via fallback).');
            return res.json({
                success: true,
                data: responseData,
                message: `Histórico inicial de ${results.length} roletas carregado.`
            });
        }
        
        // 2. Para cada roleta da coleção metadados, buscar seu histórico em paralelo
        const historyPromises = roletasMetadados.map(roleta =>
            fetchHistoryForRoulette(db, roleta.roleta_id, HISTORY_LIMIT)
                .then(history => ({
                    name: roleta.roleta_nome,
                    history: history
                }))
        );
        
        // 3. Aguardar todas as buscas de histórico
        const results = await Promise.all(historyPromises);
        
        // 4. Estruturar a resposta final { rouletteName: historyArray }
        const responseData = results.reduce((acc, current) => {
            if (current.name) {
                acc[current.name] = current.history;
            }
            return acc;
        }, {});
        
        // 5. Retornar os dados agregados
        console.log('[Histórico] Enviando resposta com sucesso.');
        return res.json({
            success: true,
            data: responseData,
            message: `Histórico inicial de ${results.length} roletas carregado.`
        });

    } catch (error) {
        console.error('[Histórico] Erro DENTRO de getAllRoulettesInitialHistory:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao buscar histórico das roletas.',
            error: error.message || error.toString()
        });
    }
};

module.exports = {
    getAllRoulettesInitialHistory,
}; 