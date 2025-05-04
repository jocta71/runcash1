/**
 * Rotas públicas para dados de roletas
 * Implementa system de Server-Sent Events (SSE) com criptografia
 */

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// Importar serviços
const cryptoService = require('../services/cryptoService');
const sseController = require('../controllers/sseController');

// Importar controlador existente para reutilizar lógica
const rouletteController = require('../controllers/rouletteController');

// Configuração do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

// Armazenar conexão MongoDB
let client;
let collection;

// Inicializar conexão MongoDB
async function connectToMongoDB() {
  try {
    client = new MongoClient(url, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    collection = db.collection('roulettes');
    console.log('[PUBLIC API] Conectado ao MongoDB com sucesso');
    return true;
  } catch (error) {
    console.error('[PUBLIC API] Erro ao conectar ao MongoDB:', error);
    return false;
  }
}

// Conectar ao inicializar
const isConnected = connectToMongoDB();

/**
 * @route   GET /api/stream/roulettes
 * @desc    Estabelece conexão SSE para streaming de dados criptografados
 * @access  Público
 */
router.get('/stream/roulettes', sseController.establishConnection);

/**
 * @route   GET /api/public/roulettes
 * @desc    Retorna dados criptografados das roletas (sem verificar assinatura)
 * @access  Público
 */
router.get('/public/roulettes', async (req, res) => {
  const requestId = crypto.randomUUID();
  console.log(`[PUBLIC API ${requestId}] Requisição recebida para /api/public/roulettes`);
  
  try {
    if (!isConnected || !collection) {
      console.log(`[PUBLIC API ${requestId}] MongoDB não conectado, retornando array vazio`);
      return res.status(500).json({ 
        success: false, 
        message: 'Serviço indisponível no momento' 
      });
    }
    
    // Obter roletas do banco de dados
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[PUBLIC API ${requestId}] Processadas ${roulettes.length} roletas`);
    
    // Criptografar os dados antes de enviar
    const encryptedData = await cryptoService.encrypt(roulettes);
    
    // Retornar dados criptografados
    res.status(200).json({ data: encryptedData });
  } catch (error) {
    console.error(`[PUBLIC API ${requestId}] Erro ao listar roletas:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao processar dados',
      requestId
    });
  }
});

// Atualização programada para SSE a cada 5 segundos
setInterval(async () => {
  try {
    if (!isConnected || !collection) {
      return;
    }
    
    // Obter roletas do banco de dados
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    // Adicionar timestamp e atributos adicionais
    const dataWithMetadata = {
      roletas: roulettes,
      timestamp: new Date().toISOString(),
      count: roulettes.length
    };
    
    // Broadcast para todos os clientes conectados
    await sseController.broadcastData(dataWithMetadata);
  } catch (error) {
    console.error('[PUBLIC API] Erro ao atualizar clientes SSE:', error);
  }
}, 5000);

module.exports = router; 