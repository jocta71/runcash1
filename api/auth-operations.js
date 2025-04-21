/**
 * Endpoint unificado para operações de autenticação
 * Combina várias funções em uma única para economizar funções serverless
 * 
 * Operações suportadas:
 * - login: Autenticar usuário
 * - register: Registrar novo usuário
 * - verify-token: Verificar token de autenticação
 * - update-user: Atualizar dados do usuário
 * - reset-password: Iniciar processo de redefinição de senha
 * - change-password: Alterar senha do usuário
 */

// Importações
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient, ObjectId } = require('mongodb');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'seu_jwt_secret';
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'runcashh';

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Obter o tipo de operação da query ou body
  const operation = req.query.operation || (req.body && req.body.operation);
  
  if (!operation) {
    return res.status(400).json({
      success: false,
      error: 'Operação não especificada. Inclua o parâmetro "operation" na query ou body.'
    });
  }

  // Executar a operação correspondente
  try {
    switch (operation) {
      case 'login':
        return await loginUser(req, res);
      
      case 'register':
        return await registerUser(req, res);
      
      case 'verify-token':
        return await verifyToken(req, res);
      
      case 'update-user':
        return await updateUser(req, res);
      
      case 'reset-password':
        return await resetPassword(req, res);
      
      case 'change-password':
        return await changePassword(req, res);
      
      default:
        return res.status(400).json({
          success: false,
          error: `Operação "${operation}" não suportada.`
        });
    }
  } catch (error) {
    console.error(`Erro na operação ${operation}:`, error);
    
    return res.status(500).json({
      success: false,
      error: `Erro ao executar operação "${operation}"`,
      message: error.message
    });
  }
};

/**
 * Conectar ao banco de dados MongoDB
 */
async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI não definido');
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  
  return {
    client,
    db: client.db(DB_NAME)
  };
}

/**
 * Autenticar usuário (login)
 */
async function loginUser(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para login.'
    });
  }

  const { email, password } = req.body;

  // Validar campos obrigatórios
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email e senha são obrigatórios'
    });
  }

  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Buscar usuário pelo email
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: email.toLowerCase() });

    // Verificar se o usuário existe
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remover senha do objeto do usuário
    const userWithoutPassword = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      createdAt: user.createdAt,
      asaasCustomerId: user.asaasCustomerId || null
    };

    return res.status(200).json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante o login'
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Registrar novo usuário
 */
async function registerUser(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para registro.'
    });
  }

  const { name, email, password } = req.body;

  // Validar campos obrigatórios
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Nome, email e senha são obrigatórios'
    });
  }

  // Validar formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Email inválido'
    });
  }

  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    const usersCollection = db.collection('users');
    
    // Verificar se o email já está em uso
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email já está em uso'
      });
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Criar novo usuário
    const newUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(newUser);

    // Gerar token JWT
    const token = jwt.sign(
      { id: result.insertedId, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remover senha do objeto do usuário
    const userWithoutPassword = {
      id: result.insertedId.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt
    };

    return res.status(201).json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante o registro'
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Verificar token de autenticação
 */
async function verifyToken(req, res) {
  // Obter token do cabeçalho
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(' ')[1];

  // Verificar se o token foi fornecido
  if (!token) {
    token = req.query.token;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido'
      });
    }
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Conectar ao banco de dados
    let client;
    try {
      const dbConnection = await connectToDatabase();
      client = dbConnection.client;
      const db = dbConnection.db;
      
      // Buscar usuário pelo ID
      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(decoded.id) });

      // Verificar se o usuário existe
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Remover senha do objeto do usuário
      const userWithoutPassword = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        createdAt: user.createdAt,
        asaasCustomerId: user.asaasCustomerId || null
      };

      return res.status(200).json({
        success: true,
        user: userWithoutPassword
      });
    } finally {
      if (client) await client.close();
    }
  } catch (error) {
    console.error('Erro na verificação de token:', error);
    return res.status(401).json({
      success: false,
      error: 'Token inválido ou expirado'
    });
  }
}

/**
 * Atualizar dados do usuário
 */
async function updateUser(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para atualizar usuário.'
    });
  }

  // Obter token do cabeçalho
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  // Verificar se o token foi fornecido
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token não fornecido'
    });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Obter ID do usuário a ser atualizado e os dados a serem atualizados
    const { userId, ...updateData } = req.body;
    
    // Validar campos obrigatórios
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário é obrigatório'
      });
    }

    // Verificar permissão (apenas o próprio usuário ou admin pode atualizar)
    if (decoded.id !== userId && decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para atualizar este usuário'
      });
    }

    // Conectar ao banco de dados
    let client;
    try {
      const dbConnection = await connectToDatabase();
      client = dbConnection.client;
      const db = dbConnection.db;
      
      // Preparar dados de atualização
      const updatedFields = {
        ...updateData,
        updatedAt: new Date()
      };

      // Remover campos protegidos
      delete updatedFields.password;
      delete updatedFields.role;
      delete updatedFields._id;

      // Atualizar usuário
      const usersCollection = db.collection('users');
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updatedFields }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Usuário atualizado com sucesso'
      });
    } finally {
      if (client) await client.close();
    }
  } catch (error) {
    console.error('Erro na atualização do usuário:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante a atualização do usuário'
    });
  }
}

/**
 * Iniciar processo de redefinição de senha
 */
async function resetPassword(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para redefinir senha.'
    });
  }

  const { email } = req.body;

  // Validar campos obrigatórios
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email é obrigatório'
    });
  }

  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Buscar usuário pelo email
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: email.toLowerCase() });

    // Se o usuário não existir, ainda retornamos sucesso para não revelar informações
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Se o email estiver cadastrado, um link de redefinição será enviado'
      });
    }

    // Gerar token de redefinição de senha
    const resetToken = jwt.sign(
      { id: user._id, email: user.email, purpose: 'reset-password' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Salvar token no banco de dados
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          resetPasswordToken: resetToken,
          resetPasswordExpires: new Date(Date.now() + 3600000) // 1 hora
        } 
      }
    );

    // Na implementação real, enviar email com link para redefinição
    // Por enquanto, apenas retornamos o token para fins de teste
    return res.status(200).json({
      success: true,
      message: 'Se o email estiver cadastrado, um link de redefinição será enviado',
      // Remover em produção
      resetToken,
      resetLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/redefinir-senha?token=${resetToken}`
    });
  } catch (error) {
    console.error('Erro na redefinição de senha:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante a redefinição de senha'
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Alterar senha do usuário
 */
async function changePassword(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para alterar senha.'
    });
  }

  const { token, newPassword } = req.body;

  // Validar campos obrigatórios
  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Token e nova senha são obrigatórios'
    });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Validar propósito do token
    if (decoded.purpose !== 'reset-password') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido para alteração de senha'
      });
    }

    // Conectar ao banco de dados
    let client;
    try {
      const dbConnection = await connectToDatabase();
      client = dbConnection.client;
      const db = dbConnection.db;
      
      // Buscar usuário pelo ID
      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ 
        _id: new ObjectId(decoded.id),
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
      });

      // Verificar se o usuário existe e o token ainda é válido
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Token inválido ou expirado'
        });
      }

      // Hash da nova senha
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Atualizar senha e remover token de redefinição
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            password: hashedPassword,
            updatedAt: new Date()
          },
          $unset: {
            resetPasswordToken: '',
            resetPasswordExpires: ''
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
    } finally {
      if (client) await client.close();
    }
  } catch (error) {
    console.error('Erro na alteração de senha:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Erro no servidor durante a alteração de senha'
    });
  }
} 