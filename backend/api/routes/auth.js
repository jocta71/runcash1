const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const passport = require('../config/passport');

// Verificar se as credenciais do Google estão disponíveis
const isGoogleAuthEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// @desc    Registrar novo usuário
// @route   POST /api/auth/register
// @access  Público
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, useCookies } = req.body;

    // Verificar se o usuário já existe
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Usuário ou email já cadastrado'
      });
    }

    // Criar novo usuário
    const user = await User.create({
      username,
      email,
      password
    });

    // Gerar token JWT
    sendTokenResponse(user, 201, res, useCookies);
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar solicitação'
    });
  }
});

// @desc    Login de usuário
// @route   POST /api/auth/login
// @access  Público
router.post('/login', async (req, res) => {
  try {
    const { email, password, useCookies } = req.body;

    // Validar email e senha
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, forneça email e senha'
      });
    }

    // Verificar se o usuário existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Verificar se a senha está correta
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Atualizar último login
    user.lastLogin = Date.now();
    await user.save();

    // Gerar token JWT e retornar resposta
    sendTokenResponse(user, 200, res, useCookies);
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar solicitação'
    });
  }
});

// Rotas de autenticação Google
if (isGoogleAuthEnabled) {
  // @desc    Iniciar autenticação com Google
  // @route   GET /api/auth/google
  // @access  Público
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  // @desc    Callback para autenticação Google
  // @route   GET /api/auth/google/callback
  // @access  Público
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
      // Gerar token JWT após autenticação bem-sucedida
      const token = generateToken(req.user);
      
      // Configurar cookie de autenticação
      const cookieOptions = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        httpOnly: true,
        path: '/',
        sameSite: 'none',
        secure: true
      };
      
      // Definir o cookie
      res.cookie('token', token, cookieOptions);
      
      // Log para depuração
      console.log('Autenticação Google bem-sucedida, token gerado:', token.substring(0, 15) + '...');
      console.log('Definindo cookie com as seguintes opções:', {
        ...cookieOptions,
        expires: cookieOptions.expires.toISOString()
      });
      
      // Redirecionar para o frontend com token na URL (para o frontend pegar e armazenar manualmente)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log('Redirecionando para:', `${frontendUrl}?google_token=${token}`);
      res.redirect(`${frontendUrl}?google_token=${token}`);
    }
  );
} else {
  // Rota alternativa quando Google Auth não está configurado
  router.get('/google', (req, res) => {
    res.status(501).json({
      success: false,
      error: 'Autenticação Google não está configurada neste servidor'
    });
  });
  
  router.get('/google/callback', (req, res) => {
    res.redirect('/login?error=google_auth_disabled');
  });
}

// @desc    Obter usuário atual
// @route   GET /api/auth/me
// @access  Privado
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar solicitação'
    });
  }
});

// @desc    Logout de usuário (limpar cookie)
// @route   GET /api/auth/logout
// @access  Privado
router.get('/logout', (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/'
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Verificar status da autenticação Google
// @route   GET /api/auth/google/status
// @access  Público
router.get('/google/status', (req, res) => {
  res.json({
    enabled: isGoogleAuthEnabled
  });
});

// Função auxiliar para gerar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      role: user.isAdmin ? 'admin' : 'user'
    },
    process.env.JWT_SECRET || 'runcash-default-secret',
    { 
      expiresIn: '30d' 
    }
  );
};

// Função auxiliar para criar e enviar token JWT
const sendTokenResponse = (user, statusCode, res, useCookies = true) => {
  // Criar token
  const token = generateToken(user);

  // Preparar a resposta
  const responseData = {
    success: true,
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      profilePicture: user.profilePicture,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      googleId: user.googleId,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }
  };

  // Se o cliente solicitar explicitamente cookies, ou estiver em produção
  if (useCookies || process.env.USE_HTTPONLY_COOKIES === 'true') {
    const cookieOptions = {
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      httpOnly: true,
      path: '/',
      sameSite: 'none', // Permitir cookies em requisições cross-origin
      secure: true // Necessário quando sameSite é 'none'
    };

    // Log para depuração
    console.log('Configurando cookie de autenticação:', {
      token: token.substring(0, 10) + '...',
      options: {
        ...cookieOptions,
        expires: cookieOptions.expires.toISOString()
      }
    });

    // Indicar ao frontend que configuramos um cookie HttpOnly
    res.setHeader('x-auth-cookie-set', 'true');

    // Enviar resposta com cookie
    return res
      .status(statusCode)
      .cookie('token', token, cookieOptions)
      .json(responseData);
  }

  // Resposta sem cookie (apenas token no corpo da resposta)
  return res.status(statusCode).json(responseData);
};

module.exports = router; 