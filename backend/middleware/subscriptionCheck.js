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
      console.log(`[AUTH] Usuário encontrado: ${user.email}`);
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
          
          // Garantir que a assinatura tenha o userId
          if (!subscription.userId) {
            await db.collection('userSubscriptions').updateOne(
              { _id: subscription._id },
              { $set: { userId: userId } }
            );
            console.log(`[AUTH] Atualizado userId na assinatura ${subscription._id}`);
          }
          
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
      
      // Atualizar o usuário com o customerId correto, se necessário
      if (userIdSubscription.customerId && user) {
        const needsUpdate = user.customerId !== userIdSubscription.customerId && 
                            user.asaasCustomerId !== userIdSubscription.customerId;
                            
        if (needsUpdate) {
          await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { 
                customerId: userIdSubscription.customerId,
                asaasCustomerId: userIdSubscription.customerId 
              } 
            }
          );
          console.log(`[AUTH] Atualizado customerId do usuário para ${userIdSubscription.customerId}`);
        }
      }
      
      return true;
    }
    
    // 2. Verificar se o próprio documento do usuário tem informações de assinatura
    if (user && user.subscriptionStatus === 'active' && user.pendingFirstPayment === false) {
      console.log(`[AUTH] Usuário ${userId} tem assinatura ativa no próprio documento de usuário`);
      return true;
    }
    
    // 3. VERIFICAÇÃO ADICIONAL: Verificar se existem assinaturas ativas no sistema para o email do usuário
    if (user && user.email) {
      console.log(`[AUTH] Verificando assinaturas ativas para o email ${user.email}`);
      
      // Buscar todos os usuários com esse mesmo email
      const usersWithSameEmail = await db.collection('users').find({
        email: user.email
      }).toArray();
      
      console.log(`[AUTH] Encontrados ${usersWithSameEmail.length} usuários com o email ${user.email}`);
      
      // Extrair todos os customerIds de usuários com mesmo email
      const relatedCustomerIds = usersWithSameEmail
        .map(u => u.customerId || u.asaasCustomerId)
        .filter(id => !!id); // Remover valores nulos/undefined
      
      if (relatedCustomerIds.length > 0) {
        console.log(`[AUTH] CustomerIds encontrados para o email: ${relatedCustomerIds.join(', ')}`);
        
        // Verificar se alguma assinatura ativa tem algum desses customerIds
        for (const customerId of relatedCustomerIds) {
          const subscription = await db.collection('userSubscriptions').findOne({
            customerId: customerId,
            status: 'active',
            pendingFirstPayment: false
          });
          
          if (subscription) {
            console.log(`[AUTH] Encontrada assinatura ativa para customerId ${customerId} relacionado ao email ${user.email}`);
            
            // Atualizar o usuário com este customerId
            await db.collection('users').updateOne(
              { _id: new ObjectId(userId) },
              { $set: { 
                  customerId: customerId,
                  asaasCustomerId: customerId 
                } 
              }
            );
            
            // Atualizar a assinatura com o userId
            if (!subscription.userId) {
              await db.collection('userSubscriptions').updateOne(
                { _id: subscription._id },
                { $set: { userId: userId } }
              );
              console.log(`[AUTH] Vinculado userId ${userId} à assinatura ${subscription._id}`);
            }
            
            console.log(`[AUTH] CustomerId atualizado para o usuário ${userId}`);
            return true;
          }
        }
      }
      
      // 4. Verificação especial: buscar qualquer assinatura ativa e verificar se pode ser associada
      console.log(`[AUTH] Verificando todas as assinaturas ativas no sistema`);
      
      // Buscar todas as assinaturas ativas sem vínculo a usuário
      const activeUnlinkedSubscriptions = await db.collection('userSubscriptions')
        .find({ 
          status: 'active',
          pendingFirstPayment: false,
          userId: { $exists: false }
        })
        .limit(10) // Limitar para evitar processamento excessivo
        .toArray();
      
      console.log(`[AUTH] Encontradas ${activeUnlinkedSubscriptions.length} assinaturas ativas sem vínculo`);
      
      // Se encontrarmos assinaturas ativas sem vínculo, verificamos se alguma pode ser do usuário
      if (activeUnlinkedSubscriptions.length > 0) {
        // Dar prioridade para a assinatura mais recente
        const latestSubscription = activeUnlinkedSubscriptions[0];
        
        console.log(`[AUTH] Vinculando assinatura ${latestSubscription._id} ao usuário ${userId}`);
        
        // Atualizar o usuário com este customerId
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { 
              customerId: latestSubscription.customerId,
              asaasCustomerId: latestSubscription.customerId
            } 
          }
        );
        
        // Atualizar a assinatura com o userId
        await db.collection('userSubscriptions').updateOne(
          { _id: latestSubscription._id },
          { $set: { userId: userId } }
        );
        
        console.log(`[AUTH] Usuário ${userId} vinculado à assinatura ativa ${latestSubscription._id}`);
        return true;
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