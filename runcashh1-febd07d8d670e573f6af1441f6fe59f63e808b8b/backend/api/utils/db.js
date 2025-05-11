/**
 * Utilitário para conexão com MongoDB
 * Provê conexão singleton com o banco de dados
 */

const { MongoClient } = require('mongodb');

// Variáveis para manter a conexão única
let client = null;
let db = null;

/**
 * Obtém a conexão com o banco de dados
 * @returns {Promise<Db>} Instância do banco de dados MongoDB
 */
async function getDb() {
  if (db) {
    return db;
  }

  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DATABASE || 'runcash';
    
    if (!uri) {
      throw new Error('MONGODB_URI não definida no arquivo .env');
    }

    client = new MongoClient(uri);
    await client.connect();
    console.log(`✅ Conectado ao MongoDB: ${dbName}`);
    
    db = client.db(dbName);
    return db;
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

/**
 * Fecha a conexão com o banco de dados
 */
async function closeDb() {
  if (client) {
    await client.close();
    console.log('Conexão com MongoDB encerrada');
    client = null;
    db = null;
  }
}

// Tratamento para encerramento do processo
process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});

module.exports = getDb; 