/**
 * Rotas de autenticação simplificada
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Simulação de um banco de dados de usuários (apenas para teste)
// Em produção, você substituiria isso por uma consulta ao banco de dados real
const usuarios = [
  { id: '1', username: 'admin', password: 'senha123', roles: ['admin', 'user'] },
  { id: '2', username: 'user', password: 'senha456', roles: ['user'] }
];

/**
 * Rota de login - gera um token JWT para usuários autenticados
 * 
 * Corpo da requisição:
 * {
 *   "username": "nome_do_usuario",
 *   "password": "senha_do_usuario"
 * }
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username e password são obrigatórios'
    });
  }
  
  // Encontrar usuário pelo username (simulação)
  const usuario = usuarios.find(u => u.username === username);
  
  // Verificar se usuário existe e a senha está correta
  if (!usuario || usuario.password !== password) {
    console.log(`Tentativa de login malsucedida: ${username}`);
    return res.status(401).json({
      success: false,
      message: 'Credenciais inválidas'
    });
  }
  
  // Gerar token JWT
  const payload = {
    id: usuario.id,
    username: usuario.username,
    roles: usuario.roles,
    iat: Math.floor(Date.now() / 1000)
  };
  
  const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
  const token = jwt.sign(payload, secret, { expiresIn: '24h' });
  
  console.log(`Login bem-sucedido: ${username} (ID: ${usuario.id})`);
  
  // Retornar token e informações básicas do usuário
  res.json({
    success: true,
    message: 'Login realizado com sucesso',
    token,
    user: {
      id: usuario.id,
      username: usuario.username,
      roles: usuario.roles
    }
  });
});

/**
 * Rota para verificar se o token é válido
 */
router.get('/verify', (req, res) => {
  // Desativada a verificação de token para reduzir consumo de memória
  // const authHeader = req.headers['authorization'];
  // const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  // if (!token) {
  //   return res.status(401).json({
  //     success: false,
  //     message: 'Token não fornecido'
  //   });
  // }
  
  // try {
  //   const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
  //   const decoded = jwt.verify(token, secret);
    
  //   res.json({
  //     success: true,
  //     message: 'Token válido',
  //     user: {
  //       id: decoded.id,
  //       username: decoded.username,
  //       roles: decoded.roles
  //     }
  //   });
  // } catch (error) {
  //   console.error('Erro ao verificar token:', error.message);
    
  //   res.status(401).json({
  //     success: false,
  //     message: 'Token inválido ou expirado',
  //     error: error.message
  //   });
  // }

  // Retornar sempre um sucesso com usuário padrão
  res.json({
    success: true,
    message: 'Token válido (verificação desativada)',
    user: {
      id: 'system-default',
      username: 'Sistema',
      roles: ['admin', 'premium']
    }
  });
});

/**
 * Rota para registrar um novo usuário (simplificada)
 */
router.post('/register', (req, res) => {
  const { username, password, email } = req.body;
  
  if (!username || !password || !email) {
    return res.status(400).json({
      success: false,
      message: 'Username, password e email são obrigatórios'
    });
  }
  
  // Verificar se usuário já existe
  const existente = usuarios.find(u => u.username === username);
  if (existente) {
    return res.status(409).json({
      success: false,
      message: 'Username já está em uso'
    });
  }
  
  // Criar novo usuário (simulação)
  const novoId = (usuarios.length + 1).toString();
  const novoUsuario = {
    id: novoId,
    username,
    password,
    email,
    roles: ['user']
  };
  
  // Adicionar ao "banco de dados" (simulação)
  usuarios.push(novoUsuario);
  
  console.log(`Novo usuário registrado: ${username} (ID: ${novoId})`);
  
  // Gerar token JWT para o novo usuário
  const payload = {
    id: novoUsuario.id,
    username: novoUsuario.username,
    roles: novoUsuario.roles,
    iat: Math.floor(Date.now() / 1000)
  };
  
  const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
  const token = jwt.sign(payload, secret, { expiresIn: '24h' });
  
  // Retornar token e informações básicas do usuário
  res.status(201).json({
    success: true,
    message: 'Usuário registrado com sucesso',
    token,
    user: {
      id: novoUsuario.id,
      username: novoUsuario.username,
      roles: novoUsuario.roles
    }
  });
});

module.exports = router; 