const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

async function checkUsers() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao servidor MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    // Selecionar o banco de dados
    const db = client.db(dbName);
    
    // Listar todas as coleções para ver o que está disponível
    console.log('\nColeções disponíveis:');
    const collections = await db.listCollections().toArray();
    collections.forEach(col => console.log(` - ${col.name}`));
    
    // Buscar e listar usuários
    console.log('\nUsuários encontrados:');
    const users = await db.collection('users').find({}).limit(5).toArray();
    
    if (users.length === 0) {
      console.log('Nenhum usuário encontrado');
    } else {
      users.forEach((user, index) => {
        console.log(`\n[${index + 1}] Usuário:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Nome: ${user.name || 'N/A'}`);
        console.log(`   Customer ID: ${user.asaasCustomerId || user.asaas?.customerId || 'N/A'}`);
      });
    }
    
    // Verificar se há dados em userSubscriptions
    console.log('\nRegistros em userSubscriptions:');
    const userSubs = await db.collection('userSubscriptions').find({}).limit(5).toArray();
    
    if (userSubs.length === 0) {
      console.log('Nenhum registro encontrado em userSubscriptions');
    } else {
      userSubs.forEach((sub, index) => {
        console.log(`\n[${index + 1}] Registro userSubscription:`);
        console.log(`   Subscription ID: ${sub.asaasSubscriptionId || 'N/A'}`);
        console.log(`   User ID: ${sub.userId || 'N/A'}`);
        console.log(`   Status: ${sub.status || 'N/A'}`);
      });
    }
    
  } catch (err) {
    console.error('Erro ao executar a operação:', err);
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

checkUsers(); 