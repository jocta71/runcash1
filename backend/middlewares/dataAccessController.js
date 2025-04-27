/**
 * Middleware para controlar acesso aos dados das roletas com base na assinatura
 * @author RunCash
 */

const { ObjectId } = require('mongodb');
const getDb = require('../services/database');

/**
 * Middleware para controlar acesso aos dados das roletas
 * Usuários sem assinatura receberão dados limitados
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.controlDataAccess = async (req, res, next) => {
  try {
    // Flag para marcar se o usuário tem assinatura ativa
    req.hasActiveSubscription = false;
    
    // Flag para indicar o tipo de plano
    req.planType = null;
    
    // Verificar se o usuário está autenticado
    if (!req.user && !req.usuario) {
      // Usuário não autenticado, continuar para fornecer dados limitados
      req.dataAccessLevel = 'anonymous';
      return next();
    }
    
    const userId = req.user?.id || req.usuario?.id;
    
    // Buscar assinatura ativa no banco de dados
    const db = await getDb();
    const userSubscription = await db.collection('subscriptions').findOne({
      user_id: userId,
      status: { $in: ['active', 'ACTIVE', 'ativa'] },
      expirationDate: { $gt: new Date() }
    });
    
    // Se não encontrar assinatura no formato das collections, tentar o modelo mongoose
    if (!userSubscription) {
      // Verificar em modelos mongoose se não encontrou na collection
      const assinatura = await db.collection('assinaturas').findOne({
        usuario: ObjectId.isValid(userId) ? new ObjectId(userId) : userId,
        status: 'ativa',
        validade: { $gt: new Date() }
      });
      
      if (!assinatura) {
        // Usuário autenticado mas sem assinatura ativa
        req.dataAccessLevel = 'authenticated';
        return next();
      }
      
      // Usuário tem assinatura ativa
      req.hasActiveSubscription = true;
      req.dataAccessLevel = 'premium';
      req.planType = assinatura.plano;
      req.assinatura = assinatura;
      return next();
    }
    
    // Verificar se a assinatura está expirada
    if (userSubscription.expirationDate && new Date(userSubscription.expirationDate) < new Date()) {
      // Assinatura expirada
      req.dataAccessLevel = 'authenticated';
      return next();
    }
    
    // Usuário tem assinatura ativa
    req.hasActiveSubscription = true;
    req.dataAccessLevel = 'premium';
    req.planType = userSubscription.plan_id;
    req.subscription = userSubscription;
    return next();
  } catch (error) {
    console.error('Erro ao verificar acesso aos dados:', error);
    // Em caso de erro, fornecer dados limitados por segurança
    req.dataAccessLevel = 'error';
    return next();
  }
};

/**
 * Função para limitar os dados retornados com base no nível de acesso
 * @param {Array|Object} data - Dados a serem filtrados
 * @param {String} accessLevel - Nível de acesso do usuário
 * @returns {Array|Object} - Dados filtrados conforme nível de acesso
 */
exports.filterDataByAccessLevel = (data, accessLevel) => {
  // Se não houver dados, retornar como está
  if (!data) return data;
  
  // Se for um array (como lista de roletas)
  if (Array.isArray(data)) {
    // Se for um usuário premium, retornar todos os dados
    if (accessLevel === 'premium') {
      return data;
    }
    
    // Para outros níveis, limitar os dados
    const limitItems = accessLevel === 'authenticated' ? 3 : 1;
    const limitedItems = data.slice(0, limitItems);
    
    return limitedItems.map(item => {
      const limitedItem = {
        id: item.id,
        nome: item.nome,
        status: item.status,
        amostra: true
      };
      
      // Para usuários autenticados, incluir alguns números para amostra
      if (accessLevel === 'authenticated' && item.numero && Array.isArray(item.numero)) {
        limitedItem.numero = item.numero.slice(0, 3);
      }
      
      // Para não autenticados, incluir apenas o último número
      if (accessLevel === 'anonymous' && item.numero && Array.isArray(item.numero)) {
        limitedItem.numero = item.numero.slice(0, 1);
      }
      
      return limitedItem;
    });
  }
  
  // Se for um objeto (como uma única roleta)
  if (typeof data === 'object' && data !== null) {
    // Para usuários premium, retornar todos os dados
    if (accessLevel === 'premium') {
      return data;
    }
    
    // Para outros usuários, retornar versão limitada
    const limitedData = {
      id: data.id,
      nome: data.nome,
      status: data.status,
      amostra: true,
      mensagem: "Assine um plano para acessar dados completos"
    };
    
    // Diferentes níveis de acesso recebem diferentes quantidades de dados
    if (accessLevel === 'authenticated' && data.numero) {
      limitedData.numero = Array.isArray(data.numero) ? 
        data.numero.slice(0, 3) : data.numero;
    } else if (data.numero) {
      limitedData.numero = Array.isArray(data.numero) ? 
        data.numero.slice(0, 1) : data.numero;
    }
    
    return limitedData;
  }
  
  // Para outros tipos de dados, retornar como está
  return data;
}; 