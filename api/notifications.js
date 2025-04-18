const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// Configuração do MongoDB e variáveis de ambiente
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

// Configuração de CORS (Helper)
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Validação do usuário (Helper)
const validateUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token de autenticação não fornecido', status: 401 };
  }
  
  const token = authHeader.substring(7); // Remover "Bearer " do início
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return { error: 'Token inválido ou expirado', status: 401 };
  }
  
  const userId = decoded.id || decoded.userId || decoded.sub;
  
  if (!userId) {
    return { error: 'ID de usuário não encontrado no token', status: 401 };
  }
  
  return { userId, decoded };
};

// Handler principal
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  setCorsHeaders(res);

  // Responder a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Extrair o caminho da URL
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Ignorar o segmento "api" e "notifications" (os dois primeiros)
  const action = pathSegments[2] || '';
  
  // Para todas as rotas, validar o usuário
  const userValidation = await validateUser(req, res);
  if (userValidation.error) {
    return res.status(userValidation.status).json({ error: userValidation.error });
  }
  
  const { userId } = userValidation;
  
  let client;
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // ROTA 1: Listar notificações do usuário
    if (req.method === 'GET' && !action) {
      // Parâmetros de paginação
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const skip = (page - 1) * limit;
      
      // Filtros adicionais
      const filterRead = url.searchParams.get('read');
      const filterType = url.searchParams.get('type');
      
      // Construir filtro de consulta
      const query = { user_id: userId };
      
      if (filterRead !== null) {
        query.read = filterRead === 'true';
      }
      
      if (filterType) {
        query.notification_type = filterType;
      }
      
      // Obter contagem total para paginação
      const total = await db.collection('notifications').countDocuments(query);
      
      // Obter notificações
      const notifications = await db.collection('notifications')
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      // Formatar resposta
      const formattedNotifications = notifications.map(notification => ({
        id: notification._id.toString(),
        title: notification.title,
        message: notification.message,
        type: notification.type,
        notificationType: notification.notification_type,
        read: notification.read,
        createdAt: notification.created_at,
        data: notification.data || null
      }));
      
      // Verificar se há novas notificações não lidas
      const unreadCount = await db.collection('notifications').countDocuments({
        user_id: userId,
        read: false
      });
      
      return res.status(200).json({
        success: true,
        notifications: formattedNotifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        },
        meta: {
          unreadCount
        }
      });
    }
    
    // ROTA 2: Marcar notificação como lida
    if (req.method === 'PUT' && action === 'read') {
      const { notificationId } = req.body;
      
      if (!notificationId) {
        return res.status(400).json({ error: 'ID da notificação é obrigatório' });
      }
      
      // Verificar se a notificação existe e pertence ao usuário
      const notification = await db.collection('notifications').findOne({
        _id: new ObjectId(notificationId),
        user_id: userId
      });
      
      if (!notification) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }
      
      // Atualizar para lida
      await db.collection('notifications').updateOne(
        { _id: new ObjectId(notificationId) },
        { $set: { read: true, updated_at: new Date() } }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Notificação marcada como lida'
      });
    }
    
    // ROTA 3: Marcar todas as notificações como lidas
    if (req.method === 'PUT' && action === 'read-all') {
      // Atualizar todas as notificações não lidas do usuário
      const result = await db.collection('notifications').updateMany(
        { user_id: userId, read: false },
        { $set: { read: true, updated_at: new Date() } }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Todas as notificações marcadas como lidas',
        count: result.modifiedCount
      });
    }
    
    // ROTA 4: Excluir notificação
    if (req.method === 'DELETE' && !action) {
      const notificationId = url.searchParams.get('id');
      
      if (!notificationId) {
        return res.status(400).json({ error: 'ID da notificação é obrigatório' });
      }
      
      // Verificar se a notificação existe e pertence ao usuário
      const notification = await db.collection('notifications').findOne({
        _id: new ObjectId(notificationId),
        user_id: userId
      });
      
      if (!notification) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }
      
      // Excluir notificação
      await db.collection('notifications').deleteOne({
        _id: new ObjectId(notificationId)
      });
      
      return res.status(200).json({
        success: true,
        message: 'Notificação excluída com sucesso'
      });
    }
    
    // ROTA 5: Excluir todas as notificações lidas
    if (req.method === 'DELETE' && action === 'read') {
      // Excluir todas as notificações lidas do usuário
      const result = await db.collection('notifications').deleteMany({
        user_id: userId,
        read: true
      });
      
      return res.status(200).json({
        success: true,
        message: 'Todas as notificações lidas foram excluídas',
        count: result.deletedCount
      });
    }
    
    // ROTA 6: Configurações de notificação
    if ((req.method === 'GET' || req.method === 'PUT') && action === 'settings') {
      if (req.method === 'GET') {
        // Obter configurações de notificação
        const settings = await db.collection('notification_settings').findOne({ user_id: userId });
        
        // Se não houver configurações, retornar padrão
        const defaultSettings = {
          email: true,
          push: true,
          transactional: true,
          marketing: true,
          security: true
        };
        
        return res.status(200).json({
          success: true,
          settings: settings?.settings || defaultSettings
        });
      } else {
        // Atualizar configurações
        const { settings } = req.body;
        
        if (!settings) {
          return res.status(400).json({ error: 'Configurações não fornecidas' });
        }
        
        // Verificar se já existem configurações
        const existingSettings = await db.collection('notification_settings').findOne({ user_id: userId });
        
        if (existingSettings) {
          // Atualizar configurações existentes
          await db.collection('notification_settings').updateOne(
            { user_id: userId },
            { 
              $set: { 
                settings,
                updated_at: new Date()
              } 
            }
          );
        } else {
          // Criar novas configurações
          await db.collection('notification_settings').insertOne({
            user_id: userId,
            settings,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
        
        return res.status(200).json({
          success: true,
          message: 'Configurações de notificação atualizadas com sucesso',
          settings
        });
      }
    }
    
    // Se nenhuma rota corresponder
    return res.status(404).json({ error: 'Endpoint não encontrado' });
    
  } catch (error) {
    console.error('Erro na API de notificações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 