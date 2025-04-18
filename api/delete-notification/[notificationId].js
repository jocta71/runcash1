const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_jwt';

// Verificar token de autenticação
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Manipulador principal da requisição
module.exports = async (req, res) => {
  // Extrair notificationId dos parâmetros da rota
  const { notificationId } = req.query;
  
  if (!notificationId) {
    return res.status(400).json({ error: 'ID da notificação não fornecido' });
  }
  
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Responder a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar token de autenticação
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }
  
  const token = authHeader.substring(7); // Remover "Bearer " do início
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
  
  const userId = decoded.id || decoded.userId || decoded.sub;
  
  if (!userId) {
    return res.status(401).json({ error: 'ID de usuário não encontrado no token' });
  }
  
  let client;
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // Verificar se a notificação existe e pertence ao usuário
    const notification = await db.collection('notifications').findOne({
      _id: new ObjectId(notificationId),
      user_id: userId
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }
    
    // Excluir a notificação
    await db.collection('notifications').deleteOne({
      _id: new ObjectId(notificationId)
    });
    
    return res.status(200).json({
      success: true,
      message: 'Notificação excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir notificação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 