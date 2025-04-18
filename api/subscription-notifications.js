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
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Responder a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Obter token de autenticação
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
    
    // Buscar notificações do usuário relacionadas a assinaturas e pagamentos
    const notifications = await db.collection('notifications')
      .find({ 
        user_id: userId,
        $or: [
          { title: { $regex: /assinatura|plano/i } },
          { message: { $regex: /assinatura|plano/i } },
          { title: { $regex: /pagamento/i } },
          { message: { $regex: /pagamento/i } },
          { notification_type: { $in: ['subscription', 'payment'] } }
        ]
      })
      .sort({ created_at: -1 }) // Ordenar do mais recente para o mais antigo
      .limit(20) // Limitar a 20 notificações
      .toArray();
    
    // Adicionar informações extras para melhorar a experiência do usuário
    const notificationsWithExtras = notifications.map(notif => {
      let notificationType = 'system';
      
      // Determinar o tipo de notificação baseado no conteúdo
      if (notif.title.toLowerCase().includes('pagamento') || 
          notif.message.toLowerCase().includes('pagamento')) {
        notificationType = 'payment';
      } else if (notif.title.toLowerCase().includes('assinatura') || 
                notif.message.toLowerCase().includes('assinatura') ||
                notif.title.toLowerCase().includes('plano') || 
                notif.message.toLowerCase().includes('plano')) {
        notificationType = 'subscription';
      }
      
      return {
        ...notif,
        id: notif._id.toString(), // Converter _id para string
        notification_type: notif.notification_type || notificationType,
        read_at: notif.read ? notif.updated_at : null
      };
    });
    
    // Retornar as notificações
    return res.status(200).json({
      success: true,
      notifications: notificationsWithExtras
    });
  } catch (error) {
    console.error('Erro ao buscar notificações de assinatura:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 