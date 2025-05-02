/**
 * Serviço centralizado para conexão com o MongoDB
 * Permite reutilizar a mesma conexão em diferentes partes da aplicação
 */

const { MongoClient } = require('mongodb');

// URI de conexão com o MongoDB (idealmente em variável de ambiente)
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = process.env.DB_NAME || "runcash";

// Cliente MongoDB
let client = null;
let db = null;

/**
 * Inicializa a conexão com o MongoDB, se necessário
 * @returns {Promise<import('mongodb').Db>} Instância do banco de dados
 */
async function getDb() {
  if (db) {
    return db;
  }
  
  try {
    console.log('[Database] Iniciando conexão com MongoDB...');
    
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    console.log('[Database] Conexão com MongoDB estabelecida com sucesso');
    return db;
  } catch (error) {
    console.error('[Database] Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

/**
 * Fecha a conexão com o MongoDB
 * Útil para encerrar a aplicação graciosamente
 */
async function closeConnection() {
  if (client) {
    await client.close();
    console.log('[Database] Conexão com MongoDB encerrada');
    client = null;
    db = null;
  }
}

// Tratar a saída da aplicação para fechar conexão
process.on('SIGINT', async () => {
  console.log('[Database] Recebido sinal SIGINT, encerrando conexão...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Database] Recebido sinal SIGTERM, encerrando conexão...');
  await closeConnection();
  process.exit(0);
});

module.exports = getDb; 