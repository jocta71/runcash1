/**
 * Job para sincronizar assinaturas entre as coleções 'subscriptions' e 'userSubscriptions'
 * Este script deve ser executado periodicamente para garantir consistência dos dados
 */

const { MongoClient } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Flag para controlar o log detalhado
const VERBOSE = process.env.VERBOSE_SYNC === 'true';

/**
 * Sincroniza as assinaturas entre as coleções
 */
async function syncSubscriptions() {
  let client;
  const syncId = new Date().toISOString();
  console.log(`[SyncJob ${syncId}] Iniciando sincronização de assinaturas`);
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    // 1. Obter todas as assinaturas ativas da coleção 'subscriptions'
    const activeSubscriptions = await db.collection('subscriptions').find({ 
      status: 'active' 
    }).toArray();
    
    console.log(`[SyncJob ${syncId}] Encontradas ${activeSubscriptions.length} assinaturas ativas na coleção 'subscriptions'`);
    
    // 2. Para cada assinatura ativa, garantir que existe um registro correspondente em 'userSubscriptions'
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const subscription of activeSubscriptions) {
      const customerId = subscription.customer_id;
      const subscriptionId = subscription.subscription_id;
      const userId = subscription.user_id;
      const planId = subscription.plan_id;
      
      if (!customerId || !subscriptionId || !userId) {
        console.log(`[SyncJob ${syncId}] Assinatura ${subscription._id} com dados incompletos, ignorando`);
        continue;
      }
      
      // Verificar se já existe um registro em 'userSubscriptions'
      const existingUserSubscription = await db.collection('userSubscriptions').findOne({
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId
      });
      
      if (!existingUserSubscription) {
        // Não existe, criar novo registro
        VERBOSE && console.log(`[SyncJob ${syncId}] Criando novo registro em userSubscriptions para assinatura ${subscription._id}`);
        
        // Calcular próxima data de vencimento (30 dias a partir de hoje)
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + 30);
        
        const newUserSubscription = {
          userId: userId,
          asaasCustomerId: customerId,
          asaasSubscriptionId: subscriptionId,
          status: 'active',
          planType: planId || 'basic',
          nextDueDate: nextDueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.collection('userSubscriptions').insertOne(newUserSubscription);
        createdCount++;
      } else if (existingUserSubscription.status !== 'active') {
        // Existe mas não está ativo, atualizar
        VERBOSE && console.log(`[SyncJob ${syncId}] Atualizando status do registro ${existingUserSubscription._id} para 'active'`);
        
        await db.collection('userSubscriptions').updateOne(
          { _id: existingUserSubscription._id },
          { 
            $set: { 
              status: 'active',
              planType: planId || existingUserSubscription.planType || 'basic',
              updatedAt: new Date()
            } 
          }
        );
        updatedCount++;
      } else {
        VERBOSE && console.log(`[SyncJob ${syncId}] Registro já está atualizado para assinatura ${subscription._id}`);
      }
    }
    
    // 3. Inativar registros em 'userSubscriptions' que não têm assinaturas ativas correspondentes
    const userSubscriptions = await db.collection('userSubscriptions').find({ 
      status: 'active' 
    }).toArray();
    
    console.log(`[SyncJob ${syncId}] Encontrados ${userSubscriptions.length} registros ativos na coleção 'userSubscriptions'`);
    
    let inactivatedCount = 0;
    
    for (const userSubscription of userSubscriptions) {
      const customerId = userSubscription.asaasCustomerId;
      const subscriptionId = userSubscription.asaasSubscriptionId;
      
      if (!customerId || !subscriptionId) {
        console.log(`[SyncJob ${syncId}] UserSubscription ${userSubscription._id} com dados incompletos, ignorando`);
        continue;
      }
      
      // Verificar se existe uma assinatura ativa correspondente
      const activeSubscription = await db.collection('subscriptions').findOne({
        customer_id: customerId,
        subscription_id: subscriptionId,
        status: 'active'
      });
      
      if (!activeSubscription) {
        // Não existe assinatura ativa, inativar
        VERBOSE && console.log(`[SyncJob ${syncId}] Inativando registro ${userSubscription._id} sem assinatura ativa correspondente`);
        
        await db.collection('userSubscriptions').updateOne(
          { _id: userSubscription._id },
          { 
            $set: { 
              status: 'inactive',
              updatedAt: new Date()
            } 
          }
        );
        inactivatedCount++;
      }
    }
    
    console.log(`[SyncJob ${syncId}] Sincronização concluída:`);
    console.log(`- ${createdCount} novos registros criados em 'userSubscriptions'`);
    console.log(`- ${updatedCount} registros atualizados em 'userSubscriptions'`);
    console.log(`- ${inactivatedCount} registros inativados em 'userSubscriptions'`);
    
    return {
      success: true,
      created: createdCount,
      updated: updatedCount,
      inactivated: inactivatedCount
    };
  } catch (error) {
    console.error(`[SyncJob ${syncId}] Erro durante a sincronização:`, error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (client) {
      await client.close();
      console.log(`[SyncJob ${syncId}] Conexão com MongoDB fechada`);
    }
  }
}

// Se for executado diretamente pelo Node.js (não importado como módulo)
if (require.main === module) {
  // Executar o job e sair
  syncSubscriptions().then(result => {
    console.log('Resultado da sincronização:', result);
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Erro fatal durante a sincronização:', error);
    process.exit(1);
  });
} else {
  // Exportar a função para ser usada como módulo
  module.exports = syncSubscriptions;
} 