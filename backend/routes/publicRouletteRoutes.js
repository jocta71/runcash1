/**
 * Rotas públicas para dados de roletas com resposta criptografada
 * Este arquivo implementa as rotas de roletas públicas que retornam dados criptografados
 */

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const { encryptResponseData } = require('../middlewares/encryptedDataMiddleware');
const { v4: uuidv4 } = require('uuid');

// Configuração do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

let client = null;
let db = null;
let collection = null;

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    if (!client) {
      console.log('[API] Tentando conectar ao MongoDB...');
      client = new MongoClient(url);
      await client.connect();
      console.log('[API] Conectado ao MongoDB com sucesso');
      
      db = client.db(dbName);
      collection = db.collection('numeros_roleta');
    }
    return true;
  } catch (error) {
    console.error('[API] Erro ao conectar ao MongoDB:', error);
    return false;
  }
}

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis com os últimos números (formato similar ao concorrente)
 * @access  Público
 */
router.get('/roulettes', encryptResponseData, async (req, res) => {
  try {
    console.log(`[API] Acesso à rota pública /api/roulettes sem necessidade de autenticação`);
    
    // Garantir que estamos conectados ao MongoDB
    const isConnected = await connectToMongoDB();
    
    if (!isConnected || !collection) {
      console.error('[API] MongoDB não conectado, retornando array vazio');
      return res.json([]);
    }
    
    // Obter roletas únicas da coleção
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[API] Processadas ${roulettes.length} roletas (endpoint público)`);
    
    // Para cada roleta, buscar os últimos números (limitado a 20 por roleta)
    const roletasCompletas = await Promise.all(roulettes.map(async (roleta) => {
      const numeros = await collection
        .find({ roleta_id: roleta.id })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();
      
      // Formatar no estilo solicitado pelo cliente
      return {
        id: uuidv4(), // Gerando UUID semelhante ao concorrente
        nome: roleta.nome,
        ativa: true,
        numero: numeros.map(n => ({
          numero: n.numero,
          roleta_id: n.roleta_id,
          roleta_nome: n.roleta_nome,
          cor: n.cor,
          timestamp: n.timestamp
        }))
      };
    }));
    
    // Retornar dados
    return res.json(roletasCompletas);
  } catch (error) {
    console.error('[API] Erro ao listar roletas:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Erro interno ao buscar roletas',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/roulettes/:id
 * @desc    Obtém dados de uma roleta específica
 * @access  Público
 */
router.get('/roulettes/:id', encryptResponseData, async (req, res) => {
  try {
    // Garantir que estamos conectados ao MongoDB
    const isConnected = await connectToMongoDB();
    
    if (!isConnected || !collection) {
      console.error('[API] MongoDB não conectado');
      return res.status(503).json({ 
        success: false, 
        message: 'Serviço indisponível: sem conexão com MongoDB' 
      });
    }
    
    const roletaId = req.params.id;
    
    // Buscar informações da roleta
    const roleta = await db.collection('roletas').findOne({ id: roletaId });
    
    if (!roleta) {
      return res.status(404).json({ 
        success: false, 
        message: 'Roleta não encontrada' 
      });
    }
    
    // Buscar últimos números da roleta
    const numeros = await collection
      .find({ roleta_id: roletaId })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    
    // Formatar resposta no novo estilo
    const resposta = {
      id: uuidv4(),
      nome: roleta.nome,
      ativa: true,
      numero: numeros.map(n => ({
        numero: n.numero,
        roleta_id: n.roleta_id,
        roleta_nome: n.roleta_nome,
        cor: n.cor,
        timestamp: n.timestamp
      }))
    };
    
    // Retornar dados
    return res.json(resposta);
  } catch (error) {
    console.error('[API] Erro ao buscar dados da roleta:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Erro interno ao buscar dados da roleta',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/roulettes/:id/numbers
 * @desc    Obtém os últimos números de uma roleta específica
 * @access  Público
 */
router.get('/roulettes/:id/numbers', encryptResponseData, async (req, res) => {
  try {
    // Garantir que estamos conectados ao MongoDB
    const isConnected = await connectToMongoDB();
    
    if (!isConnected || !collection) {
      console.error('[API] MongoDB não conectado');
      return res.status(503).json({ 
        success: false, 
        message: 'Serviço indisponível: sem conexão com MongoDB' 
      });
    }
    
    const roletaId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    
    // Buscar números da roleta
    const numeros = await collection
      .find({ roleta_id: roletaId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    // Formatar resposta
    const resposta = {
      roleta_id: roletaId,
      numeros: numeros.map(n => ({
        numero: n.numero,
        timestamp: n.timestamp,
        cor: n.cor,
        roleta_id: n.roleta_id,
        roleta_nome: n.roleta_nome
      })),
      total: numeros.length
    };
    
    // Retornar dados (serão criptografados pelo middleware)
    return res.json(resposta);
  } catch (error) {
    console.error('[API] Erro ao buscar números da roleta:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Erro interno ao buscar números da roleta',
      error: error.message
    });
  }
});

// Função para determinar a cor de um número de roleta
function determinarCor(numero) {
  if (numero === 0) return 'verde';
  
  const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return vermelhos.includes(numero) ? 'vermelho' : 'preto';
}

module.exports = router; 