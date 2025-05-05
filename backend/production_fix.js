/**
 * CORREÇÃO DE PRODUÇÃO PARA RAILWAY
 * Este arquivo adiciona rotas especiais para o ambiente de produção
 * que eliminam a necessidade de autenticação para endpoints de roletas
 */

const express = require('express');

// Função que aplica as correções ao app Express
function applyProductionFixes(app, db, collection) {
  console.log('[PROD-FIX] Aplicando correções para ambiente de produção Railway');
  
  // 1. Endpoint público para /api/ROULETTES (maiúsculas)
  app.get('/api/ROULETTES', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[RAILWAY-FIX ${requestId}] Acesso ao endpoint sem autenticação /api/ROULETTES`);
    
    // Aplicar cabeçalhos CORS 
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    try {
      if (!collection) {
        console.log(`[RAILWAY-FIX ${requestId}] MongoDB não disponível, retornando array vazio`);
        return res.json([]);
      }
      
      // Obter lista de roletas - mesmo código existente
      const roulettes = await collection.aggregate([
        { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
        { $project: { _id: 0, id: 1, nome: "$_id" } }
      ]).toArray();
      
      console.log(`[RAILWAY-FIX ${requestId}] Retornando ${roulettes.length} roletas sem autenticação`);
      return res.json(roulettes);
    } catch (error) {
      console.error(`[RAILWAY-FIX ${requestId}] Erro:`, error);
      return res.status(500).json({ 
        error: 'Erro interno ao processar requisição',
        message: error.message,
        requestId: requestId
      });
    }
  });
  
  // 2. Endpoint público para /api/roulettes (minúsculas)
  app.get('/api/roulettes', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[RAILWAY-FIX ${requestId}] Acesso ao endpoint sem autenticação /api/roulettes`);
    
    // Aplicar cabeçalhos CORS
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    try {
      if (!collection) {
        console.log(`[RAILWAY-FIX ${requestId}] MongoDB não disponível, retornando array vazio`);
        return res.json([]);
      }
      
      // Obter lista de roletas
      const roulettes = await collection.aggregate([
        { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
        { $project: { _id: 0, id: 1, nome: "$_id" } }
      ]).toArray();
      
      console.log(`[RAILWAY-FIX ${requestId}] Retornando ${roulettes.length} roletas sem autenticação`);
      return res.json(roulettes);
    } catch (error) {
      console.error(`[RAILWAY-FIX ${requestId}] Erro:`, error);
      return res.status(500).json({ 
        error: 'Erro interno ao processar requisição',
        message: error.message,
        requestId: requestId
      });
    }
  });
  
  // 3. Endpoint público para /api/roletas (em português)
  app.get('/api/roletas', async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[RAILWAY-FIX ${requestId}] Acesso ao endpoint sem autenticação /api/roletas`);
    
    // Aplicar cabeçalhos CORS
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    try {
      if (!collection) {
        console.log(`[RAILWAY-FIX ${requestId}] MongoDB não disponível, retornando array vazio`);
        return res.json([]);
      }
      
      // Obter lista de roletas
      const roulettes = await collection.aggregate([
        { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
        { $project: { _id: 0, id: 1, nome: "$_id" } }
      ]).toArray();
      
      console.log(`[RAILWAY-FIX ${requestId}] Retornando ${roulettes.length} roletas sem autenticação`);
      return res.json(roulettes);
    } catch (error) {
      console.error(`[RAILWAY-FIX ${requestId}] Erro:`, error);
      return res.status(500).json({ 
        error: 'Erro interno ao processar requisição',
        message: error.message,
        requestId: requestId
      });
    }
  });
  
  console.log('[PROD-FIX] Correções aplicadas com sucesso - Endpoints de roleta agora são públicos');
}

module.exports = applyProductionFixes; 