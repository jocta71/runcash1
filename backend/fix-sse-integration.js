/**
 * Script para integração da correção SSE ao servidor principal
 * 
 * Este arquivo deve ser importado no arquivo principal do servidor (backend/index.js)
 * para adicionar as rotas SSE corretamente.
 */

const express = require('express');
const router = express.Router();
const { checkToken } = require('./middleware/auth');
const checkSubscription = require('./middleware/subscriptionCheck');
const crypto = require('crypto');
const Iron = require('@hapi/iron');
const { MongoClient } = require('mongodb');

// Chave de criptografia do ambiente ou usar a padrão (a mesma usada em outras partes do app)
const ENCRYPTION_SECRET = process.env.DATA_ENCRYPTION_KEY || 'runcash_secret_encryption_key_32_chars';

// Configuração do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

// Log de inicialização
console.log('[FIX-SSE-INTEGRATION] Iniciando integração das rotas SSE');

/**
 * Rota para streaming de todas as roletas
 * Acessível via: /api/stream/roulettes
 */
router.get('/stream/roulettes', checkToken, checkSubscription, async (req, res) => {
  try {
    // Gerar ID de requisição para rastreamento
    const requestId = crypto.randomUUID();
    
    // Log detalhado do acesso
    console.log(`[FIX-SSE] Iniciando conexão SSE para todas as roletas`);
    console.log(`[FIX-SSE] Request URL: ${req.originalUrl}`);
    console.log(`[FIX-SSE] Request ID: ${requestId}`);
    console.log(`[FIX-SSE] Usuário ID: ${req.user.id}`);
    console.log(`[FIX-SSE] Timestamp: ${new Date().toISOString()}`);
    
    // Configurar cabeçalhos SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Importante para nginx
    });
    
    // Função para enviar eventos
    const sendEvent = async (eventType, data) => {
      try {
        // Criptografar dados usando Iron
        const encryptedData = await Iron.seal(
          data,
          ENCRYPTION_SECRET,
          Iron.defaults
        );
        
        // Estrutura do evento SSE
        res.write(`event: ${eventType}\n`);
        res.write(`id: ${Date.now()}\n`);
        res.write(`data: ${encryptedData}\n\n`);
      } catch (error) {
        console.error(`[FIX-SSE] Erro ao criptografar dados: ${error.message}`);
      }
    };
    
    // Conectar ao banco de dados
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbName);
    
    // Obter dados iniciais de todas as roletas
    const roulettesData = await db.collection('roulettes').find({}).toArray();
    
    // Configurar limites com base no plano do usuário
    let limit = 5; // Padrão para plano básico
    let limited = true;
    
    // Ajustar limite com base no plano
    if (req.user.subscription) {
      switch (req.user.subscription.type) {
        case 'BASIC':
          limit = 15;
          break;
        case 'PRO':
          limit = 50;
          break;
        case 'PREMIUM':
          limit = Infinity; // Sem limite
          limited = false;
          break;
        default:
          limit = 5; // Plano básico padrão
      }
    }
    
    // Enviar dados iniciais
    await sendEvent('update', {
      type: 'initial',
      roulettes: limited ? roulettesData.slice(0, limit) : roulettesData,
      limited,
      totalCount: roulettesData.length,
      availableCount: limited ? limit : roulettesData.length,
      userPlan: req.user.subscription ? req.user.subscription.type : 'BASIC',
      timestamp: new Date().toISOString()
    });
    
    // Configurar changestream para atualização em tempo real
    const changeStream = db.collection('roulettes').watch([], { fullDocument: 'updateLookup' });
    
    changeStream.on('change', async (change) => {
      if (change.operationType === 'update' || change.operationType === 'replace' || 
          change.operationType === 'insert' || change.operationType === 'delete') {
        
        // Buscar dados atualizados de todas as roletas
        const updatedRoulettes = await db.collection('roulettes').find({}).toArray();
        
        await sendEvent('update', {
          type: 'update',
          roulettes: limited ? updatedRoulettes.slice(0, limit) : updatedRoulettes,
          changeType: change.operationType,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Heartbeat a cada 30 segundos para manter a conexão ativa
    const interval = setInterval(async () => {
      await sendEvent('heartbeat', {
        timestamp: new Date().toISOString()
      });
    }, 30000);
    
    // Limpar recursos quando a conexão for fechada
    req.on('close', () => {
      console.log(`[FIX-SSE] Fechando conexão SSE para todas as roletas (${requestId})`);
      clearInterval(interval);
      changeStream.close();
      client.close();
    });
    
  } catch (error) {
    console.error(`[FIX-SSE] Erro ao processar stream para todas as roletas:`, error);
    res.write(`event: error\n`);
    res.write(`data: {"message": "Erro interno do servidor"}\n\n`);
    res.end();
  }
});

/**
 * Rota para streaming de uma roleta específica
 * Acessível via: /api/stream/roulettes/:id
 */
router.get('/stream/roulettes/:id', checkToken, checkSubscription, async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const requestId = crypto.randomUUID();
    
    // Log detalhado do acesso
    console.log(`[FIX-SSE] Iniciando conexão SSE para roleta específica: ${rouletteId}`);
    console.log(`[FIX-SSE] Request URL: ${req.originalUrl}`);
    console.log(`[FIX-SSE] Request ID: ${requestId}`);
    console.log(`[FIX-SSE] Usuário ID: ${req.user.id}`);
    console.log(`[FIX-SSE] Timestamp: ${new Date().toISOString()}`);
    
    // Configurar cabeçalhos SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Importante para nginx
    });
    
    // Função para enviar eventos
    const sendEvent = async (eventType, data) => {
      try {
        // Criptografar dados usando Iron
        const encryptedData = await Iron.seal(
          data,
          ENCRYPTION_SECRET,
          Iron.defaults
        );
        
        // Estrutura do evento SSE
        res.write(`event: ${eventType}\n`);
        res.write(`id: ${Date.now()}\n`);
        res.write(`data: ${encryptedData}\n\n`);
      } catch (error) {
        console.error(`[FIX-SSE] Erro ao criptografar dados: ${error.message}`);
      }
    };
    
    // Conectar ao banco de dados
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db(dbName);
    
    // Obter dados da roleta específica
    const roulette = await db.collection('roulettes').findOne({ id: rouletteId });
    
    if (!roulette) {
      console.log(`[FIX-SSE] Roleta não encontrada: ${rouletteId}`);
      res.write(`event: error\n`);
      res.write(`data: {"message": "Roleta não encontrada"}\n\n`);
      res.end();
      return;
    }
    
    // Enviar dados iniciais
    await sendEvent('update', {
      type: 'initial',
      roulette,
      timestamp: new Date().toISOString()
    });
    
    // Configurar pipeline para filtrar apenas eventos relacionados à esta roleta
    const pipeline = [
      {
        $match: {
          'fullDocument.id': rouletteId
        }
      }
    ];
    
    // Configurar changestream para atualização em tempo real
    const changeStream = db.collection('roulettes').watch(pipeline, { fullDocument: 'updateLookup' });
    
    changeStream.on('change', async (change) => {
      if (change.operationType === 'update' || change.operationType === 'replace') {
        await sendEvent('update', {
          type: 'update',
          roulette: change.fullDocument,
          changeType: change.operationType,
          timestamp: new Date().toISOString()
        });
      } else if (change.operationType === 'delete') {
        await sendEvent('update', {
          type: 'delete',
          rouletteId,
          changeType: 'delete',
          timestamp: new Date().toISOString()
        });
        
        // Fechar conexão se a roleta for excluída
        res.end();
      }
    });
    
    // Heartbeat a cada 30 segundos para manter a conexão ativa
    const interval = setInterval(async () => {
      await sendEvent('heartbeat', {
        timestamp: new Date().toISOString()
      });
    }, 30000);
    
    // Limpar recursos quando a conexão for fechada
    req.on('close', () => {
      console.log(`[FIX-SSE] Fechando conexão SSE para roleta ${rouletteId} (${requestId})`);
      clearInterval(interval);
      changeStream.close();
      client.close();
    });
    
  } catch (error) {
    console.error(`[FIX-SSE] Erro ao processar stream para roleta específica:`, error);
    res.write(`event: error\n`);
    res.write(`data: {"message": "Erro interno do servidor"}\n\n`);
    res.end();
  }
});

// Exportar o router para ser usado no index.js
module.exports = router;

// Instruções para a integração no arquivo index.js
console.log('[FIX-SSE-INTEGRATION] Para integrar este módulo ao servidor principal:');
console.log('[FIX-SSE-INTEGRATION] 1. Abra o arquivo backend/index.js');
console.log('[FIX-SSE-INTEGRATION] 2. Adicione a linha: const fixSSERouter = require("./fix-sse-integration");');
console.log('[FIX-SSE-INTEGRATION] 3. Adicione antes das outras rotas: app.use("/api", fixSSERouter);'); 