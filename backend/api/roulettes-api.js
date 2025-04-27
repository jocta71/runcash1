/**
 * API para dados de roletas
 */
const express = require('express');
const router = express.Router();
const getDb = require('../services/database');
const { optionalAuth, checkSubscription } = require('./middleware/auth');
const { controlDataAccess, filterDataByAccessLevel } = require('./middleware/dataAccess');

/**
 * @route GET /api/roulettes/sample
 * @desc Fornece amostras limitadas de dados de roletas para usuários sem assinatura
 * @access Público
 */
router.get('/sample', async (req, res) => {
  try {
    const db = await getDb();
    
    // Buscar algumas roletas para fornecer como amostra
    const roulettes = await db.collection('roulettes')
      .find({})
      .limit(3)
      .toArray();
    
    if (roulettes.length === 0) {
      // Se não encontrar dados na coleção principal, buscar na coleção alternativa
      const alternativeData = await db.collection('roleta_numeros')
        .aggregate([
          { $sort: { timestamp: -1 } },
          { $limit: 100 },
          { $group: { _id: "$roleta_id", nome: { $first: "$roleta_nome" }, numero: { $push: "$numero" } } },
          { $limit: 3 },
          { $project: { _id: 0, id: "$_id", nome: 1, numero: { $slice: ["$numero", 5] }, status: { $literal: "active" } } }
        ])
        .toArray();
      
      if (alternativeData.length > 0) {
        return res.status(200).json(alternativeData);
      }
      
      // Dados de amostra padrão como fallback
      return res.status(200).json([
        { id: "sample-1", nome: "Roleta de Amostra 1", status: "active", numero: [7, 11, 23, 14, 36], amostra: true },
        { id: "sample-2", nome: "Roleta de Amostra 2", status: "active", numero: [0, 32, 15, 19, 4], amostra: true },
        { id: "sample-3", nome: "Roleta de Amostra 3", status: "active", numero: [22, 18, 29, 5, 31], amostra: true }
      ]);
    }
    
    // Limitar os dados retornados
    const limitedData = roulettes.map(roulette => ({
      id: roulette.id,
      nome: roulette.nome || roulette.name,
      status: roulette.status || 'active',
      amostra: true,
      numero: roulette.numero ? roulette.numero.slice(0, 5) : []
    }));
    
    res.status(200).json(limitedData);
  } catch (error) {
    console.error('Erro ao buscar amostras de roletas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar amostras de roletas',
      error: error.message
    });
  }
});

/**
 * @route GET /api/roulettes/limits
 * @desc Retorna dados limitados baseados no nível de acesso do usuário
 * @access Público com limitações
 */
router.get('/limits', optionalAuth, checkSubscription, controlDataAccess, async (req, res) => {
  try {
    const db = await getDb();
    
    // Buscar roletas com limite baseado no nível de acesso
    const limit = req.dataAccessLevel === 'premium' ? 50 : 
                 (req.dataAccessLevel === 'authenticated' ? 10 : 3);
    
    const roulettes = await db.collection('roulettes')
      .find({})
      .limit(limit)
      .toArray();
    
    // Aplicar filtro baseado no nível de acesso
    const filteredData = filterDataByAccessLevel(roulettes, req.dataAccessLevel);
    
    return res.status(200).json({
      success: true,
      access_level: req.dataAccessLevel,
      has_subscription: req.hasActiveSubscription,
      plan_type: req.planType,
      count: filteredData.length,
      timestamp: new Date(),
      data: filteredData
    });
  } catch (error) {
    console.error('Erro ao buscar dados limitados das roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados limitados das roletas',
      error: error.message
    });
  }
});

module.exports = router; 