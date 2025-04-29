/**
 * Middleware para verificar assinaturas e controlar acesso a recursos
 * Especialmente útil para proteger a rota /api/roulettes
 */

const { MongoClient, ObjectId } = require('mongodb');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/runcash';

/**
 * Middleware para verificar se o usuário tem uma assinatura ativa
 * para acessar dados das roletas
 */
const verificarAssinaturaRoletas = async (req, res, next) => {
  // Pular verificação em desenvolvimento se definido
  if (process.env.SKIP_SUBSCRIPTION_CHECK === 'true') {
    console.log('[MiddlewareAssinatura] Verificação de assinatura ignorada (ambiente de desenvolvimento)');
    return next();
  }

  // Extrai o token de autorização
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Autenticação necessária para acessar dados das roletas',
      code: 'AUTH_REQUIRED'
    });
  }

  // Extrai o token do cabeçalho
  const token = authHeader.split(' ')[1];
  
  try {
    // Verificar se o token está no formato JWT decodificável
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return res.status(401).json({
        success: false, 
        message: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Decodificar payload do token
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const userId = payload.id || payload.userId || payload.sub;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Identificação do usuário não encontrada no token',
        code: 'INVALID_TOKEN'
      });
    }

    // Conectar ao MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();

    // Verificar se a assinatura existe e está ativa
    const subscription = await db.collection('subscriptions').findOne({
      user_id: userId.toString(),
      status: { $in: ['active', 'ACTIVE', 'ativa', 'ATIVA'] }
    });

    // Se não encontrou assinatura ativa
    if (!subscription) {
      await client.close();
      return res.status(403).json({
        success: false,
        message: 'Você precisa de uma assinatura ativa para acessar dados das roletas',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    // Verificar se a assinatura está expirada
    if (subscription.expirationDate && new Date(subscription.expirationDate) < new Date()) {
      await client.close();
      return res.status(403).json({
        success: false,
        message: 'Sua assinatura expirou. Por favor, renove sua assinatura para continuar acessando os dados',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Verificar se o plano da assinatura permite acesso às roletas
    // Aqui você pode implementar verificações específicas para diferentes planos
    
    // Adicionar informações da assinatura ao objeto de requisição
    req.subscription = subscription;
    req.userId = userId;
    
    // Registrar acesso à API de roletas
    await db.collection('api_access_logs').insertOne({
      user_id: userId,
      subscription_id: subscription._id.toString(),
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: new Date(),
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    });
    
    await client.close();
    next();
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar assinatura',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  verificarAssinaturaRoletas
}; 