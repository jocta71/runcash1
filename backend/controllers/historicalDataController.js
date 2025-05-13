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
  "ec79f914-5261-e90b-45cc-ebe65b0c96a2": "2010143", // Ruleta Relámpago en Vivo
  "eabd279d-90cf-74f7-c080-a2240dca6517": "2010565", // Gold Vault Roulette
  "c4b2e581-2699-3705-490d-9b89fe85c16a": "2010045", // Ruleta en Vivo
  "18bdc4ea-d884-c47a-d33f-27a268a4eead": "2010096", // Speed Auto Roulette
  "a0f21bd0-6156-1c4e-b05c-b630ce563fbb": "2380038", // Roulette Macao
  "1dfb0fcd-76dd-2fe9-27fe-fe35c87cd4a4": "2010059", // Bucharest Roulette
  "e3345af9-e387-9412-209c-e793fe73e520": "2010065", // Bucharest Auto-Roulette
  "4cf27e48-2b9d-b58e-7dcc-48264c51d639": "2010016", // Immersive Roulette
  "1c34d1e0-6d96-6f5b-3c53-bc6852bf9fd8": "2010170", // Lightning Roulette Italia
  "96a31ffc-7c6e-3980-395c-aa163c6d5759": "2380032", // Russian Roulette
  "419aa56c-bcff-67d2-f424-a6501bac4a36": "2010098", // Auto-Roulette VIP
  "278b90ba-c190-f5ac-e214-c40b1474e9f7": "2010033", // Lightning Roulette
  "a92e8f3b-665f-aec7-5e07-a8ef91818cda": "2380346", // VIP Auto Roulette
  "bc007d81-eb92-96a5-573c-2a2ee28c2fd7": "2380064", // Roulette 1
  "1b4131a6-307a-6a64-974d-d03b2d107002": "2380373", // Fortune Roulette
  "206f0db9-84b9-888a-8b4c-f3b1b2b5c4da": "2380049", // Mega Roulette
  "fe79694c-6212-6ae6-47ad-0593c35ded71": "2380034", // Roulette Italia Tricolore
  "1920129d-760a-1755-c393-03d05c9de118": "2010336", // Türkçe Lightning Rulet
  "8663c411-e6af-e341-3854-b163e3d349a3": "2380039", // Turkish Roulette
  "afc07eb8-a37c-48af-c6ff-5de999e1871b": "2380159", // Romanian Roulette
  "14f70979-2311-5460-1fec-b722322d353e": "2380010", // Speed Roulette 1
  "2cc41e23-fb04-2926-77d5-d55831e97bab": "2010048", // Dansk Roulette
  "7d3c2c9f-2850-f642-861f-5bb4daf1806a": "2380335", // Brazilian Mega Roulette
  "f27dd03e-5282-fc78-961c-6375cef91565": "2010017", // Ruleta Automática
  "5403e259-2f6c-cd2d-324c-63f0a00dee05": "2010031", // Jawhara Roulette
};

