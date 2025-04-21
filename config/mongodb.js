// Configuração de conexão com o MongoDB
const { MongoClient } = require('mongodb');

// Função para conectar ao banco de dados
async function connectToDatabase() {
  try {
    console.log('Conectando ao MongoDB...');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI não configurado no ambiente');
    }
    
    const client = new MongoClient(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    
    console.log('Conexão com MongoDB estabelecida!');
    return { client, db };
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

module.exports = { connectToDatabase }; 