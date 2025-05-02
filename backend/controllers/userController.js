const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const getDb = require('../services/database');
const asaasService = require('../services/asaasService');

// Chave secreta para JWT - idealmente em variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_jwt';

/**
 * Registra um novo usuário
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validações básicas
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e senha são obrigatórios'
      });
    }

    const db = await getDb();

    // Verificar se email já existe
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Criar cliente no Asaas
    const asaasCustomer = await asaasService.createCustomer({
      name,
      email
    });

    // Criar usuário no banco
    const newUser = {
      name,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      asaasCustomerId: asaasCustomer.id,
      subscription: {
        active: false,
        planType: 'FREE',
        expiresAt: null,
        asaasSubscriptionId: null
      }
    };

    const result = await db.collection('users').insertOne(newUser);

    // Gerar token JWT
    const token = jwt.sign(
      { id: result.insertedId.toString(), email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso',
      token,
      user: {
        id: result.insertedId.toString(),
        name,
        email,
        subscription: newUser.subscription
      }
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao registrar usuário',
      error: error.message
    });
  }
};

/**
 * Autentica um usuário
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validações básicas
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }

    const db = await getDb();

    // Buscar usuário
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar senha
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { id: user._id.toString(), email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        subscription: user.subscription || {
          active: false,
          planType: 'FREE'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao autenticar usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao autenticar usuário',
      error: error.message
    });
  }
};

/**
 * Retorna informações do usuário autenticado
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDb();

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Se a assinatura estiver para expirar, atualizar status
    if (user.subscription && user.subscription.expiresAt && new Date(user.subscription.expiresAt) < new Date()) {
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { 'subscription.active': false } }
      );
      user.subscription.active = false;
    }

    return res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        subscription: user.subscription || {
          active: false,
          planType: 'FREE'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao obter perfil do usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter perfil do usuário',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getProfile
}; 