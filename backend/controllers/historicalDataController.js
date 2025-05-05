const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Função auxiliar para buscar histórico de uma roleta
const fetchHistoryForRoulette = async (db, rouletteId, limit = 200) => {
    try {
        return await db.collection('roulette_numbers')
            .find({ rouletteId: rouletteId.toString() })
            .sort({ timestamp: -1 })
            .limit(limit)
            .project({ _id: 0, numero: '$number', timestamp: 1 }) // Renomeia 'number' para 'numero' e seleciona campos
            .toArray();
    } catch (error) {
        console.error(`Erro ao buscar histórico para roleta ${rouletteId}:`, error);
        return []; // Retorna array vazio em caso de erro para não quebrar a agregação
    }
};

/**
 * @description Busca os últimos N números históricos (padrão 200) para todas as roletas ativas.
 *              Ideal para pré-carregamento inicial no frontend.
 * @route GET /api/historical/all-roulettes
 */
const getAllRoulettesInitialHistory = async (req, res) => {
    console.log('[Histórico] Requisição recebida para /api/historical/all-roulettes'); // Log 1: Função chamada
    const HISTORY_LIMIT = 200; // Definir o limite mínimo de números por roleta

    try {
        const db = await getDb();
        console.log('[Histórico] Conexão DB obtida:', db ? `Database: ${db.databaseName}` : 'DB NULO/Inválido'); // Log 2: Verificar objeto DB

        if (!db) {
             throw new Error('Falha ao obter conexão com o banco de dados a partir de getDb()');
        }

        // 1. Buscar todas as roletas ativas
        console.log(`[Histórico] Buscando roletas na coleção 'roulettes'...`);
        const allRoulettes = await db.collection('roulettes')
            .find({}, { projection: { _id: 1, name: 1 } }) // Buscar apenas _id e name
            .toArray();
        
        console.log('[Histórico] Resultado da busca por roletas:', JSON.stringify(allRoulettes)); // Log 3: Resultado direto da busca

        if (!allRoulettes || allRoulettes.length === 0) {
            console.warn('[Histórico] Nenhuma roleta encontrada na coleção \'roulettes\'. Retornando erro 404.'); // Log 4: Condição atingida
            return res.status(404).json({
                success: false,
                message: 'Nenhuma roleta encontrada.'
            });
        }

        console.log(`[Histórico] Encontradas ${allRoulettes.length} roletas. Buscando histórico para cada uma...`);
        // 2. Para cada roleta, buscar seu histórico em paralelo
        const historyPromises = allRoulettes.map(roulette =>
            fetchHistoryForRoulette(db, roulette._id, HISTORY_LIMIT)
                .then(history => ({
                    name: roulette.name, // Usar o nome da roleta como chave
                    history: history
                }))
        );

        // 3. Aguardar todas as buscas de histórico
        const results = await Promise.all(historyPromises);

        // 4. Estruturar a resposta final { rouletteName: historyArray }
        const responseData = results.reduce((acc, current) => {
            // Garante que a chave seja o nome da roleta e o valor seja o array de histórico
            acc[current.name] = current.history;
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
        console.error('[Histórico] Erro DENTRO de getAllRoulettesInitialHistory:', error); // Log 5: Erro no catch
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