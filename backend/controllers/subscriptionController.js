const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const SubscriptionKey = require('../models/subscriptionKeyModel');
const User = require('../models/userModel');

// Configuração do banco de dados
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = "runcash";

// Cliente MongoDB
let client;
let db;

// Inicializar conexão com o banco de dados
async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('[SubscriptionController] Conectado ao MongoDB');
  }
  return { client, db };
}

/**
 * Gerar uma nova chave de acesso para o usuário
 */
const generateAccessKey = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Autenticação necessária para gerar uma chave de acesso"
      });
    }
    
    const userId = req.user.id;
    
    // Conectar ao banco de dados
    const { db } = await connectToDatabase();
    
    // Verificar se o usuário tem uma assinatura ativa
    const subscription = await db.collection('subscriptions').findOne({ 
      userId: userId,
      status: 'active'
    });
    
    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Você precisa ter uma assinatura ativa para obter uma chave de acesso"
      });
    }
    
    // Gerar nova chave de acesso
    const accessKey = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 dias
    
    // Salvar a chave no banco de dados
    await db.collection('accessKeys').updateOne(
      { userId: userId },
      { 
        $set: {
          key: accessKey,
          createdAt: now,
          expiresAt: expiresAt,
          active: true
        }
      },
      { upsert: true }
    );
    
    console.log(`[AccessKey] Nova chave gerada para o usuário: ${userId}`);
    
    // Retornar a chave para o usuário
    return res.json({
      success: true,
      accessKey: accessKey,
      expiresAt: expiresAt.getTime()
    });
  } catch (error) {
    console.error('[AccessKey] Erro ao gerar chave de acesso:', error);
    return res.status(500).json({
      success: false,
      message: "Erro ao gerar chave de acesso"
    });
  }
};

/**
 * Verificar o status da assinatura do usuário
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Autenticação necessária para verificar o status da assinatura"
      });
    }
    
    const userId = req.user.id;
    
    // Conectar ao banco de dados
    const { db } = await connectToDatabase();
    
    // Buscar a assinatura do usuário
    const subscription = await db.collection('subscriptions').findOne({ userId: userId });
    
    if (!subscription) {
      return res.json({
        success: true,
        subscription: null
      });
    }
    
    // Retornar informações sobre a assinatura
    return res.json({
      success: true,
      subscription: {
        status: subscription.status,
        plan: subscription.plan,
        expiresAt: subscription.expiresAt
      }
    });
  } catch (error) {
    console.error('[Subscription] Erro ao verificar status da assinatura:', error);
    return res.status(500).json({
      success: false,
      message: "Erro ao verificar status da assinatura"
    });
  }
};

/**
 * Verificar se o usuário tem uma chave de acesso válida
 */
const verifyAccessKey = async (accessKey) => {
  try {
    // Conectar ao banco de dados
    const { db } = await connectToDatabase();
    
    // Buscar a chave no banco de dados
    const keyDoc = await db.collection('accessKeys').findOne({
      key: accessKey,
      active: true,
      expiresAt: { $gt: new Date() }
    });
    
    return !!keyDoc; // Retorna true se a chave for encontrada e estiver válida
  } catch (error) {
    console.error('[AccessKey] Erro ao verificar chave:', error);
    return false;
  }
};

/**
 * Revoga uma chave de acesso
 * @route   DELETE /api/subscription/access-key
 * @access  Privado
 */
const revokeAccessKey = async (req, res) => {
    try {
        // Verificar se o usuário existe
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado' 
            });
        }
        
        // Remover a chave de acesso do usuário
        await SubscriptionKey.findOneAndDelete({ userId: req.user._id });
        
        res.json({
            success: true,
            message: 'Chave de acesso revogada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao revogar chave de acesso:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao revogar a chave de acesso' 
        });
    }
};

module.exports = {
  generateAccessKey,
  getSubscriptionStatus,
  verifyAccessKey,
  revokeAccessKey
}; 