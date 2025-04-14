const { MongoClient } = require('mongodb');
const fs = require('fs');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = 'runcash';

async function convertData() {
  let client;
  
  try {
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    console.log('Conexão estabelecida com sucesso!');
    const db = client.db(DB_NAME);
    
    // Obter dados da coleção roleta_numeros
    const collection = db.collection('roleta_numeros');
    const count = await collection.countDocuments();
    console.log(`Total de documentos: ${count}`);
    
    if (count > 0) {
      // Obter números mais recentes
      const numeros = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(200)
        .toArray();
      
      console.log(`Obtidos ${numeros.length} números`);
      
      // Converter para o formato esperado pela API
      const numerosFrontend = numeros.map(num => ({
        id: num._id.toString(),
        roleta_id: num.roleta_id,
        roleta_nome: num.roleta_nome,
        numero: num.numero,
        cor: num.cor,
        timestamp: num.timestamp
      }));
      
      // Salvar em um arquivo para análise
      fs.writeFileSync('numeros_mongodb.json', JSON.stringify(numeros, null, 2));
      fs.writeFileSync('numeros_frontend.json', JSON.stringify(numerosFrontend, null, 2));
      
      console.log('Arquivos JSON gerados:');
      console.log('- numeros_mongodb.json: formato original do MongoDB');
      console.log('- numeros_frontend.json: formato convertido para frontend');
    }
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Conexão com o MongoDB fechada');
    }
  }
}

// Executar a conversão
convertData(); 