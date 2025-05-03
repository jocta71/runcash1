const { MongoClient } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

async function checkSubscriptions() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao servidor MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    // Selecionar o banco de dados
    const db = client.db(dbName);
    
    // Buscar e listar assinaturas em qualquer estado
    console.log('\nAssinaturas encontradas:');
    const subscriptions = await db.collection('subscriptions').find({}).limit(10).toArray();
    
    if (subscriptions.length === 0) {
      console.log('Nenhuma assinatura encontrada');
    } else {
      subscriptions.forEach((sub, index) => {
        console.log(`\n[${index + 1}] Assinatura:`);
        console.log(`   ID: ${sub.payment_id || 'N/A'}`);
        console.log(`   Usuário: ${sub.user_id || 'N/A'}`);
        console.log(`   Plano: ${sub.plan_id || 'N/A'}`);
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

checkSubscriptions(); 