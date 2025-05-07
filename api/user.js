const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Middleware para CORS
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Endpoint para atualizar usuário
router.put('/update', async (req, res) => {
  if (req.method !== 'PUT') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  try {
    const { userId, asaasCustomerId, subscriptionData } = req.body;

    // Validar campos obrigatórios
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'ID do usuário é obrigatório' 
      });
    }

    // Validar pelo menos um campo para atualização
    if (!asaasCustomerId && !subscriptionData) {
      return res.status(400).json({ 
        success: false,
        error: 'Pelo menos um campo para atualização deve ser fornecido' 
      });
    }

    // Conectar ao MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      return res.status(500).json({ 
        success: false,
        error: 'URI do MongoDB não configurada' 
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    const usersCollection = db.collection('users');
    
    // Preparar dados para atualização
    const updateData = {};
    
    if (asaasCustomerId) {
      updateData.asaasCustomerId = asaasCustomerId;
    }
    
    if (subscriptionData) {
      // Campo para armazenar o histórico de assinaturas
      if (!updateData.$push) {
        updateData.$push = {};
      }
      
      // Adicionar data de criação ao histórico
      const subscriptionWithTimestamp = {
        ...subscriptionData,
        createdAt: new Date()
      };
      
      updateData.$push.subscriptions = subscriptionWithTimestamp;
      
      // Atualizar informações atuais da assinatura
      updateData.currentSubscription = subscriptionWithTimestamp;
      updateData.hasActiveSubscription = 
        subscriptionData.status === 'ACTIVE' || 
        subscriptionData.status === 'active';
    }
    
    // Adicionar timestamp da atualização
    updateData.updatedAt = new Date();
    
    // Executar a atualização
    const result = await usersCollection.updateOne(
      { _id: userId },
      { $set: updateData }
    );
    
    // Verificar se o usuário foi encontrado
    if (result.matchedCount === 0) {
      await client.close();
      return res.status(404).json({ 
        success: false,
        error: 'Usuário não encontrado' 
      });
    }
    
    // Buscar o usuário atualizado
    const updatedUser = await usersCollection.findOne({ _id: userId });
    
    // Fechar conexão
    await client.close();
    
    // Remover campos sensíveis
    if (updatedUser) {
      delete updatedUser.password;
      delete updatedUser.passwordHash;
      delete updatedUser.passwordSalt;
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar usuário',
      message: error.message
    });
  }
});

// Endpoint para verificar status da assinatura do usuário
router.get('/subscription-status', async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }
  
  try {
    const { userId } = req.query;
    
    // Validar campos obrigatórios
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'ID do usuário é obrigatório' 
      });
    }
    
    // Conectar ao MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      return res.status(500).json({ 
        success: false,
        error: 'URI do MongoDB não configurada' 
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    const usersCollection = db.collection('users');
    
    // Buscar o usuário
    const user = await usersCollection.findOne(
      { _id: userId },
      { projection: { currentSubscription: 1, hasActiveSubscription: 1, asaasCustomerId: 1 } }
    );
    
    // Fechar conexão
    await client.close();
    
    // Verificar se o usuário foi encontrado
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuário não encontrado' 
      });
    }
    
    return res.status(200).json({ 
      success: true,
      subscriptionStatus: {
        hasActiveSubscription: user.hasActiveSubscription || false,
        currentSubscription: user.currentSubscription || null,
        asaasCustomerId: user.asaasCustomerId || null
      }
    });
    
  } catch (error) {
    console.error('Erro ao verificar status da assinatura:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao verificar status da assinatura',
      message: error.message
    });
  }
});

module.exports = router; 