// API handler para compatibilidade com a rota antiga de status de assinatura
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Verificar token de autenticação
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticação não fornecido',
      error: 'UNAUTHORIZED'
    });
  }

  // Em um cenário real, validaríamos o token e buscaríamos as informações reais do usuário
  // Aqui estamos apenas simulando uma resposta positiva
  
  // Simular um usuário com assinatura
  res.status(200).json({
    success: true,
    message: 'Informações da assinatura recuperadas com sucesso',
    data: {
      status: 'ACTIVE',
      plan: 'PREMIUM',
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
      expirationDate: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
      autoRenew: true,
      remainingDays: 60
    }
  });
} 