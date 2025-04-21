/**
 * Endpoint para atualizar dados do usuário, incluindo o ID do cliente Asaas
 */
const { verifyToken } = require('./config/auth');
const { connectToDatabase } = require('./config/mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  try {
    // Verificar autenticação
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado - Token ausente'
      });
    }

    const decodedToken = await verifyToken(token);
    
    // Usuário não autenticado
    if (!decodedToken || !decodedToken.id) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado - Token inválido'
      });
    }

    // Obter dados do corpo da requisição
    const { userId, asaasCustomerId } = req.body;
    
    // Validar campos obrigatórios
    if (!userId || !asaasCustomerId) {
      return res.status(400).json({ 
        success: false,
        error: 'Dados incompletos. userId e asaasCustomerId são obrigatórios.' 
      });
    }

    // Verificar se o usuário tem permissão (só pode atualizar a si mesmo ou ser admin)
    if (decodedToken.id !== userId && !decodedToken.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Não autorizado - Você não tem permissão para atualizar este usuário'
      });
    }

    // Conectar ao banco de dados
    const { db } = await connectToDatabase();
    
    // Atualizar usuário
    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: { asaasCustomerId: asaasCustomerId } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      userId,
      asaasCustomerId
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}; 