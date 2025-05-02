/**
 * API asaas-find-payment - Proxy para API de busca de pagamentos
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
  
  try {
    // Implementação temporária
    return res.status(200).json({ 
      message: 'Endpoint em implementação',
      status: 'pending'
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error);
    return res.status(500).json({
      error: 'Erro interno ao buscar pagamento',
      message: error.message
    });
  }
}; 