const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

// Dados relevantes
const subscriptionId = '6815926cf5e04b3b18d3f5cf';
const userId = '68158fb0d4c439794856fd8b';
const customerId = 'cus_000006648482';

async function verifySubscription() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao servidor MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    // Selecionar o banco de dados
    const db = client.db(dbName);
    
    // Verificar a assinatura por ID
    console.log(`\n1. Verificando assinatura pelo ID: ${subscriptionId}`);
    const subscription = await db.collection('subscriptions').findOne({ _id: new ObjectId(subscriptionId) });
    
    if (!subscription) {
      console.log('Assinatura não encontrada pelo ID');
    } else {
      console.log('Dados da assinatura:');
      console.log(JSON.stringify(subscription, null, 2));
    }
    
    // Verificar assinaturas pelo customer_id
    console.log(`\n2. Verificando assinaturas pelo customer_id: ${customerId}`);
    const subscriptionsByCustomerId = await db.collection('subscriptions').find({ customer_id: customerId }).toArray();
    
    if (subscriptionsByCustomerId.length === 0) {
      console.log('Nenhuma assinatura encontrada com este customer_id');
    } else {
      console.log(`${subscriptionsByCustomerId.length} assinatura(s) encontrada(s):`);
      console.log(JSON.stringify(subscriptionsByCustomerId, null, 2));
    }
    
    // Verificar todas as assinaturas ativas para o usuário
    console.log(`\n3. Verificando todas as assinaturas ativas para o usuário: ${userId}`);
    const activeSubscriptions = await db.collection('subscriptions').find({ 
      user_id: userId,
      status: 'active' 
    }).toArray();
    
    if (activeSubscriptions.length === 0) {
      console.log('Nenhuma assinatura ativa encontrada para este usuário');
    } else {
      console.log(`${activeSubscriptions.length} assinatura(s) ativa(s) encontrada(s):`);
      console.log(JSON.stringify(activeSubscriptions, null, 2));
    }
    
    // Verificar o formato dos campos na assinatura
    console.log(`\n4. Verificando o nome dos campos da coleção subscriptions:`);
    const fields = subscription ? Object.keys(subscription) : [];
    if (fields.length > 0) {
      console.log('Campos encontrados:');
      console.log(fields);
      
      // Verificar se existe customer_id ou customerId
      console.log('\nVerificando campos específicos:');
      console.log(`customer_id: ${subscription.customer_id !== undefined ? 'presente' : 'ausente'}`);
      console.log(`customerId: ${subscription.customerId !== undefined ? 'presente' : 'ausente'}`);
      console.log(`status: ${subscription.status}`);
    }
    
    // Verificar outras coleções relacionadas à assinatura
    console.log(`\n5. Verificando coleções relacionadas às assinaturas:`);
    const collections = await db.listCollections().toArray();
    const relevantCollections = collections
      .filter(col => col.name.toLowerCase().includes('subscription') || 
                     col.name.toLowerCase().includes('assinatura') ||
                     col.name.toLowerCase().includes('plano'))
      .map(col => col.name);
    
    console.log('Coleções relevantes encontradas:');
    console.log(relevantCollections);
    
  } catch (err) {
    console.error('Erro ao executar a operação:', err);
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

verifySubscription(); 