const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

// Função para gerar token JWT
const generateToken = async (user) => {
  // Verificar se o usuário tem assinatura ativa
  const hasActiveSubscription = await Subscription.hasActiveSubscription(user._id);
  
  // Payload do token
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    hasActiveSubscription // Incluir no token se o usuário tem assinatura ativa
  };
  
  // Gerar token com validade definida nas variáveis de ambiente
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Registrar um novo usuário
exports.register = async (req, res) => {
  try {
    const { name, email, password, cpfCnpj, phone } = req.body;
    
    // Verificar se o usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Este email já está em uso'
      });
    }
    
    // Criar novo usuário
    const user = new User({
      name,
      email,
      password,
      cpfCnpj,
      phone
    });
    
    await user.save();
    
    // Gerar token
    const token = await generateToken(user);
    
    // Remover a senha do objeto de resposta
    user.password = undefined;
    
    res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro no servidor'
    });
  }
};

// Login de usuário
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Verificar se o email e senha foram informados
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }
    
    // Buscar usuário pelo email (incluindo o campo password que é select: false por padrão)
    const user = await User.findOne({ email }).select('+password');
    
    // Verificar se o usuário existe
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha inválidos'
      });
    }
    
    // Verificar se a senha está correta
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha inválidos'
      });
    }
    
    // Verificar se o usuário está ativo
    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: 'Sua conta está desativada. Entre em contato com o suporte.'
      });
    }
    
    // Gerar token
    const token = await generateToken(user);
    
    // Remover a senha do objeto de resposta
    user.password = undefined;
    
    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro no servidor'
    });
  }
};

// Obter dados do usuário atual
exports.getMe = async (req, res) => {
  try {
    const user = req.user;
    
    // Verificar se o usuário tem assinatura ativa
    const hasActiveSubscription = await Subscription.hasActiveSubscription(user._id);
    const activeSubscription = hasActiveSubscription 
      ? await Subscription.getActiveSubscription(user._id) 
      : null;
    
    res.status(200).json({
      success: true,
      data: {
        user,
        subscription: {
          active: hasActiveSubscription,
          details: activeSubscription
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter dados do usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro no servidor'
    });
  }
}; 