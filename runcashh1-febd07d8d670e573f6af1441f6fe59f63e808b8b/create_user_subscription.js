const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

// Dados relevantes
const userId = '68158fb0d4c439794856fd8b';
const asaasCustomerId = 'cus_000006648482';
const asaasSubscriptionId = 'sub_myj2dqjty49s60gj';
const planType = 'pro';

async function createUserSubscription() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao servidor MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    // Selecionar o banco de dados
    const db = client.db(dbName);
    
    // Dados do novo registro
    const userSubscription = {
      userId: userId,
      asaasCustomerId: asaasCustomerId,
      asaasSubscriptionId: asaasSubscriptionId,
      status: 'active',
      planType: planType,
      nextDueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 dias a partir de hoje
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Inserir o novo registro
    console.log('\nInserindo novo registro na coleção userSubscriptions:');
    console.log(JSON.stringify(userSubscription, null, 2));
    
    const result = await db.collection('userSubscriptions').insertOne(userSubscription);
    
    if (result.acknowledged) {
      console.log(`\nRegistro inserido com sucesso, ID: ${result.insertedId}`);
      
      // Confirmar a inserção buscando o registro
      const insertedRecord = await db.collection('userSubscriptions').findOne({ _id: result.insertedId });
      console.log('\nRegistro inserido:');
      console.log(JSON.stringify(insertedRecord, null, 2));
    } else {
      console.log('Falha ao inserir o registro');
    }
    
  } catch (err) {
    console.error('Erro ao executar a operação:', err);
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

createUserSubscription(); 