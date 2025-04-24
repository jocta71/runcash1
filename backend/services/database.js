/**
 * Serviço de conexão com o banco de dados MongoDB
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// URL de conexão com o MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "runcash";

// Cliente MongoDB
let client = null;
let db = null;

/**
 * Obter conexão com o banco de dados
 * @returns {Promise<Db>} Instância do banco de dados
 */
async function getDb() {
  if (db) {
    return db;
  }

  try {
    console.log('[Database] Conectando ao MongoDB...');
    
    if (!client) {
      client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    if (!client.isConnected || !client.topology || !client.topology.isConnected()) {
      await client.connect();
      console.log('[Database] Conexão estabelecida com o MongoDB');
    }

    db = client.db(MONGODB_DB_NAME);
    console.log(`[Database] Usando banco de dados: ${MONGODB_DB_NAME}`);
    
    return db;
  } catch (error) {
    console.error('[Database] Erro ao conectar com o MongoDB:', error);
    throw error;
  }
}

/**
 * Fechar conexão com o banco de dados
 */
async function closeConnection() {
  if (client && client.isConnected()) {
    await client.close();
    console.log('[Database] Conexão fechada com o MongoDB');
    client = null;
    db = null;
  }
}

// Exportar funções
module.exports = getDb;
module.exports.closeConnection = closeConnection; 