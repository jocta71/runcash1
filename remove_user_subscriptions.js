const { MongoClient } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

async function removeUserSubscriptions() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    const db = client.db(dbName);
    
    // Opção 1: Remover todos os documentos da coleção
    console.log('Removendo todos os documentos da coleção userSubscriptions...');
    const deleteResult = await db.collection('userSubscriptions').deleteMany({});
    console.log(`${deleteResult.deletedCount} documento(s) removido(s) da coleção userSubscriptions`);
    
    // Opção 2 (alternativa): Remover a coleção inteira
    // Esta opção está comentada pois normalmente não é necessário remover a coleção
    // console.log('Removendo a coleção userSubscriptions...');
    // await db.dropCollection('userSubscriptions');
    // console.log('Coleção userSubscriptions removida com sucesso');
    
    console.log('Operação concluída.');
    
  } catch (err) {
    if (err.codeName === 'NamespaceNotFound') {
      console.log('A coleção userSubscriptions não existe ou já foi removida.');
    } else {
      console.error('Erro ao executar a operação:', err);
    }
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('Conexão com MongoDB fechada');
  }
}

removeUserSubscriptions(); 