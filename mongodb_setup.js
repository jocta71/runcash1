const { MongoClient } = require('mongodb');
const fs = require('fs');

// Configuração
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = 'runcash';

// Importar dados do arquivo numeros_mongodb.json se existir
async function importDadosMongoDB() {
  try {
    console.log('Conectando ao MongoDB...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    console.log('Conexão estabelecida com sucesso!');
    const db = client.db(DB_NAME);
    
    // Verificar e criar coleções se não existirem
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('Coleções existentes:', collectionNames);
    
    // Criar coleção roleta_numeros se não existir
    if (!collectionNames.includes('roleta_numeros')) {
      console.log('Criando coleção roleta_numeros...');
      await db.createCollection('roleta_numeros');
    }
    
    // Verificar contagem atual
    const collection = db.collection('roleta_numeros');
    const count = await collection.countDocuments();
    console.log(`Total de documentos em roleta_numeros: ${count}`);
    
    // Verificar se há dados no arquivo JSON
    if (fs.existsSync('numeros_mongodb.json')) {
      const jsonData = fs.readFileSync('numeros_mongodb.json', 'utf-8');
      const data = JSON.parse(jsonData);
      
      if (data.length > 0 && count === 0) {
        console.log(`Importando ${data.length} documentos do arquivo JSON...`);
        await collection.insertMany(data);
        console.log('Dados importados com sucesso!');
      } else {
        console.log('Arquivo JSON existe, mas não foi necessário importar (a coleção já tem dados ou o arquivo está vazio)');
      }
    }
    
    // Atualizar índices para melhorar performance
    console.log('Criando índices...');
    await collection.createIndex({ timestamp: -1 });
    await collection.createIndex({ roleta_id: 1 });
    await collection.createIndex({ roleta_nome: 1 });
    
    console.log('Índices criados com sucesso!');
    
    // Buscar alguns dados para confirmar
    const recentes = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    console.log('Dados mais recentes:');
    recentes.forEach(doc => {
      console.log(`${doc.roleta_nome}: ${doc.numero} (${doc.cor})`);
    });
    
    await client.close();
    console.log('Conexão fechada');
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

// Executar o script
importDadosMongoDB(); 