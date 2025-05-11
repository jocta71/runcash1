const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

async function updateSubscription() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao servidor MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    // Selecionar o banco de dados
    const db = client.db(dbName);
    
    // Atualizar o documento na coleção 'subscriptions'
    const result = await db.collection('subscriptions').updateOne(
      { _id: new ObjectId('6815926cf5e04b3b18d3f5cf') },
      { $set: { status: 'active' } }
    );
    
    if (result.matchedCount === 0) {
      console.log('Documento não encontrado');
    } else {
      console.log(`Documento atualizado com sucesso: ${result.modifiedCount} documento(s) modificado(s)`);
    }
  } catch (err) {
    console.error('Erro ao executar a operação:', err);
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('Conexão com MongoDB fechada');
  }
}

updateSubscription(); 