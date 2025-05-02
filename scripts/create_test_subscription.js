/**
 * Script para criar uma assinatura de teste no banco de dados
 * Útil para testar o sistema de verificação de assinaturas
 */

import { MongoClient, ObjectId } from 'mongodb';

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = process.env.DB_NAME || "runcash";

async function createTestSubscription() {
  console.log('Conectando ao MongoDB...');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Conexão estabelecida com sucesso!');
    
    const db = client.db(DB_NAME);
    
    // Criar ID de usuário aleatório se um usuário real não for especificado
    const userId = new ObjectId();
    
    // Verificar se já existe uma assinatura de teste
    const existingSubscription = await db.collection('userSubscriptions').findOne({ 
      asaasSubscriptionId: 'test_subscription_001' 
    });
    
    if (existingSubscription) {
      console.log('Assinatura de teste já existe, atualizando status...');
      
      await db.collection('userSubscriptions').updateOne(
        { asaasSubscriptionId: 'test_subscription_001' },
        { 
          $set: { 
            status: 'ACTIVE',
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('✅ Assinatura de teste atualizada para ACTIVE');
    } else {
      // Criar assinatura de teste
      const testSubscription = {
        userId: userId.toString(),
        asaasCustomerId: 'test_customer_001',
        asaasSubscriptionId: 'test_subscription_001',
        status: 'ACTIVE',
        planType: 'PREMIUM',
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias a partir de agora
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('userSubscriptions').insertOne(testSubscription);
      console.log(`✅ Assinatura de teste criada com ID: ${result.insertedId}`);
    }
    
    // Verificar todas as assinaturas
    const allSubscriptions = await db.collection('userSubscriptions').find({}).toArray();
    console.log('\n📋 Assinaturas no banco:');
    allSubscriptions.forEach(sub => {
      console.log(`- ${sub.asaasSubscriptionId} (${sub.status}): Usuário ${sub.userId}, Plano ${sub.planType}`);
    });
    
    console.log('\n🎉 Script finalizado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a criação da assinatura de teste:', error);
  } finally {
    await client.close();
    console.log('Conexão com o MongoDB encerrada');
  }
}

// Executar função
createTestSubscription()
  .catch(err => console.error('Erro ao executar script:', err)); 