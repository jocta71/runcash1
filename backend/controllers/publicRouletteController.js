/**
 * Controlador para API pública de roletas com dados criptografados
 * Os dados são criptografados usando @hapi/iron para garantir que só podem ser decodificados pelo frontend oficial
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');
const Iron = require('@hapi/iron');

// Chave de criptografia para os dados - IMPORTANTE: em produção, usar variável de ambiente
const ENCRYPTION_KEY = process.env.IRON_ENCRYPTION_KEY || 'CwRS4tDa5uY7Bz9E0fGhJmNpQrStVxYz';

/**
 * Função auxiliar para obter cor do número na roleta
 */
function getNumberColor(number) {
  if (number === 0 || number === '0') return 'green';
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(parseInt(number)) ? 'red' : 'black';
}

/**
 * Lista todas as roletas disponíveis - dados criptografados
 * Esta rota é pública, mas os dados estão criptografados
 */
exports.getPublicRoulettes = async (req, res) => {
  try {
    console.log('[API] Solicitação de roletas públicas criptografadas');
    
    // Obter conexão com o banco de dados
    const db = await getDb();
    
    // Buscar todas as roletas
    const roulettes = await db.collection('roulettes').find({}).toArray();
    
    // Preparar dados para envio
    const publicData = {
      roulettes: roulettes.map(roulette => ({
        id: roulette._id.toString(),
        name: roulette.name || roulette.nome,
        provider: roulette.provider || roulette.provedor,
        updated: new Date()
      })),
      timestamp: new Date(),
      ttl: 60 // Tempo de vida em segundos
    };
    
    // Criptografar dados com Iron
    const sealOptions = {
      ttl: 60 * 1000 // Tempo de vida do token em milissegundos (60 segundos)
    };
    
    const encryptedData = await Iron.seal(publicData, ENCRYPTION_KEY, Iron.defaults);
    
    // Enviar dados criptografados
    return res.json({
      success: true,
      data: encryptedData
    });
  } catch (error) {
    console.error('Erro ao obter lista de roletas públicas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter lista de roletas',
      error: error.message
    });
  }
};

/**
 * Obtém dados de uma roleta específica - dados criptografados
 * Esta rota é pública, mas os dados estão criptografados
 */
exports.getPublicRouletteData = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    console.log(`[API] Solicitação de dados da roleta ${rouletteId} (criptografados)`);
    
    // Obter conexão com o banco de dados
    const db = await getDb();
    
    // Buscar roleta pelo ID
    const roulette = await db.collection('roulettes').findOne({
      $or: [
        { _id: ObjectId.isValid(rouletteId) ? new ObjectId(rouletteId) : null },
        { id: rouletteId }
      ]
    });
    
    if (!roulette) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada'
      });
    }
    
    // Buscar números recentes da roleta
    const recentNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Preparar dados para envio
    const publicData = {
      id: roulette._id.toString(),
      name: roulette.name || roulette.nome,
      provider: roulette.provider || roulette.provedor,
      numbers: recentNumbers.map(n => ({
        number: n.number,
        timestamp: n.timestamp,
        color: getNumberColor(n.number)
      })),
      timestamp: new Date(),
      ttl: 60 // Tempo de vida em segundos
    };
    
    // Criptografar dados com Iron
    const sealOptions = {
      ttl: 60 * 1000 // Tempo de vida do token em milissegundos (60 segundos)
    };
    
    const encryptedData = await Iron.seal(publicData, ENCRYPTION_KEY, Iron.defaults);
    
    // Enviar dados criptografados
    return res.json({
      success: true,
      data: encryptedData
    });
  } catch (error) {
    console.error('Erro ao obter dados da roleta pública:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados da roleta',
      error: error.message
    });
  }
};

/**
 * Lista os últimos números de todas as roletas - dados criptografados
 * Endpoint usado para dados em tempo real
 */
exports.getPublicLatestNumbers = async (req, res) => {
  try {
    console.log('[API] Solicitação dos últimos números em tempo real (criptografados)');
    
    // Obter conexão com o banco de dados
    const db = await getDb();
    
    // Buscar todas as roletas
    const roulettes = await db.collection('roulettes').find({}).toArray();
    
    // Para cada roleta, buscar os últimos números
    const rouletteData = await Promise.all(
      roulettes.map(async (roulette) => {
        const latestNumbers = await db.collection('roulette_numbers')
          .find({ rouletteId: roulette._id.toString() })
          .sort({ timestamp: -1 })
          .limit(10)
          .toArray();
          
        return {
          id: roulette._id.toString(),
          name: roulette.name || roulette.nome,
          latestNumber: latestNumbers.length > 0 ? {
            number: latestNumbers[0].number,
            color: getNumberColor(latestNumbers[0].number),
            timestamp: latestNumbers[0].timestamp
          } : null,
          recentNumbers: latestNumbers.map(n => ({
            number: n.number,
            color: getNumberColor(n.number),
            timestamp: n.timestamp
          }))
        };
      })
    );
    
    // Preparar dados para envio
    const publicData = {
      roulettes: rouletteData,
      timestamp: new Date(),
      ttl: 10 // Tempo de vida em segundos (curto para dados em tempo real)
    };
    
    // Criptografar dados com Iron
    const sealOptions = {
      ttl: 10 * 1000 // Tempo de vida do token em milissegundos (10 segundos)
    };
    
    const encryptedData = await Iron.seal(publicData, ENCRYPTION_KEY, Iron.defaults);
    
    // Enviar dados criptografados
    return res.json({
      success: true,
      data: encryptedData
    });
  } catch (error) {
    console.error('Erro ao obter últimos números de roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter últimos números de roletas',
      error: error.message
    });
  }
}; 