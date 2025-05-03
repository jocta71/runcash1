const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

async function createTestUserAndSubscription() {
  const client = new MongoClient(url);
  
  try {
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    const db = client.db(dbName);
    
    // Criar um usuário de teste
    const userId = new ObjectId();
    const customerId = 'cus_000006648482'; // Customer ID do Asaas (reusando o existente)
    const subscriptionId = `sub_test_${Date.now()}`; // ID único de assinatura
    
    const user = {
      _id: userId,
      email: 'teste@runcash.com.br',
      name: 'Usuário de Teste',
      asaasCustomerId: customerId,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    console.log('\nCriando usuário de teste:');
    console.log(JSON.stringify(user, null, 2));
    
    const userResult = await db.collection('users').insertOne(user);
    
    if (userResult.acknowledged) {
      console.log(`\nUsuário criado com sucesso, ID: ${userId}`);
      
      // Criar uma assinatura de teste
      const subscription = {
        user_id: userId,
        payment_id: subscriptionId,
        plan_id: 'PRO',
        status: 'pending', // Inicialmente pendente
        payment_platform: 'asaas',
        start_date: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      console.log('\nCriando assinatura de teste:');
      console.log(JSON.stringify(subscription, null, 2));
      
      const subscriptionResult = await db.collection('subscriptions').insertOne(subscription);
      
      if (subscriptionResult.acknowledged) {
        console.log(`\nAssinatura criada com sucesso, ID: ${subscriptionId}`);
        
        // Verificar estado atual
        console.log('\nVerificando userSubscriptions atual:');
        const currentUserSub = await db.collection('userSubscriptions').findOne({userId: userId.toString()});
        console.log(currentUserSub ? JSON.stringify(currentUserSub, null, 2) : 'Nenhum registro encontrado');
        
        // Agora vamos testar o webhook ativando esta assinatura
        console.log('\nPara testar o webhook, execute:');
        console.log(`node test-webhook-asaas.js simulate ${subscriptionId} PAYMENT_CONFIRMED`);
      } else {
        console.log('Falha ao criar a assinatura');
      }
    } else {
      console.log('Falha ao criar o usuário');
    }
  } catch (err) {
    console.error('Erro ao executar a operação:', err);
  } finally {
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

createTestUserAndSubscription(); 