// Endpoint para atualizar usuário no MongoDB com customerId Asaas 
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

  // Verificar autenticação
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticação não fornecido'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticação inválido'
    });
  }

  // Verificar se MongoDB está configurado
  if (!process.env.MONGODB_ENABLED || !process.env.MONGODB_URI) {
    return res.status(500).json({
      success: false,
      error: 'MongoDB não está configurado'
    });
  }

  let client;
  
  try {
    // Verificar token e extrair userId
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Token não contém ID de usuário'
      });
    }

    // Extrair dados do corpo da requisição
    const { asaasCustomerId } = req.body;
    
    if (!asaasCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'Campo asaasCustomerId é obrigatório'
      });
    }

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    
    // Atualizar usuário
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { asaasCustomerId, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Retornar sucesso
    return res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error.message);
    
    // Verificar erro de token inválido
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticação inválido ou expirado'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 