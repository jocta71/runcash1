const { MongoClient } = require('mongodb');

async function testarRoletasDb() {
  let client;
  try {
    console.log('Conectando ao MongoDB...');
    client = new MongoClient('mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash');
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso!');
    
    // Acessar banco roletas_db
    const db = client.db('roletas_db');
    console.log('Banco roletas_db acessado');
    
    // Listar coleções disponíveis
    const collections = await db.listCollections().toArray();
    console.log('\nColeções disponíveis:');
    collections
      .filter(col => !col.name.startsWith('system.'))
      .forEach(col => console.log(`- ${col.name}`));
    
    // Tentar acessar uma coleção específica (assumindo que 2010097 é uma das coleções)
    console.log('\nTestando acesso à coleção 2010097:');
    const testeColeção = await db.collection('2010097').find({}).limit(5).toArray();
    console.log(`Encontrados ${testeColeção.length} documentos na coleção 2010097`);
    if (testeColeção.length > 0) {
      console.log('Exemplo de documento:');
      console.log(testeColeção[0]);
    }
    
    // Tentar acessar metadados
    console.log('\nProcurando coleção metadados:');
    const temMetadados = collections.some(col => col.name === 'metadados');
    if (temMetadados) {
      console.log('Coleção metadados encontrada, buscando registros...');
      const metadados = await db.collection('metadados').find({}).limit(5).toArray();
      console.log(`Encontrados ${metadados.length} documentos na coleção metadados`);
      if (metadados.length > 0) {
        console.log('Exemplo de metadado:');
        console.log(metadados[0]);
      }
    } else {
      console.log('Coleção metadados não encontrada');
    }
    
  } catch (error) {
    console.error('Erro ao testar conexão:', error);
  } finally {
    if (client) {
      console.log('\nFechando conexão...');
      await client.close();
      console.log('Conexão fechada');
    }
  }
}

// Executar o teste
testarRoletasDb(); 