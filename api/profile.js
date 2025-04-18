const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
  
  // Ignorar o segmento "api" e "profile" (os dois primeiros)
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
    
    // ROTA 1: Obter perfil do usuário
    if (req.method === 'GET' && (action === '' || action === 'info')) {
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { password: 0 } } // Excluir senha dos resultados
      );
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      // Verificar se há preferências do usuário
      const preferences = await db.collection('user_preferences').findOne({ user_id: userId });
      
      // Formatar dados para resposta
      const profileData = {
        id: user._id.toString(),
        name: user.name || '',
        email: user.email,
        username: user.username || '',
        phoneNumber: user.phone_number || '',
        avatar: user.avatar || '',
        birthDate: user.birth_date || null,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        emailVerified: user.email_verified || false,
        preferences: preferences || {
          notifications: {
            email: true,
            push: true
          },
          theme: 'light',
          language: 'pt-BR'
        }
      };
      
      return res.status(200).json({
        success: true,
        profile: profileData
      });
    }
    
    // ROTA 2: Atualizar perfil do usuário
    if (req.method === 'PUT' || (req.method === 'PATCH' && action === 'info')) {
      const updateData = req.body;
      
      if (!updateData) {
        return res.status(400).json({ error: 'Dados para atualização não fornecidos' });
      }
      
      // Verificar se o usuário existe
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      // Validar se email já está em uso (se for atualizado)
      if (updateData.email && updateData.email !== user.email) {
        const existingEmail = await db.collection('users').findOne({ email: updateData.email });
        if (existingEmail) {
          return res.status(400).json({ error: 'Este email já está em uso' });
        }
      }
      
      // Validar se username já está em uso (se for atualizado)
      if (updateData.username && updateData.username !== user.username) {
        const existingUsername = await db.collection('users').findOne({ username: updateData.username });
        if (existingUsername) {
          return res.status(400).json({ error: 'Este nome de usuário já está em uso' });
        }
      }
      
      // Preparar dados para atualização (converter nomes de campos para snake_case)
      const updateFields = {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.email && { email: updateData.email }),
        ...(updateData.username && { username: updateData.username }),
        ...(updateData.phoneNumber && { phone_number: updateData.phoneNumber }),
        ...(updateData.avatar && { avatar: updateData.avatar }),
        ...(updateData.birthDate && { birth_date: new Date(updateData.birthDate) }),
        updated_at: new Date()
      };
      
      // Atualizar perfil
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateFields }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Perfil atualizado com sucesso'
      });
    }
    
    // ROTA 3: Atualizar senha
    if (req.method === 'PUT' && action === 'password') {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
      }
      
      // Verificar se o usuário existe
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      // Verificar senha atual
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Senha atual incorreta' });
      }
      
      // Validar nova senha
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres' });
      }
      
      // Gerar hash da nova senha
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Atualizar senha
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            password: hashedPassword,
            updated_at: new Date()
          } 
        }
      );
      
      // Adicionar notificação sobre a alteração de senha
      await db.collection('notifications').insertOne({
        user_id: userId,
        title: 'Senha alterada',
        message: 'Sua senha foi alterada com sucesso.',
        type: 'info',
        notification_type: 'security',
        read: false,
        created_at: new Date()
      });
      
      return res.status(200).json({
        success: true,
        message: 'Senha atualizada com sucesso'
      });
    }
    
    // ROTA 4: Atualizar preferências do usuário
    if (req.method === 'PUT' && action === 'preferences') {
      const { notifications, theme, language } = req.body;
      
      // Verificar se as preferências já existem
      const existingPrefs = await db.collection('user_preferences').findOne({ user_id: userId });
      
      const preferencesData = {
        notifications: notifications || (existingPrefs?.notifications || { email: true, push: true }),
        theme: theme || existingPrefs?.theme || 'light',
        language: language || existingPrefs?.language || 'pt-BR',
        updated_at: new Date()
      };
      
      if (existingPrefs) {
        // Atualizar preferências existentes
        await db.collection('user_preferences').updateOne(
          { user_id: userId },
          { $set: preferencesData }
        );
      } else {
        // Criar novas preferências
        await db.collection('user_preferences').insertOne({
          user_id: userId,
          ...preferencesData,
          created_at: new Date()
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Preferências atualizadas com sucesso',
        preferences: preferencesData
      });
    }
    
    // ROTA 5: Solicitar verificação de e-mail
    if (req.method === 'POST' && action === 'verify-email') {
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      if (user.email_verified) {
        return res.status(400).json({ error: 'E-mail já foi verificado' });
      }
      
      // Gerar token de verificação (expira em 24 horas)
      const verificationToken = jwt.sign(
        { id: userId, email: user.email, type: 'email_verification' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Armazenar o token no banco de dados
      await db.collection('tokens').insertOne({
        user_id: userId,
        token: verificationToken,
        type: 'email_verification',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        created_at: new Date()
      });
      
      // Aqui seria o código para enviar o e-mail com o link de verificação
      // Normalmente utilizaria um serviço como SendGrid, Mailgun, etc.
      console.log(`Link de verificação: ${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`);
      
      return res.status(200).json({
        success: true,
        message: 'E-mail de verificação enviado com sucesso'
      });
    }
    
    // Se nenhuma rota corresponder
    return res.status(404).json({ error: 'Endpoint não encontrado' });
    
  } catch (error) {
    console.error('Erro na API de perfil:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 