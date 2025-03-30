const { MongoClient } = require('mongodb');
require('dotenv').config();

// Obter a string de conexão do MongoDB do ambiente
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/runcash';
const DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

async function checkMongoDBConnection() {
  console.log(`Tentando conectar ao MongoDB em: ${MONGODB_URI}`);
  console.log(`Nome do banco de dados: ${DB_NAME}`);
  
  let client;
  try {
    // Criar cliente MongoDB
    client = new MongoClient(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout de 5 segundos
    });
    
    // Tentar conectar
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Obter referência do banco de dados
    const db = client.db();
    
    // Listar coleções
    const collections = await db.listCollections().toArray();
    console.log(`\nColeções disponíveis (${collections.length}):`);
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Verificar coleção 'roleta_numeros'
    if (collections.some(c => c.name === 'roleta_numeros')) {
      console.log('\nVerificando coleção roleta_numeros:');
      const collection = db.collection('roleta_numeros');
      
      // Contar documentos
      const count = await collection.countDocuments();
      console.log(`Total de documentos: ${count}`);
      
      // Buscar alguns documentos recentes
      if (count > 0) {
        const docs = await collection.find({})
          .sort({ timestamp: -1 })
          .limit(5)
          .toArray();
        
        console.log('\nDocumentos mais recentes:');
        docs.forEach((doc, i) => {
          console.log(`\n[${i+1}] ID: ${doc._id}`);
          console.log(`Roleta: ${doc.roleta_nome} (${doc.roleta_id || 'ID não definido'})`);
          console.log(`Número: ${doc.numero}, Cor: ${doc.cor || 'não definida'}`);
          console.log(`Timestamp: ${doc.timestamp || 'não definido'}`);
        });
      } else {
        console.log('⚠️ Nenhum documento encontrado na coleção.');
      }
    } else {
      console.log('⚠️ Coleção roleta_numeros não encontrada!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:');
    console.error(error);
  } finally {
    // Fechar conexão se existir
    if (client) {
      await client.close();
      console.log('\nConexão fechada.');
    }
  }
}

// Executar verificação
checkMongoDBConnection().catch(console.error); 