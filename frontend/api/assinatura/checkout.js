// API serverless para criar checkout de assinatura
// Esta função será implantada como API no Vercel

export default function handler(req, res) {
  // Permitir apenas método POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Verificar se existe token de autenticação
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({
      success: false,
      message: 'Acesso não autorizado',
      error: 'NO_TOKEN'
    });
  }
  
  // Extrair planoId do corpo da requisição
  const { planoId } = req.body;
  
  // Verificar se o plano é válido
  if (!planoId || !['mensal', 'trimestral', 'anual'].includes(planoId)) {
    return res.status(400).json({
      success: false,
      message: 'Plano inválido',
      error: 'INVALID_PLAN'
    });
  }
  
  // Simular criação de checkout (em produção, integraria com o Asaas)
  // Em uma implementação real, você extrairia informações do usuário do token
  const userId = 'user-' + Math.floor(Math.random() * 1000);
  const checkoutUrl = `https://checkout.asaas.com/simulate?plan=${planoId}&user=${userId}`;
  
  res.status(200).json({
    success: true,
    message: 'Checkout criado com sucesso',
    checkoutUrl: checkoutUrl
  });
} 