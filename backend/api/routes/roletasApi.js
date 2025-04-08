/**
 * API de Roletas para Polling
 * Fornece endpoints para obter dados das roletas em tempo real usando polling
 */

const express = require('express');
const router = express.Router();

// Middleware para verificar se o MongoDB está disponível
const checkMongoDB = (req, res, next) => {
  if (!req.app.locals.db) {
    return res.status(503).json({ 
      error: 'Banco de dados não disponível', 
      message: 'O serviço de banco de dados não está acessível no momento' 
    });
  }
  next();
};

/**
 * @route   GET /api/roletas
 * @desc    Obtém todas as roletas com seus números recentes
 * @access  Public
 * @param   {Number} since - Timestamp opcional para obter apenas atualizações desde then
 */
router.get('/', checkMongoDB, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const sinceTimestamp = req.query.since ? parseInt(req.query.since) : null;
    
    console.log(`[API] Obtendo roletas${sinceTimestamp ? ` desde ${new Date(sinceTimestamp).toISOString()}` : ''}`);
    
    // Buscar todas as roletas da coleção
    const roletasCollection = db.collection('roletas');
    const roulettes = await roletasCollection.find({}).toArray();
    
    // Se não há roletas, retornar array vazio
    if (!roulettes || roulettes.length === 0) {
      console.log('[API] Nenhuma roleta encontrada no banco de dados');
      return res.json([]);
    }
    
    // Para cada roleta, buscar seus números mais recentes
    const roletasCompletas = await Promise.all(roulettes.map(async (roleta) => {
      const roletaId = roleta.id || roleta._id;
      
      // Definir query para buscar números
      let query = { roleta_id: roletaId.toString() };
      
      // Se temos timestamp, buscar apenas números desde então
      if (sinceTimestamp) {
        query.timestamp = { $gt: new Date(sinceTimestamp) };
      }
      
      // Buscar números recentes da roleta
      const numerosRecentes = await db.collection('roleta_numeros')
        .find(query)
        .sort({ timestamp: -1 })
        .limit(20)  // Limitar a 20 números mais recentes
        .toArray();
      
      // Mapear para formato simplificado
      const recentNumbers = numerosRecentes.map(item => item.numero);
      
      // Retornar roleta com números
      return {
        id: roletaId,
        name: roleta.nome || roleta.name,
        recentNumbers,
        lastUpdated: numerosRecentes.length > 0 ? numerosRecentes[0].timestamp : null
      };
    }));
    
    console.log(`[API] Retornando ${roletasCompletas.length} roletas com seus números recentes`);
    res.json(roletasCompletas);
    
  } catch (error) {
    console.error('[API] Erro ao listar roletas:', error);
    res.status(500).json({ 
      error: 'Erro interno', 
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/roletas/:id
 * @desc    Obtém uma roleta específica com seus números recentes
 * @access  Public
 * @param   {Number} since - Timestamp opcional para obter apenas atualizações desde então
 */
router.get('/:id', checkMongoDB, async (req, res) => {
  try {
    const { id } = req.params;
    const sinceTimestamp = req.query.since ? parseInt(req.query.since) : null;
    const db = req.app.locals.db;
    
    console.log(`[API] Buscando roleta com ID: ${id}${sinceTimestamp ? ` desde ${new Date(sinceTimestamp).toISOString()}` : ''}`);
    
    // Buscar roleta pelo ID
    const roleta = await db.collection('roletas').findOne({ id });
    
    if (!roleta) {
      return res.status(404).json({ 
        error: 'Roleta não encontrada', 
        message: `Não foi encontrada roleta com ID ${id}` 
      });
    }
    
    // Definir query para buscar números
    let query = { roleta_id: id.toString() };
    
    // Se temos timestamp, buscar apenas números desde então
    if (sinceTimestamp) {
      query.timestamp = { $gt: new Date(sinceTimestamp) };
    }
    
    // Buscar números recentes da roleta
    const numerosRecentes = await db.collection('roleta_numeros')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(20)  // Limitar a 20 números mais recentes
      .toArray();
    
    // Mapear para formato simplificado
    const recentNumbers = numerosRecentes.map(item => item.numero);
    
    // Retornar roleta com números
    const resultado = {
      id: roleta.id || roleta._id,
      name: roleta.nome || roleta.name,
      recentNumbers,
      lastUpdated: numerosRecentes.length > 0 ? numerosRecentes[0].timestamp : null
    };
    
    console.log(`[API] Retornando roleta ${id} com ${recentNumbers.length} números recentes`);
    res.json(resultado);
    
  } catch (error) {
    console.error(`[API] Erro ao buscar roleta ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erro interno', 
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/roletas/:id/numeros
 * @desc    Adiciona um novo número a uma roleta específica
 * @access  Public
 */
router.post('/:id/numeros', checkMongoDB, async (req, res) => {
  try {
    const { id } = req.params;
    const { numero } = req.body;
    const db = req.app.locals.db;
    
    // Validar input
    if (numero === undefined || numero === null) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        message: 'O número é obrigatório' 
      });
    }
    
    // Converter para número inteiro
    const numeroInt = parseInt(numero);
    
    // Verificar se é um número válido de roleta (0-36)
    if (isNaN(numeroInt) || numeroInt < 0 || numeroInt > 36) {
      return res.status(400).json({ 
        error: 'Número inválido', 
        message: 'O número deve ser um inteiro entre 0 e 36' 
      });
    }
    
    console.log(`[API] Adicionando número ${numeroInt} à roleta ${id}`);
    
    // Verificar se a roleta existe
    const roleta = await db.collection('roletas').findOne({ id });
    
    if (!roleta) {
      return res.status(404).json({ 
        error: 'Roleta não encontrada', 
        message: `Não foi encontrada roleta com ID ${id}` 
      });
    }
    
    // Determinar a cor do número
    let cor = 'verde';
    if (numeroInt > 0) {
      const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      cor = vermelhos.includes(numeroInt) ? 'vermelho' : 'preto';
    }
    
    // Criar registro do número
    const novoNumero = {
      roleta_id: id,
      roleta_nome: roleta.nome || roleta.name,
      numero: numeroInt,
      cor,
      timestamp: new Date()
    };
    
    // Inserir na coleção
    await db.collection('roleta_numeros').insertOne(novoNumero);
    
    console.log(`[API] Número ${numeroInt} (${cor}) adicionado com sucesso à roleta ${id}`);
    
    // Retornar status de sucesso
    res.status(201).json({
      message: 'Número adicionado com sucesso',
      numero: novoNumero
    });
    
  } catch (error) {
    console.error(`[API] Erro ao adicionar número à roleta ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erro interno', 
      message: error.message 
    });
  }
});

module.exports = router; 