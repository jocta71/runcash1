const { MongoClient, ObjectId } = require('mongodb');
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Verifica se um usuário tem uma assinatura ativa
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} - true se o usuário tem assinatura ativa
 */
async function hasActiveSubscription(userId) {
  const client = new MongoClient(url, { useUnifiedTopology: true });
  try {
    await client.connect();
    console.log(`[AUTH] Verificando assinatura para usuário ${userId}`);
    const db = client.db(dbName);
    
    // Buscar usuário para obter o customerId ou asaasCustomerId
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    // Se encontramos o usuário e ele tem customerId ou asaasCustomerId, verificamos por esse método
    if (user) {
      // Determinar qual campo usar para o ID do cliente
      const customerIdField = user.customerId ? 'customerId' : (user.asaasCustomerId ? 'asaasCustomerId' : null);
      const customerIdValue = user.customerId || user.asaasCustomerId;
      
      if (customerIdValue) {
        console.log(`[AUTH] Verificando assinatura para ${customerIdField} ${customerIdValue}`);
        
        // Buscar assinatura ativa pelo customerId ou asaasCustomerId
        const subscription = await db.collection('userSubscriptions').findOne({
          customerId: customerIdValue,
          status: 'active',
          pendingFirstPayment: false
        });
        
        if (subscription) {
          console.log(`[AUTH] Usuário ${userId} tem assinatura ativa pelo ${customerIdField}`);
          return true;
        }
      } else {
        console.log(`[AUTH] Usuário ${userId} não tem customerId/asaasCustomerId, verificando metadados alternativos`);
      }
    }
    
    // Método alternativo: verificar se há uma relação direta na coleção userSubscriptions ou users
    // 1. Verificar se há um documento na coleção userSubscriptions relacionado ao userId
    const userIdSubscription = await db.collection('userSubscriptions').findOne({
      userId: userId,  // Verifica se existe um campo userId que corresponda
      status: 'active',
      pendingFirstPayment: false
    });
    
    if (userIdSubscription) {
      console.log(`[AUTH] Usuário ${userId} tem assinatura ativa pelo userId`);
      return true;
    }
    
    // 2. Verificar se o próprio documento do usuário tem informações de assinatura
    if (user && user.subscriptionStatus === 'active' && user.pendingFirstPayment === false) {
      console.log(`[AUTH] Usuário ${userId} tem assinatura ativa no próprio documento de usuário`);
      return true;
    }
    
    // 3. Verificar via email (último recurso)
    if (user && user.email) {
      console.log(`[AUTH] Verificando assinatura pelo email ${user.email}`);
      
      // Buscar usuários com mesmo email que possam ter assinatura
      const relatedUsers = await db.collection('users').find({ 
        email: user.email,
        $or: [
          { customerId: { $exists: true } },
          { asaasCustomerId: { $exists: true } }
        ]
      }).toArray();
      
      for (const relatedUser of relatedUsers) {
        const relatedCustomerId = relatedUser.customerId || relatedUser.asaasCustomerId;
        if (relatedCustomerId) {
          const relatedUserSubscription = await db.collection('userSubscriptions').findOne({
            customerId: relatedCustomerId,
            status: 'active',
            pendingFirstPayment: false
          });
          
          if (relatedUserSubscription) {
            console.log(`[AUTH] Encontrada assinatura ativa pelo email em outro usuário: ${relatedUser._id}`);
            
            // Atualizar o customerId do usuário atual
            await db.collection('users').updateOne(
              { _id: new ObjectId(userId) },
              { $set: { 
                  customerId: relatedCustomerId,
                  asaasCustomerId: relatedCustomerId  // Garantir consistência
                } 
              }
            );
            
            console.log(`[AUTH] CustomerId/asaasCustomerId atualizado para o usuário ${userId}`);
            return true;
          }
        }
      }
    }
    
    console.log(`[AUTH] Não foi encontrada assinatura ativa para o usuário ${userId}`);
    return false;
  } catch (error) {
    console.error('[AUTH] Erro ao verificar assinatura:', error);
    return false;
  } finally {
    await client.close();
  }
}

/**
 * Middleware para verificar se o usuário tem uma assinatura ativa
 */
const checkSubscription = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      console.log('[AUTH] Tentativa de acesso sem autenticação');
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }
    
    const hasSubscription = await hasActiveSubscription(req.user.id);
    if (!hasSubscription) {
      console.log(`[AUTH] Acesso negado: Usuário ${req.user.id} não tem assinatura ativa`);
      return res.status(403).json({ 
        success: false, 
        message: 'Assinatura inativa ou pendente de pagamento',
        subscriptionRequired: true
      });
    }
    
    // Usuário tem assinatura ativa, permite prosseguir
    console.log(`[AUTH] Acesso permitido: Usuário ${req.user.id} tem assinatura ativa`);
    next();
  } catch (error) {
    console.error('[AUTH] Erro no middleware de verificação de assinatura:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
};

module.exports = { checkSubscription }; 