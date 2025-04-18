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
  
  // Ignorar o segmento "api" (o primeiro) e "notification" (o segundo)
  const action = pathSegments[2] || '';
  const notificationId = pathSegments[3] || '';
  
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
    
    // Roteamento com base na ação
    switch(action) {
      case '':
        // Manipular notificações (listar/excluir)
        if (req.method === 'GET') {
          // Listar notificações
          return await handleListNotifications(req, res, db, userId, url);
        } else if (req.method === 'DELETE') {
          // Excluir notificação
          return await handleDeleteNotification(req, res, db, userId, url.searchParams.get('id'));
        }
        break;
        
      case 'read':
        // Marcar notificação como lida ou excluir todas lidas
        if (req.method === 'PUT') {
          // Marcar notificação como lida
          return await handleMarkAsRead(req, res, db, userId);
        } else if (req.method === 'DELETE') {
          // Excluir todas notificações lidas
          return await handleDeleteAllRead(req, res, db, userId);
        }
        break;
        
      case 'read-all':
        // Marcar todas as notificações como lidas
        if (req.method === 'PUT') {
          return await handleMarkAllAsRead(req, res, db, userId);
        }
        break;
        
      case 'delete':
        // Excluir notificação por ID (forma alternativa)
        if (req.method === 'DELETE' && notificationId) {
          return await handleDeleteNotification(req, res, db, userId, notificationId);
        }
        break;
        
      case 'settings':
        // Obter ou atualizar configurações de notificação
        if (req.method === 'GET') {
          return await handleGetSettings(req, res, db, userId);
        } else if (req.method === 'PUT') {
          return await handleUpdateSettings(req, res, db, userId, req.body);
        }
        break;
        
      case 'subscription':
        // Notificações específicas de assinatura
        if (req.method === 'GET') {
          return await handleListSubscriptionNotifications(req, res, db, userId, url);
        }
        break;
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

// Funções específicas para cada operação

// 1. Listar notificações do usuário
async function handleListNotifications(req, res, db, userId, url) {
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

// 2. Marcar notificação como lida
async function handleMarkAsRead(req, res, db, userId) {
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

// 3. Marcar todas as notificações como lidas
async function handleMarkAllAsRead(req, res, db, userId) {
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

// 4. Excluir notificação
async function handleDeleteNotification(req, res, db, userId, notificationId) {
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

// 5. Excluir todas as notificações lidas
async function handleDeleteAllRead(req, res, db, userId) {
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

// 6. Obter configurações de notificação
async function handleGetSettings(req, res, db, userId) {
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
}

// 7. Atualizar configurações de notificação
async function handleUpdateSettings(req, res, db, userId, reqBody) {
  const { settings } = reqBody;
  
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

// 8. Listar notificações de assinatura
async function handleListSubscriptionNotifications(req, res, db, userId, url) {
  // Parâmetros de paginação
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = parseInt(url.searchParams.get('limit')) || 20;
  const skip = (page - 1) * limit;
  
  // Construir filtro de consulta para notificações de assinatura
  const query = { 
    user_id: userId,
    notification_type: 'subscription'
  };
  
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
    read: notification.read,
    createdAt: notification.created_at,
    data: notification.data || null
  }));
  
  return res.status(200).json({
    success: true,
    notifications: formattedNotifications,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
} 