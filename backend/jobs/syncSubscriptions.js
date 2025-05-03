/**
 * Job para sincronizar as coleções subscriptions e userSubscriptions
 * Garante consistência entre as coleções, mesmo se algum webhook falhar
 */
const { MongoClient, ObjectId } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Configurações do job
const SYNC_INTERVAL = process.env.SUBSCRIPTION_SYNC_INTERVAL || 3600000; // 1 hora por padrão

/**
 * Função principal para sincronização de assinaturas
 */
async function syncSubscriptions() {
  const client = new MongoClient(MONGODB_URI);
  const requestId = Math.random().toString(36).substring(2, 15);
  
  console.log(`[SyncSubscriptions ${requestId}] Iniciando sincronização de assinaturas`);
  
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    // 1. Sincronizar de subscriptions para userSubscriptions
    const subscriptions = await db.collection('subscriptions').find({
      status: { $in: ['active', 'pending', 'overdue'] }
    }).toArray();
    
    console.log(`[SyncSubscriptions ${requestId}] Encontradas ${subscriptions.length} assinaturas para sincronizar`);
    
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    // Processar cada assinatura
    for (const subscription of subscriptions) {
      try {
        const customerId = subscription.customer_id;
        if (!customerId) {
          console.log(`[SyncSubscriptions ${requestId}] Assinatura sem customerId, ignorando: ${subscription._id}`);
          continue;
        }
        
        // Verificar se já existe registro em userSubscriptions
        const existingUserSub = await db.collection('userSubscriptions').findOne({
          asaasCustomerId: customerId
        });
        
        // Determinar userId (pode estar em vários lugares dependendo da implementação)
        let userId = subscription.user_id;
        
        // Se não tiver userId na assinatura, buscar do usuário
        if (!userId) {
          const user = await db.collection('users').findOne({ 
            $or: [
              { customerId: customerId },
              { 'asaas.customerId': customerId }
            ]
          });
          
          if (user) {
            userId = user._id.toString();
          } else {
            console.log(`[SyncSubscriptions ${requestId}] Não foi possível encontrar usuário para customerId: ${customerId}`);
            continue;
          }
        }
        
        if (existingUserSub) {
          // Atualizar registro existente
          const updateResult = await db.collection('userSubscriptions').updateOne(
            { _id: existingUserSub._id },
            {
              $set: {
                status: subscription.status,
                planType: subscription.plan_id,
                nextDueDate: subscription.next_due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                updatedAt: new Date()
              }
            }
          );
          
          if (updateResult.modifiedCount > 0) {
            updatedCount++;
          }
        } else {
          // Criar novo registro
          const newUserSubscription = {
            userId: userId,
            asaasCustomerId: customerId,
            asaasSubscriptionId: subscription.subscription_id,
            status: subscription.status,
            planType: subscription.plan_id || 'basic',
            nextDueDate: subscription.next_due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await db.collection('userSubscriptions').insertOne(newUserSubscription);
          createdCount++;
        }
      } catch (error) {
        console.error(`[SyncSubscriptions ${requestId}] Erro ao processar assinatura ${subscription._id}:`, error);
        errorCount++;
      }
    }
    
    // 2. Verificar assinaturas inativas ou canceladas em userSubscriptions
    const activeUserSubs = await db.collection('userSubscriptions').find({
      status: 'active'
    }).toArray();
    
    let inactivatedCount = 0;
    
    for (const userSub of activeUserSubs) {
      try {
        // Verificar se existe uma assinatura ativa correspondente
        const activeSubscription = await db.collection('subscriptions').findOne({
          customer_id: userSub.asaasCustomerId,
          status: 'active'
        });
        
        if (!activeSubscription) {
          // Se não existe assinatura ativa, marcar como inativa em userSubscriptions
          await db.collection('userSubscriptions').updateOne(
            { _id: userSub._id },
            {
              $set: {
                status: 'inactive',
                updatedAt: new Date()
              }
            }
          );
          
          inactivatedCount++;
        }
      } catch (error) {
        console.error(`[SyncSubscriptions ${requestId}] Erro ao verificar assinatura de usuário ${userSub._id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`[SyncSubscriptions ${requestId}] Sincronização concluída.`);
    console.log(`[SyncSubscriptions ${requestId}] Criadas: ${createdCount}, Atualizadas: ${updatedCount}, Inativadas: ${inactivatedCount}, Erros: ${errorCount}`);
    
    return {
      success: true,
      created: createdCount,
      updated: updatedCount,
      inactivated: inactivatedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error(`[SyncSubscriptions ${requestId}] Erro geral na sincronização:`, error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Função para iniciar o job recorrente
 */
function startSyncJob() {
  console.log(`Iniciando job de sincronização de assinaturas. Intervalo: ${SYNC_INTERVAL}ms`);
  
  // Executar imediatamente na inicialização
  syncSubscriptions().catch(err => {
    console.error('Erro na execução inicial do job de sincronização:', err);
  });
  
  // Configurar intervalo para execuções recorrentes
  setInterval(() => {
    syncSubscriptions().catch(err => {
      console.error('Erro na execução do job de sincronização:', err);
    });
  }, SYNC_INTERVAL);
}

// Exportar funções para uso externo
module.exports = {
  syncSubscriptions,
  startSyncJob
}; 