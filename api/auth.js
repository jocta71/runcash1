const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const config = require('../config');

// Função para definir cabeçalhos CORS
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

// Cliente MongoDB
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!config.db.uri) {
    throw new Error('MONGODB_URI não está definido');
  }

  const client = new MongoClient(config.db.uri, config.db.options);
  await client.connect();
  
  const db = client.db();
  
  cachedClient = client;
  cachedDb = db;
  
  return { client, db };
}

// Funções de utilitário para hashing e verificação de senha
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// Funções para geração e verificação de tokens JWT
function generateToken(userId, email, role = 'user') {
  return jwt.sign(
    { id: userId, email, role },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    return null;
  }
}

// Configuração e funções para envio de e-mails
let transporter = null;

function getEmailTransporter() {
  if (transporter) return transporter;
  
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.auth.user,
      pass: config.email.auth.pass,
    },
  });
  
  return transporter;
}

async function sendEmail(to, subject, html) {
  const transport = getEmailTransporter();
  
  const mailOptions = {
    from: config.email.from,
    to,
    subject,
    html,
  };
  
  return transport.sendMail(mailOptions);
}

// Funções para validação de dados
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateRegistrationData(data) {
  const errors = {};
  
  if (!data.nome || data.nome.trim().length < 2) {
    errors.nome = 'Nome deve ter pelo menos 2 caracteres';
  }
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.email = 'Email inválido';
  }
  
  if (!data.senha || data.senha.length < 6) {
    errors.senha = 'Senha deve ter pelo menos 6 caracteres';
  }
  
  if (data.senha !== data.confirmarSenha) {
    errors.confirmarSenha = 'Senhas não coincidem';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// Função principal para lidar com as requisições
module.exports = async (req, res) => {
  // Verificar método OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }
  
  setCorsHeaders(res);
  
  // Extrair a rota da URL da requisição
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname.replace('/api/auth', '').replace(/^\/+|\/+$/g, '') || 'default';
  
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection(config.db.collections.users);
    
    // Roteamento com base no endpoint e método
    switch (true) {
      // Login de usuário
      case route === 'login' && req.method === 'POST': {
        const { email, senha } = req.body;
        
        if (!email || !senha) {
          return res.status(400).json({ 
            success: false, 
            message: 'Email e senha são obrigatórios' 
          });
        }
        
        const user = await usersCollection.findOne({ email });
        
        if (!user) {
          return res.status(400).json({ 
            success: false, 
            message: 'Credenciais inválidas' 
          });
        }
        
        const isMatch = await verifyPassword(senha, user.senha);
        
        if (!isMatch) {
          return res.status(400).json({ 
            success: false, 
            message: 'Credenciais inválidas' 
          });
        }
        
        if (!user.verificado) {
          return res.status(400).json({ 
            success: false, 
            message: 'Conta não verificada. Por favor, verifique seu email.' 
          });
        }
        
        const token = generateToken(user._id.toString(), user.email, user.role || 'user');
        
        return res.status(200).json({
          success: true,
          token,
          user: {
            id: user._id,
            nome: user.nome,
            email: user.email,
            role: user.role || 'user',
            createdAt: user.createdAt,
          },
        });
      }
      
      // Registro de novo usuário
      case route === 'registro' && req.method === 'POST': {
        const userData = req.body;
        
        const validation = validateRegistrationData(userData);
        
        if (!validation.isValid) {
          return res.status(400).json({ 
            success: false, 
            errors: validation.errors 
          });
        }
        
        // Verificar se o email já existe
        const existingUser = await usersCollection.findOne({ email: userData.email });
        
        if (existingUser) {
          return res.status(400).json({ 
            success: false, 
            message: 'Este email já está em uso' 
          });
        }
        
        // Criar token de verificação
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + config.auth.emailVerificationTime);
        
        // Criar novo usuário
        const hashedPassword = await hashPassword(userData.senha);
        
        const newUser = {
          nome: userData.nome,
          email: userData.email,
          senha: hashedPassword,
          role: 'user',
          verificado: false,
          verificationToken,
          verificationExpires,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const result = await usersCollection.insertOne(newUser);
        
        // Enviar email de verificação
        const verificationUrl = `${config.app.url}/verificar-email?token=${verificationToken}`;
        
        const htmlContent = `
          <h1>Bem-vindo ao ${config.app.name}!</h1>
          <p>Olá ${userData.nome},</p>
          <p>Obrigado por se registrar. Por favor, clique no link abaixo para verificar seu email:</p>
          <p><a href="${verificationUrl}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Verificar Email</a></p>
          <p>Ou copie e cole o seguinte link no seu navegador:</p>
          <p>${verificationUrl}</p>
          <p>Este link expira em 24 horas.</p>
          <p>Atenciosamente,<br />Equipe ${config.app.name}</p>
        `;
        
        await sendEmail(
          userData.email,
          `Verificação de Email - ${config.app.name}`,
          htmlContent
        );
        
        return res.status(201).json({
          success: true,
          message: 'Usuário registrado com sucesso. Verifique seu email para ativar sua conta.',
          userId: result.insertedId,
        });
      }
      
      // Verificação de email
      case route === 'verificar-email' && req.method === 'GET': {
        const { token } = req.query;
        
        if (!token) {
          return res.status(400).json({ 
            success: false, 
            message: 'Token de verificação não fornecido' 
          });
        }
        
        const user = await usersCollection.findOne({
          verificationToken: token,
          verificationExpires: { $gt: new Date() },
        });
        
        if (!user) {
          return res.status(400).json({ 
            success: false, 
            message: 'Token de verificação inválido ou expirado' 
          });
        }
        
        // Atualizar usuário como verificado
        await usersCollection.updateOne(
          { _id: user._id },
          {
            $set: {
              verificado: true,
              updatedAt: new Date(),
            },
            $unset: {
              verificationToken: "",
              verificationExpires: "",
            },
          }
        );
        
        return res.status(200).json({
          success: true,
          message: 'Email verificado com sucesso. Agora você pode fazer login.',
        });
      }
      
      // Solicitação de redefinição de senha
      case route === 'recuperar-senha' && req.method === 'POST': {
        const { email } = req.body;
        
        if (!email || !isValidEmail(email)) {
          return res.status(400).json({ 
            success: false, 
            message: 'Email válido é obrigatório' 
          });
        }
        
        const user = await usersCollection.findOne({ email });
        
        // Não revelar se o email existe ou não por razões de segurança
        if (!user) {
          return res.status(200).json({
            success: true,
            message: 'Se o email existir, enviaremos instruções para redefinir sua senha.',
          });
        }
        
        // Gerar token de redefinição de senha
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + config.auth.passwordResetTime);
        
        await usersCollection.updateOne(
          { _id: user._id },
          {
            $set: {
              resetToken,
              resetExpires,
              updatedAt: new Date(),
            },
          }
        );
        
        // Enviar email com instruções
        const resetUrl = `${config.app.url}/redefinir-senha?token=${resetToken}`;
        
        const htmlContent = `
          <h1>Redefinição de Senha - ${config.app.name}</h1>
          <p>Olá ${user.nome},</p>
          <p>Você solicitou a redefinição de sua senha. Clique no botão abaixo para definir uma nova senha:</p>
          <p><a href="${resetUrl}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Redefinir Senha</a></p>
          <p>Ou copie e cole o seguinte link no seu navegador:</p>
          <p>${resetUrl}</p>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou esta redefinição, por favor ignore este email.</p>
          <p>Atenciosamente,<br />Equipe ${config.app.name}</p>
        `;
        
        await sendEmail(
          user.email,
          `Redefinição de Senha - ${config.app.name}`,
          htmlContent
        );
        
        return res.status(200).json({
          success: true,
          message: 'Se o email existir, enviaremos instruções para redefinir sua senha.',
        });
      }
      
      // Redefinir senha
      case route === 'redefinir-senha' && req.method === 'POST': {
        const { token, novaSenha, confirmarSenha } = req.body;
        
        if (!token) {
          return res.status(400).json({ 
            success: false, 
            message: 'Token de redefinição não fornecido' 
          });
        }
        
        if (!novaSenha || novaSenha.length < 6) {
          return res.status(400).json({ 
            success: false, 
            message: 'A nova senha deve ter pelo menos 6 caracteres' 
          });
        }
        
        if (novaSenha !== confirmarSenha) {
          return res.status(400).json({ 
            success: false, 
            message: 'As senhas não coincidem' 
          });
        }
        
        const user = await usersCollection.findOne({
          resetToken: token,
          resetExpires: { $gt: new Date() },
        });
        
        if (!user) {
          return res.status(400).json({ 
            success: false, 
            message: 'Token de redefinição inválido ou expirado' 
          });
        }
        
        // Atualizar senha
        const hashedPassword = await hashPassword(novaSenha);
        
        await usersCollection.updateOne(
          { _id: user._id },
          {
            $set: {
              senha: hashedPassword,
              updatedAt: new Date(),
            },
            $unset: {
              resetToken: "",
              resetExpires: "",
            },
          }
        );
        
        return res.status(200).json({
          success: true,
          message: 'Senha redefinida com sucesso. Agora você pode fazer login com sua nova senha.',
        });
      }
      
      // Verificação de token
      case route === 'verificar-token' && req.method === 'GET': {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ 
            success: false, 
            message: 'Não autorizado. Token não fornecido.' 
          });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        
        if (!decoded) {
          return res.status(401).json({ 
            success: false, 
            message: 'Token inválido ou expirado' 
          });
        }
        
        // Verificar se o usuário ainda existe
        const user = await usersCollection.findOne({ _id: decoded.id });
        
        if (!user) {
          return res.status(401).json({ 
            success: false, 
            message: 'Usuário não encontrado' 
          });
        }
        
        return res.status(200).json({
          success: true,
          user: {
            id: user._id,
            nome: user.nome,
            email: user.email,
            role: user.role || 'user',
          },
        });
      }
      
      // Atualizar perfil do usuário
      case route === 'perfil' && req.method === 'PUT': {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ 
            success: false, 
            message: 'Não autorizado. Token não fornecido.' 
          });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        
        if (!decoded) {
          return res.status(401).json({ 
            success: false, 
            message: 'Token inválido ou expirado' 
          });
        }
        
        const { nome, senhaAtual, novaSenha, confirmarSenha } = req.body;
        const updateData = {};
        const errors = {};
        
        // Atualizar nome se fornecido
        if (nome !== undefined) {
          if (nome.trim().length < 2) {
            errors.nome = 'Nome deve ter pelo menos 2 caracteres';
          } else {
            updateData.nome = nome;
          }
        }
        
        // Atualizar senha se fornecida
        if (senhaAtual && novaSenha) {
          // Verificar senha atual
          const user = await usersCollection.findOne({ _id: decoded.id });
          
          if (!user) {
            return res.status(404).json({ 
              success: false, 
              message: 'Usuário não encontrado' 
            });
          }
          
          const isMatch = await verifyPassword(senhaAtual, user.senha);
          
          if (!isMatch) {
            errors.senhaAtual = 'Senha atual incorreta';
          }
          
          if (novaSenha.length < 6) {
            errors.novaSenha = 'A nova senha deve ter pelo menos 6 caracteres';
          }
          
          if (novaSenha !== confirmarSenha) {
            errors.confirmarSenha = 'As senhas não coincidem';
          }
          
          if (!errors.senhaAtual && !errors.novaSenha && !errors.confirmarSenha) {
            updateData.senha = await hashPassword(novaSenha);
          }
        }
        
        // Verificar se há erros
        if (Object.keys(errors).length > 0) {
          return res.status(400).json({ 
            success: false, 
            errors 
          });
        }
        
        // Verificar se há dados para atualizar
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Nenhum dado válido fornecido para atualização' 
          });
        }
        
        updateData.updatedAt = new Date();
        
        // Atualizar usuário
        await usersCollection.updateOne(
          { _id: decoded.id },
          { $set: updateData }
        );
        
        return res.status(200).json({
          success: true,
          message: 'Perfil atualizado com sucesso',
        });
      }

      // Obter dados do usuário
      case route === 'me' && req.method === 'GET': {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ 
            success: false, 
            message: 'Não autorizado. Token não fornecido.' 
          });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        
        if (!decoded) {
          return res.status(401).json({ 
            success: false, 
            message: 'Token inválido ou expirado' 
          });
        }
        
        const user = await usersCollection.findOne({ _id: decoded.id });
        
        if (!user) {
          return res.status(404).json({ 
            success: false, 
            message: 'Usuário não encontrado' 
          });
        }
        
        return res.status(200).json({
          success: true,
          user: {
            id: user._id,
            nome: user.nome,
            email: user.email,
            role: user.role || 'user',
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        });
      }
      
      // Rota não encontrada
      default:
        return res.status(404).json({ 
          success: false, 
          message: 'Rota não encontrada' 
        });
    }
  } catch (error) {
    console.error('Erro no serviço de autenticação:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: config.app.environment === 'development' ? error.message : undefined,
    });
  }
}; 