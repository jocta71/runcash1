/**
 * API ai/query - Endpoint para consultas à IA
 */

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  try {
    // Verificar corpo da requisição
    if (!req.body || !req.body.query) {
      return res.status(400).json({
        error: 'Corpo da requisição inválido',
        message: 'O campo query é obrigatório'
      });
    }
    
    const { query } = req.body;
    
    // Implementação temporária - apenas responder com eco da consulta
    return res.json({
      message: 'Consulta recebida',
      response: `Esta é uma resposta temporária para: "${query}"`,
      provider: process.env.AI_PROVIDER || 'template'
    });
  } catch (error) {
    console.error('Erro ao processar consulta de IA:', error);
    return res.status(500).json({
      error: 'Erro interno ao processar consulta',
      message: error.message
    });
  }
}; 