// API serverless para retornar status da assinatura
// Esta função será implantada como API no Vercel

export default function handler(req, res) {
  // Permitir apenas método GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Verificar se existe token de autenticação
  const authHeader = req.headers.authorization;
  
  // Se não houver token, retornar status sem assinatura
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(200).json({
      success: true,
      message: 'Informações da assinatura recuperadas com sucesso',
      data: {
        possuiAssinatura: false,
        status: 'sem assinatura',
        instrucoes: 'Para acessar recursos premium, você precisa adquirir uma assinatura.'
      }
    });
  }
  
  // Simular um usuário com assinatura
  // Em produção, você verificaria a validade do token e consultaria o banco de dados
  res.status(200).json({
    success: true,
    message: 'Informações da assinatura recuperadas com sucesso',
    data: {
      possuiAssinatura: true,
      status: 'ativa',
      plano: 'trimestral',
      dataInicio: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
      validade: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
      renovacaoAutomatica: true,
      diasRestantes: 60
    }
  });
} 