const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

// Dados de exemplo
const userId = new ObjectId('68158fb0d4c439794856fd8b'); // ID de um usuário real como ObjectId
const customerId = 'cus_000006648482'; // Customer ID do Asaas
const subscriptionId = `sub_test_${Date.now()}`; // ID único de assinatura

async function createTestSubscription() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao servidor MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    // Selecionar o banco de dados
    const db = client.db(dbName);
    
    // Verificar se o usuário existe
    const user = await db.collection('users').findOne({ _id: userId });
    
    if (!user) {
      console.error(`Usuário com ID ${userId} não encontrado`);
      // Vamos listar alguns usuários para ver quais estão disponíveis
      console.log('\nBuscando usuários disponíveis...');
      const users = await db.collection('users').find({}).limit(3).toArray();
      if (users.length > 0) {
        console.log('Usuários disponíveis:');
        users.forEach(u => console.log(` - ID: ${u._id}, Email: ${u.email || 'N/A'}`));
      } else {
        console.log('Nenhum usuário encontrado no banco de dados');
      }
      return;
    }
    
    console.log('Usuário encontrado:', user.email || user.name || userId);
    
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
      
      // Agora vamos testar o webhook ativando esta assinatura
      console.log('\nPara testar o webhook e atualizar a coleção userSubscriptions, execute:');
      console.log(`node test-webhook-asaas.js simulate ${subscriptionId} PAYMENT_CONFIRMED`);
    } else {
      console.log('Falha ao criar a assinatura');
    }
    
  } catch (err) {
    console.error('Erro ao executar a operação:', err);
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

createTestSubscription(); 