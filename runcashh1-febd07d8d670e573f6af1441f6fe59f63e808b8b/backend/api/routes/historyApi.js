/**
 * API de Histórico de Roletas
 * Rotas para gerenciar o histórico completo de até 1000 números por roleta
 */

const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const RouletteHistory = require('../models/RouletteHistory');

// Middleware para inicializar o modelo de histórico
router.use(async (req, res, next) => {
  try {
    if (!req.app.locals.db) {
      console.error('[HistoryAPI] MongoDB não está conectado');
      return res.status(500).json({ error: 'Banco de dados não disponível' });
    }
    
    // Inicializar o modelo de histórico se ainda não estiver disponível
    if (!req.app.locals.historyModel) {
      req.app.locals.historyModel = new RouletteHistory(req.app.locals.db);
    }
    
    next();
  } catch (error) {
    console.error('[HistoryAPI] Erro no middleware:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

/**
 * Obter histórico completo de uma roleta específica
 * GET /api/history/:roletaId
 */
router.get('/:roletaId', async (req, res) => {
  try {
    const { roletaId } = req.params;
    
    if (!roletaId) {
      return res.status(400).json({ error: 'ID da roleta é obrigatório' });
    }
    
    // Mapear para ID canônico se necessário
    const canonicalId = req.app.locals.mapToCanonicalId ? 
      req.app.locals.mapToCanonicalId(roletaId) : roletaId;
    
    console.log(`[HistoryAPI] Buscando histórico para roleta ${canonicalId} (original: ${roletaId})`);
    
    const history = await req.app.locals.historyModel.getHistoryByRouletteId(canonicalId);
    
    return res.json(history);
  } catch (error) {
    console.error('[HistoryAPI] Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico', details: error.message });
  }
});

/**
 * Adicionar um número ao histórico
 * POST /api/history/:roletaId
 * Body: { numero: Number, roletaNome: String }
 */
router.post('/:roletaId', async (req, res) => {
  try {
    const { roletaId } = req.params;
    const { numero, roletaNome } = req.body;
    
    if (!roletaId || numero === undefined) {
      return res.status(400).json({ 
        error: 'ID da roleta e número são obrigatórios',
        receivedRoletaId: roletaId,
        receivedNumero: numero
      });
    }
    
    // Mapear para ID canônico se necessário
    const canonicalId = req.app.locals.mapToCanonicalId ? 
      req.app.locals.mapToCanonicalId(roletaId) : roletaId;
    
    console.log(`[HistoryAPI] Adicionando número ${numero} para roleta ${roletaNome} (${canonicalId})`);
    
    const success = await req.app.locals.historyModel.addNumberToHistory(
      canonicalId, 
      roletaNome || `Roleta ${canonicalId}`, 
      numero
    );
    
    if (success) {
      return res.status(201).json({ message: 'Número adicionado com sucesso' });
    } else {
      return res.status(400).json({ error: 'Falha ao adicionar número' });
    }
  } catch (error) {
    console.error('[HistoryAPI] Erro ao adicionar número:', error);
    res.status(500).json({ error: 'Erro ao adicionar número', details: error.message });
  }
});

/**
 * Importar múltiplos números para uma roleta
 * POST /api/history/:roletaId/import
 * Body: { numeros: Array<Number>, roletaNome: String }
 */
router.post('/:roletaId/import', async (req, res) => {
  try {
    const { roletaId } = req.params;
    const { numeros, roletaNome } = req.body;
    
    if (!roletaId || !Array.isArray(numeros)) {
      return res.status(400).json({ 
        error: 'ID da roleta e array de números são obrigatórios',
        receivedRoletaId: roletaId,
        receivedNumeros: numeros
      });
    }
    
    // Mapear para ID canônico se necessário
    const canonicalId = req.app.locals.mapToCanonicalId ? 
      req.app.locals.mapToCanonicalId(roletaId) : roletaId;
    
    console.log(`[HistoryAPI] Importando ${numeros.length} números para roleta ${roletaNome} (${canonicalId})`);
    
    const success = await req.app.locals.historyModel.importNumbers(
      canonicalId, 
      roletaNome || `Roleta ${canonicalId}`, 
      numeros
    );
    
    if (success) {
      return res.status(201).json({ 
        message: 'Números importados com sucesso',
        count: numeros.length
      });
    } else {
      return res.status(400).json({ error: 'Falha ao importar números' });
    }
  } catch (error) {
    console.error('[HistoryAPI] Erro ao importar números:', error);
    res.status(500).json({ error: 'Erro ao importar números', details: error.message });
  }
});

/**
 * Limpar o histórico de uma roleta
 * DELETE /api/history/:roletaId
 */
router.delete('/:roletaId', async (req, res) => {
  try {
    const { roletaId } = req.params;
    
    if (!roletaId) {
      return res.status(400).json({ error: 'ID da roleta é obrigatório' });
    }
    
    // Mapear para ID canônico se necessário
    const canonicalId = req.app.locals.mapToCanonicalId ? 
      req.app.locals.mapToCanonicalId(roletaId) : roletaId;
    
    console.log(`[HistoryAPI] Limpando histórico da roleta ${canonicalId}`);
    
    const success = await req.app.locals.historyModel.clearHistory(canonicalId);
    
    if (success) {
      return res.json({ message: 'Histórico limpo com sucesso' });
    } else {
      return res.status(400).json({ error: 'Falha ao limpar histórico' });
    }
  } catch (error) {
    console.error('[HistoryAPI] Erro ao limpar histórico:', error);
    res.status(500).json({ error: 'Erro ao limpar histórico', details: error.message });
  }
});

// Exportar o router
module.exports = router; 