// Mapeamento de nomes para IDs numéricos (backup)
const NOME_PARA_ID_NUMERICO = {
  "Deutsches Roulette": "2010011",
  "American Roulette": "2010012",
  "Immersive Roulette": "2010016",
  "Ruleta Automática": "2010017",
  "Jawhara Roulette": "2010031",
  "Lightning Roulette": "2010033",
  "Ruleta en Vivo": "2010045",
  "Dansk Roulette": "2010048",
  "Ruletka Live": "2010049",
  "Bucharest Roulette": "2010059",
  "Bucharest Auto-Roulette": "2010065",
  "Speed Auto Roulette": "2010096",
  "VIP Roulette": "2010097",
  "Auto-Roulette VIP": "2010098",
  "Football Studio Roulette": "2010099",
  "Venezia Roulette": "2010100",
  "Türkçe Rulet": "2010106",
  "Dragonara Roulette": "2010108",
  "Hippodrome Grand Casino": "2010110",
  "Ruleta Relámpago en Vivo": "2010143",
  "Roulette": "2010165",
  "Lightning Roulette Italia": "2010170",
  "Türkçe Lightning Rulet": "2010336",
  "XXXtreme Lightning Roulette": "2010440",
  "Gold Vault Roulette": "2010565",
  "Speed Roulette 1": "2380010",
  "Russian Roulette": "2380032",
  "German Roulette": "2380033",
  "Roulette Italia Tricolore": "2380034",
  "Roulette Macao": "2380038",
  "Turkish Roulette": "2380039",
  "Mega Roulette": "2380049",
  "Roulette 1": "2380064",
  "VIP Roulette": "2380117",
  "Romanian Roulette": "2380159",
  "Brazilian Mega Roulette": "2380335",
  "VIP Auto Roulette": "2380346",
  "Fortune Roulette": "2380373",
  "Immersive Roulette Deluxe": "2380390"
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
const fetchHistoryForRoulette = async (db, roletasDb, rouletteId, limit = 200) => {
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
        
        // ESTRATÉGIA 1: Buscar diretamente na coleção específica da roleta no roletas_db
        if (roletasDb) {
            console.log(`[Histórico] Conectado ao banco de dados roletas_db`);
            
            let colecaoId = id_numerico || rouletteId;
            
            try {
                // Verificar se a coleção existe
                const collections = await roletasDb.listCollections({name: colecaoId}).toArray();
                
                if (collections.length > 0) {
                    console.log(`[Histórico] Buscando na coleção específica ${colecaoId} no roletas_db`);
                    
                    numerosEncontrados = await roletasDb.collection(colecaoId)
                        .find({})
                        .sort({ timestamp: -1 })
                        .limit(limit)
                        .project({ _id: 0, numero: 1, timestamp: 1 })
                        .toArray();
                        
                    if (numerosEncontrados && numerosEncontrados.length > 0) {
                        console.log(`[Histórico] Encontrados ${numerosEncontrados.length} números na coleção específica no roletas_db`);
                        return numerosEncontrados;
                    }
                }
            } catch (error) {
                console.error(`[Histórico] Erro ao buscar na coleção específica do roletas_db:`, error);
            }
        } else {
            console.log(`[Histórico] Não foi possível conectar ao banco de dados roletas_db, usando estratégias alternativas`);
        }
        
        // Se não encontrou no roletas_db, continuar com as estratégias originais
        // Obter lista de todas as coleções numéricas disponíveis
        const todasColecoes = await db.listCollections().toArray();
        const colecoesNumericas = todasColecoes
          .filter(col => /^\d+$/.test(col.name))
          .map(col => col.name);
        
        // Estratégia 2: Verificar se existe a coleção com ID numérico no banco principal
        if (id_numerico && colecoesNumericas.includes(id_numerico)) {
            console.log(`[Histórico] Buscando na coleção numérica ${id_numerico} do banco principal`);
            
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
        
        // Estratégia 3: Se roleta não tiver ID numérico ou coleção numérica vazia, tentar UUID original
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
        
        // Estratégia 4: Buscar na coleção comum 'roleta_numeros'
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
        // Tentar obter conexão com o banco de dados de roletas primeiro
        let roletasDb = await getDb('roletas_db');
        let db = await getDb(); // Banco principal como fallback
        
        let usandoRoletasDb = !!roletasDb;
        
        if (usandoRoletasDb) {
            console.log('[Histórico] Usando banco de dados roletas_db');
        } else {
            console.log('[Histórico] Banco roletas_db não disponível, usando apenas o banco principal');
        }

        console.log('[Histórico] Conexão DB obtida:', db ? `Database: ${db.databaseName}` : 'DB NULO/Inválido');

        if (!db) {
             throw new Error('Falha ao obter conexão com o banco de dados a partir de getDb()');
        }

        // Lista para armazenar as roletas encontradas
        let roletasEncontradas = [];
        
        if (usandoRoletasDb) {
            // 1. Buscar metadados de roletas no roletas_db
            if (await roletasDb.collection('metadados').countDocuments({}) > 0) {
                console.log('[Histórico] Buscando roletas na coleção metadados do roletas_db');
                roletasEncontradas = await roletasDb.collection('metadados').find({
                    ativa: true
                }).toArray();
            } else {
                // 2. Se não há metadados, listar todas as coleções exceto as de sistema
                console.log('[Histórico] Metadados não encontrados, listando coleções do roletas_db');
                const collections = await roletasDb.listCollections().toArray();
                
                // Filtrar coleções de sistema e metadados
                const roletaCollections = collections.filter(col => 
                    !col.name.startsWith('system.') && 
                    !['metadados', 'estatisticas'].includes(col.name));
                
                roletasEncontradas = roletaCollections.map(col => ({
                    roleta_id: col.name,
                    roleta_nome: `Roleta ${col.name}`,
                    colecao: col.name,
                    ativa: true
                }));
            }
        } else {
            // Fallback para banco principal: Buscar roletas na coleção metadados
            roletasEncontradas = await db.collection('metadados').find({
                ativa: true
            }).toArray();
        }
        
        console.log(`[Histórico] Encontradas ${roletasEncontradas?.length || 0} roletas ativas`);
        
        if (!roletasEncontradas || roletasEncontradas.length === 0) {
            // Fallback final: Buscar todas as roletas distintas na coleção 'roleta_numeros'
            console.log(`[Histórico] Nenhuma roleta encontrada. Buscando roletas distintas na coleção 'roleta_numeros'...`);
            
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
                fetchHistoryForRoulette(db, roletasDb, roulette._id, HISTORY_LIMIT)
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
        
        // 2. Para cada roleta encontrada, buscar seu histórico em paralelo
        const historyPromises = roletasEncontradas.map(roleta =>
            fetchHistoryForRoulette(db, roletasDb, roleta.roleta_id || roleta.colecao, HISTORY_LIMIT)
                .then(history => ({
                    name: roleta.roleta_nome || roleta.nome || `Roleta ${roleta.roleta_id || roleta.colecao}`,
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