// Endpoint para buscar dados do usuário autenticado
const { MongoClient } = require('mongodb');
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

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  // Verificar e extrair token de autenticação
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
  
  let client;
  
  try {
    // Verificar JWT
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!JWT_SECRET) {
      console.error('JWT_SECRET não configurado no ambiente');
      return res.status(500).json({
        success: false,
        error: 'Erro de configuração do servidor'
      });
    }
    
    // Decodificar e verificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }
    
    // Verificar se MongoDB está configurado
    if (!process.env.MONGODB_URI) {
      console.warn('MongoDB não configurado. URI ausente.');
      return res.status(500).json({
        success: false,
        error: 'Configuração do banco de dados ausente'
      });
    }

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    console.log(`Buscando dados do usuário ID: ${userId}`);
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    
    // Buscar dados do usuário
    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { password: 0 } } // Excluir senha dos dados retornados
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Retornar dados do usuário
    return res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpfCnpj: user.cpfCnpj,
      created_at: user.created_at
    });
    
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    
    // Verificar se o erro é de JWT
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar dados do usuário',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 