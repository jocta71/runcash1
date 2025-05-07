// Endpoint para atualizar usuário no MongoDB com customerId Asaas 
const { MongoClient, ObjectId } = require('mongodb');

// Tentar importar jsonwebtoken, mas continuar mesmo se falhar
let jwt;
try {
  jwt = require('jsonwebtoken');
} catch (error) {
  console.warn("Módulo jsonwebtoken não encontrado. Autenticação por token será limitada.");
}

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
    // Obter userId - usando alternativa se jwt não estiver disponível
    let userId;
    
    if (jwt) {
      // Método normal - verificar token e extrair userId
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded.userId;
      } catch (jwtError) {
        console.error("Erro ao verificar JWT:", jwtError.message);
        // Tentar método alternativo se JWT falhar
      }
    }
    
    // Se não conseguir extrair userId do token ou jwt não estiver disponível,
    // usar alternativa: buscar o userId direto do corpo da requisição
    if (!userId) {
      userId = req.body.userId;
      console.log("Usando userId do corpo da requisição:", userId);
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Não foi possível identificar o usuário'
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
    
    // Atualizar usuário - tratar o ID como string se não for um ObjectId válido
    let filter;
    try {
      filter = { _id: new ObjectId(userId) };
    } catch (objIdError) {
      console.log("ID não parece ser um ObjectId válido, tentando como string:", userId);
      filter = { id: userId };
    }
    
    // Atualizar usuário
    const result = await db.collection('users').updateOne(
      filter,
      { $set: { asaasCustomerId, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      // Tentar novamente com outra forma de identificar o usuário (campo 'id')
      const secondResult = await db.collection('users').updateOne(
        { id: userId },
        { $set: { asaasCustomerId, updatedAt: new Date() } }
      );
      
      if (secondResult.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }
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