const { MongoClient, ObjectId } = require('mongodb');

// Configurações de usuário
const USER_ID = '68158fb0d4c439794856fd8b';
const USER_EMAIL = 'joctasaopaulino@gmail.com';
const ASAAS_CUSTOMER_ID = 'cus_000006648482';

// Configurações do MongoDB
const MONGODB_URI = 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const MONGODB_DB_NAME = 'runcash';

async function checkAllSubscriptions() {
  console.log('\n=== Verificando Todas as Assinaturas do Usuário ===');
  console.log(`ID do Usuário: ${USER_ID}`);
  console.log(`Email do Usuário: ${USER_EMAIL}`);
  console.log(`ID do Cliente Asaas: ${ASAAS_CUSTOMER_ID}`);
  
  console.log('\nConectando ao MongoDB...');
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB com sucesso');
    const db = client.db(MONGODB_DB_NAME);
    
    // 1. Verificar todas as assinaturas na coleção userSubscriptions
    console.log('\n1. Verificando assinaturas na coleção userSubscriptions');
    
    // Assinaturas com userId como ObjectId
    const userSubscriptionsObjId = await db.collection('userSubscriptions').find({
      userId: USER_ID
    }).toArray();
    
    // Assinaturas com userId como string
    const userSubscriptionsStr = await db.collection('userSubscriptions').find({
      userId: new ObjectId(USER_ID)
    }).toArray();
    
    // Assinaturas com asaasCustomerId
    const userSubscriptionsByCustId = await db.collection('userSubscriptions').find({
      asaasCustomerId: ASAAS_CUSTOMER_ID
    }).toArray();
    
    console.log(`Encontradas ${userSubscriptionsObjId.length} assinaturas com userId como string`);
    console.log(`Encontradas ${userSubscriptionsStr.length} assinaturas com userId como ObjectId`);
    console.log(`Encontradas ${userSubscriptionsByCustId.length} assinaturas com asaasCustomerId`);
    
    // Exibir detalhes das assinaturas encontradas
    const allUserSubscriptions = [...userSubscriptionsObjId, ...userSubscriptionsStr.filter(sub => 
      !userSubscriptionsObjId.some(s => s._id.toString() === sub._id.toString())
    )];
    
    if (allUserSubscriptions.length > 0) {
      console.log('\nDetalhes das assinaturas em userSubscriptions:');
      allUserSubscriptions.forEach((sub, index) => {
        console.log(`\nAssinatura #${index + 1}:`);
        console.log(`ID: ${sub._id}`);
        console.log(`userId: ${sub.userId}`);
        console.log(`asaasCustomerId: ${sub.asaasCustomerId}`);
        console.log(`asaasSubscriptionId: ${sub.asaasSubscriptionId}`);
        console.log(`status: ${sub.status}`);
        console.log(`planType: ${sub.planType}`);
      });
    }
    
    // 2. Verificar assinaturas na coleção subscriptions
    console.log('\n2. Verificando assinaturas na coleção subscriptions');
    
    // Assinaturas com user_id
    const subscriptionsByUserId = await db.collection('subscriptions').find({
      user_id: USER_ID
    }).toArray();
    
    // Assinaturas com customer_id
    const subscriptionsByCustId = await db.collection('subscriptions').find({
      customer_id: ASAAS_CUSTOMER_ID
    }).toArray();
    
    console.log(`Encontradas ${subscriptionsByUserId.length} assinaturas com user_id`);
    console.log(`Encontradas ${subscriptionsByCustId.length} assinaturas com customer_id`);
    
    if (subscriptionsByCustId.length > 0) {
      console.log('\nDetalhes das assinaturas em subscriptions:');
      subscriptionsByCustId.forEach((sub, index) => {
        console.log(`\nAssinatura #${index + 1}:`);
        console.log(`ID: ${sub._id}`);
        console.log(`user_id: ${sub.user_id}`);
        console.log(`customer_id: ${sub.customer_id}`);
        console.log(`subscription_id: ${sub.subscription_id}`);
        console.log(`status: ${sub.status}`);
        console.log(`plan_id: ${sub.plan_id}`);
      });
    }
    
    // 3. Verificar dados do usuário
    console.log('\n3. Verificando dados do usuário');
    
    // Buscar usuário pelo ID
    const user = await db.collection('users').findOne({
      $or: [
        { _id: new ObjectId(USER_ID) },
        { id: USER_ID }
      ]
    });
    
    if (user) {
      console.log('Usuário encontrado:');
      console.log(`ID: ${user._id}`);
      console.log(`Email: ${user.email}`);
      console.log(`customerId: ${user.customerId || 'não definido'}`);
      console.log(`asaasCustomerId: ${user.asaasCustomerId || 'não definido'}`);
    } else {
      console.log('Usuário não encontrado.');
    }
    
  } catch (error) {
    console.error('Erro durante a verificação de assinaturas:', error);
  } finally {
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

// Executar a verificação
checkAllSubscriptions(); 