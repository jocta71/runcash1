/**
 * Script para sincronização manual de assinaturas do Asaas
 * Uso: node syncAsaasSubscriptions.js [--force] [--all] [--customer=CUSTOMER_ID]
 */

const axios = require('axios');
const { MongoClient } = require('mongodb');

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Obter argumentos da linha de comando
const args = process.argv.slice(2);
const forceFlag = args.includes('--force');
const allFlag = args.includes('--all');
const customerArg = args.find(arg => arg.startsWith('--customer='));
const customerId = customerArg ? customerArg.split('=')[1] : null;

// Mapear status do Asaas para o formato usado no banco local
const statusMap = {
  'ACTIVE': 'active',
  'INACTIVE': 'inactive',
  'OVERDUE': 'overdue',
  'PENDING': 'pending'
};

/**
 * Função principal para sincronização
 */
async function main() {
  console.log('==================================================');
  console.log(' SINCRONIZAÇÃO DE ASSINATURAS ASAAS');
  console.log('==================================================');
  console.log('Iniciando sincronização...');
  
  if (forceFlag) {
    console.log('Modo FORÇADO ativado - atualizando todas as assinaturas, mesmo que não tenham mudanças');
  }
  
  if (customerId) {
    console.log(`Sincronizando apenas cliente específico: ${customerId}`);
  } else if (allFlag) {
    console.log('Sincronizando TODAS as assinaturas (pode levar tempo)');
  } else {
    console.log('Sincronizando apenas assinaturas ativas');
  }
  
  let client;
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conectado ao MongoDB');
    
    const db = client.db(MONGODB_DB_NAME);
    
    let customersToSync = [];
    
    // Determinar quais clientes sincronizar
    if (customerId) {
      // Buscar apenas cliente específico
      customersToSync.push(customerId);
    } else {
      // Buscar todos os customerId de usuários
      const users = await db.collection('users').find(
        { customerId: { $exists: true, $ne: null } },
        { projection: { customerId: 1 } }
      ).toArray();
      
      customersToSync = users.map(user => user.customerId);
      console.log(`Encontrados ${customersToSync.length} clientes para sincronização`);
    }
    
    // Estatísticas
    const stats = {
      total: customersToSync.length,
      processed: 0,
      subscriptionsCreated: 0,
      subscriptionsUpdated: 0,
      userSubscriptionsCreated: 0,
      userSubscriptionsUpdated: 0,
      errors: 0
    };
    
    // Processar cada cliente
    for (const customer of customersToSync) {
      try {
        console.log(`\nProcessando cliente: ${customer} (${stats.processed + 1}/${stats.total})`);
        
        // Buscar assinaturas do cliente na API do Asaas
        const response = await axios.get(
          `${ASAAS_API_URL}/subscriptions?customer=${customer}`, 
          {
            headers: {
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        if (!response.data || !response.data.data || response.data.data.length === 0) {
          console.log(`  Nenhuma assinatura encontrada para o cliente ${customer}`);
          stats.processed++;
          continue;
        }
        
        // Determinar quais assinaturas processar
        let subscriptionsToProcess = response.data.data;
        
        if (!allFlag && !customerId) {
          // Se não for --all e não for cliente específico, pegar apenas assinaturas ativas
          subscriptionsToProcess = subscriptionsToProcess.filter(sub => 
            sub.status === 'ACTIVE' || sub.status === 'active'
          );
        }
        
        console.log(`  Encontradas ${subscriptionsToProcess.length} assinaturas para processar`);
        
        // Processar cada assinatura
        for (const subscription of subscriptionsToProcess) {
          console.log(`  Processando assinatura: ${subscription.id} (status: ${subscription.status})`);
          
          const localStatus = statusMap[subscription.status] || subscription.status.toLowerCase();
          
          // 1. Atualizar na coleção 'subscriptions'
          const existingSubscription = await db.collection('subscriptions').findOne({ 
            subscription_id: subscription.id
          });
          
          if (existingSubscription) {
            // Verificar se é necessário atualizar (se forceFlag ou se status mudou)
            const needsUpdate = forceFlag || 
                              existingSubscription.status !== localStatus || 
                              existingSubscription.value !== subscription.value || 
                              existingSubscription.next_due_date !== subscription.nextDueDate;
            
            if (needsUpdate) {
              await db.collection('subscriptions').updateOne(
                { subscription_id: subscription.id },
                { 
                  $set: {
                    status: localStatus,
                    last_update: new Date(),
                    value: subscription.value,
                    next_due_date: subscription.nextDueDate,
                    cycle: subscription.cycle,
                    description: subscription.description
                  },
                  $push: {
                    status_history: {
                      status: localStatus,
                      timestamp: new Date(),
                      source: 'manual_sync'
                    }
                  }
                }
              );
              console.log(`    ✓ Atualizada na coleção 'subscriptions'`);
              stats.subscriptionsUpdated++;
            } else {
              console.log(`    ℹ Assinatura já está atualizada na coleção 'subscriptions'`);
            }
          } else {
            // Verificar se existe usuário associado ao customer_id
            const user = await db.collection('users').findOne({ customerId: customer });
            
            if (!user) {
              console.log(`    ❌ Nenhum usuário encontrado com customerId ${customer}, pulando`);
              continue;
            }
            
            // Criar nova entrada na coleção 'subscriptions'
            await db.collection('subscriptions').insertOne({
              subscription_id: subscription.id,
              customer_id: customer,
              user_id: user._id.toString(),
              status: localStatus,
              value: subscription.value,
              next_due_date: subscription.nextDueDate,
              cycle: subscription.cycle,
              description: subscription.description,
              created_at: new Date(),
              last_update: new Date(),
              status_history: [
                {
                  status: localStatus,
                  timestamp: new Date(),
                  source: 'manual_sync'
                }
              ]
            });
            console.log(`    ✓ Criada na coleção 'subscriptions'`);
            stats.subscriptionsCreated++;
          }
          
          // 2. Atualizar na coleção 'userSubscriptions'
          const existingUserSubscription = await db.collection('userSubscriptions').findOne({
            asaasSubscriptionId: subscription.id
          });
          
          if (existingUserSubscription) {
            // Verificar se é necessário atualizar
            const needsUpdate = forceFlag || 
                              existingUserSubscription.status !== localStatus || 
                              existingUserSubscription.nextDueDate !== subscription.nextDueDate || 
                              existingUserSubscription.planValue !== subscription.value;
            
            if (needsUpdate) {
              await db.collection('userSubscriptions').updateOne(
                { asaasSubscriptionId: subscription.id },
                {
                  $set: {
                    status: localStatus,
                    nextDueDate: subscription.nextDueDate,
                    updatedAt: new Date(),
                    planValue: subscription.value
                  },
                  $push: {
                    statusHistory: {
                      status: localStatus,
                      date: new Date(),
                      source: 'manual_sync'
                    }
                  }
                }
              );
              console.log(`    ✓ Atualizada na coleção 'userSubscriptions'`);
              stats.userSubscriptionsUpdated++;
            } else {
              console.log(`    ℹ Assinatura já está atualizada na coleção 'userSubscriptions'`);
            }
          } else {
            // Buscar informações do usuário
            const user = await db.collection('users').findOne({ customerId: customer });
            
            if (!user) {
              console.log(`    ❌ Nenhum usuário encontrado com customerId ${customer}, pulando`);
              continue;
            }
            
            // Determinar o tipo de plano com base na descrição ou valor
            let planType = 'basic'; // padrão
            
            if (subscription.description) {
              const description = subscription.description.toLowerCase();
              if (description.includes('premium') || description.includes('pro')) {
                planType = 'premium';
              } else if (description.includes('vip') || description.includes('ultimate')) {
                planType = 'vip';
              }
            } else if (subscription.value) {
              // Lógica alternativa baseada no valor
              const value = parseFloat(subscription.value);
              if (value >= 100) {
                planType = 'vip';
              } else if (value >= 50) {
                planType = 'premium';
              }
            }
            
            // Criar nova entrada na coleção 'userSubscriptions'
            await db.collection('userSubscriptions').insertOne({
              userId: user._id.toString(),
              asaasCustomerId: customer,
              asaasSubscriptionId: subscription.id,
              planType,
              status: localStatus,
              nextDueDate: subscription.nextDueDate,
              planValue: subscription.value,
              createdAt: new Date(),
              updatedAt: new Date(),
              statusHistory: [
                {
                  status: localStatus,
                  date: new Date(),
                  source: 'manual_sync'
                }
              ]
            });
            console.log(`    ✓ Criada na coleção 'userSubscriptions'`);
            stats.userSubscriptionsCreated++;
          }
        }
        
      } catch (error) {
        console.error(`  ❌ Erro ao processar cliente ${customer}:`, error.message);
        stats.errors++;
      }
      
      // Incrementar contador de processados
      stats.processed++;
    }
    
    // Exibir estatísticas finais
    console.log('\n==================================================');
    console.log(' RESUMO DA SINCRONIZAÇÃO');
    console.log('==================================================');
    console.log(`Total de clientes processados: ${stats.processed}/${stats.total}`);
    console.log(`Assinaturas criadas em 'subscriptions': ${stats.subscriptionsCreated}`);
    console.log(`Assinaturas atualizadas em 'subscriptions': ${stats.subscriptionsUpdated}`);
    console.log(`Assinaturas criadas em 'userSubscriptions': ${stats.userSubscriptionsCreated}`);
    console.log(`Assinaturas atualizadas em 'userSubscriptions': ${stats.userSubscriptionsUpdated}`);
    console.log(`Erros encontrados: ${stats.errors}`);
    console.log('==================================================');
    console.log('Sincronização concluída!');
    
  } catch (error) {
    console.error('Erro durante a sincronização:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Conexão com MongoDB encerrada');
    }
  }
}

// Executar script principal
main().catch(console.error); 