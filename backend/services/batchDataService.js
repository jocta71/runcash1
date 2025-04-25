/**
 * Serviço para carregamento de dados em lotes
 * Implementa estratégias de carregamento eficiente para grandes volumes de dados
 */

const getDb = require('./database');
const { ObjectId } = require('mongodb');

// Cache em memória para armazenar resultados de consultas recentes
const dataCache = new Map();
const CACHE_TTL = 60000; // 1 minuto

/**
 * Carrega dados de roletas em lotes, usando várias otimizações
 * @param {Object} options Opções de carregamento
 * @returns {Promise<Object>} Dados e metadados
 */
async function loadRoulettesInBatches(options = {}) {
  try {
    const {
      limit = 200,
      page = 0,
      roletaId = null,
      skipCache = false,
      format = 'full' // full, compact, minimal
    } = options;

    // Gerar chave de cache
    const cacheKey = `roulette_batch_${roletaId || 'all'}_${limit}_${page}_${format}`;
    
    // Verificar cache, se não for explicitamente ignorado
    if (!skipCache) {
      const cachedData = dataCache.get(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
        return cachedData.data;
      }
    }

    // Conectar ao banco de dados
    const db = await getDb();
    const collection = db.collection('roulette_numbers');
    
    // Criar filtro base
    const filter = roletaId ? { roleta_id: roletaId } : {};
    
    // Configurar pipeline de agregação
    const pipeline = [
      { $match: filter },
      { $sort: { timestamp: -1 } }
    ];
    
    // Adicionar paginação
    const skip = page * limit;
    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }
    
    pipeline.push({ $limit: limit });
    
    // Configurar projeção com base no formato solicitado
    if (format === 'minimal') {
      // Apenas dados essenciais, com nomes curtos para economia de banda
      pipeline.push({
        $project: {
          _id: 0,
          r: "$roleta_id",
          n: "$numero",
          t: "$timestamp"
        }
      });
    } else if (format === 'compact') {
      // Versão compacta, mas com dados suficientes
      pipeline.push({
        $project: {
          _id: 0,
          r: "$roleta_id",
          n: "$roleta_nome",
          v: "$numero",
          c: "$cor",
          t: "$timestamp"
        }
      });
    } else {
      // Versão completa
      pipeline.push({
        $project: {
          _id: 0,
          roleta_id: 1,
          roleta_nome: 1,
          numero: 1,
          cor: 1,
          timestamp: 1
        }
      });
    }
    
    // Executar consulta
    const results = await collection.aggregate(pipeline).toArray();
    
    // Obter contagem total para metadados
    const totalCount = await collection.countDocuments(filter);
    
    // Montar resposta
    const response = {
      data: results,
      metadata: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
        hasMore: (page + 1) * limit < totalCount,
        format
      }
    };
    
    // Armazenar no cache
    dataCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });
    
    return response;
  } catch (error) {
    console.error('Erro ao carregar dados em lotes:', error);
    throw error;
  }
}

/**
 * Carrega todas as roletas disponíveis no sistema
 * @param {Boolean} includeStatus Se true, inclui status atual
 * @returns {Promise<Array>} Lista de roletas
 */
async function getAllRoulettes(includeStatus = false) {
  try {
    const cacheKey = `all_roulettes_${includeStatus}`;
    
    // Verificar cache
    const cachedData = dataCache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      return cachedData.data;
    }
    
    // Conectar ao banco de dados
    const db = await getDb();
    const collection = db.collection('roulette_numbers');
    
    // Buscar roletas únicas
    const roletas = await collection.aggregate([
      { 
        $group: { 
          _id: "$roleta_id", 
          nome: { $first: "$roleta_nome" },
          ultimaAtualizacao: { $max: "$timestamp" } 
        } 
      },
      { 
        $project: { 
          _id: 0, 
          id: "$_id", 
          nome: 1,
          ultimaAtualizacao: 1
        } 
      },
      { $sort: { nome: 1 } }
    ]).toArray();
    
    // Se solicitado, incluir status atual
    if (includeStatus) {
      // Buscar último número para cada roleta
      const statusPromises = roletas.map(async (roleta) => {
        const ultimoNumero = await collection.findOne(
          { roleta_id: roleta.id },
          { sort: { timestamp: -1 }, projection: { _id: 0, numero: 1, timestamp: 1 } }
        );
        
        return {
          ...roleta,
          ultimoNumero: ultimoNumero?.numero || null,
          online: new Date(roleta.ultimaAtualizacao).getTime() > (Date.now() - 1000 * 60 * 5) // Online se atualizado nos últimos 5 minutos
        };
      });
      
      const roletasComStatus = await Promise.all(statusPromises);
      
      // Armazenar no cache
      dataCache.set(cacheKey, {
        data: roletasComStatus,
        timestamp: Date.now()
      });
      
      return roletasComStatus;
    }
    
    // Armazenar no cache
    dataCache.set(cacheKey, {
      data: roletas,
      timestamp: Date.now()
    });
    
    return roletas;
  } catch (error) {
    console.error('Erro ao buscar todas as roletas:', error);
    throw error;
  }
}

/**
 * Limpa todo o cache do serviço
 */
function clearCache() {
  dataCache.clear();
  return { success: true, message: 'Cache limpo com sucesso' };
}

module.exports = {
  loadRoulettesInBatches,
  getAllRoulettes,
  clearCache
}; 