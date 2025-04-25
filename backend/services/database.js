/**
 * Módulo de conexão com o banco de dados
 * Mantém uma conexão reutilizável com o MongoDB
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Variáveis para gerenciar conexão
let client = null;
let db = null;
let isConnecting = false;
let connectionPromise = null;

// Configuração de conexão
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'roulette_data';

/**
 * Conecta ao banco de dados MongoDB
 * @returns {Promise<object>} Conexão MongoDB
 */
async function connectToDatabase() {
  try {
    // Se já estiver conectado, retornar a conexão existente
    if (db) {
      return db;
    }
    
    // Se já estiver tentando conectar, aguardar a promessa existente
    if (isConnecting && connectionPromise) {
      return connectionPromise;
    }
    
    // Iniciar nova conexão
    isConnecting = true;
    connectionPromise = new Promise(async (resolve, reject) => {
      try {
        console.log(`[DB] Conectando ao MongoDB: ${DB_URI}`);
        
        // Configurar opções da conexão
        const options = {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10
        };
        
        // Conectar ao servidor MongoDB
        client = new MongoClient(DB_URI, options);
        await client.connect();
        
        // Selecionar banco de dados
        db = client.db(DB_NAME);
        
        console.log(`[DB] Conectado ao MongoDB. Database: ${DB_NAME}`);
        
        // Configurar listener para desconexão
        client.on('close', () => {
          console.log('[DB] Conexão com MongoDB fechada');
          client = null;
          db = null;
          isConnecting = false;
          connectionPromise = null;
        });
        
        // Resolver promessa com banco de dados conectado
        resolve(db);
      } catch (error) {
        console.error('[DB] Erro ao conectar ao MongoDB:', error);
        client = null;
        db = null;
        isConnecting = false;
        connectionPromise = null;
        reject(error);
      }
    });
    
    return connectionPromise;
  } catch (error) {
    console.error('[DB] Erro ao estabelecer conexão com MongoDB:', error);
    throw error;
  } finally {
    isConnecting = false;
  }
}

/**
 * Fornece acesso ao banco de dados conectado ou se conecta primeiro
 * @returns {Promise<object>} Objeto de banco de dados do MongoDB
 */
async function getDb() {
  if (!db) {
    await connectToDatabase();
  }
  return db;
}

/**
 * Fecha a conexão com o banco de dados
 */
async function closeConnection() {
  if (client) {
    try {
      await client.close();
      console.log('[DB] Conexão com MongoDB fechada manualmente');
    } catch (error) {
      console.error('[DB] Erro ao fechar conexão com MongoDB:', error);
    } finally {
      client = null;
      db = null;
      isConnecting = false;
      connectionPromise = null;
    }
  }
}

// Verifica o estado da conexão
function isConnected() {
  return !!db;
}

// Exportar módulo
module.exports = getDb;
module.exports.connectToDatabase = connectToDatabase;
module.exports.closeConnection = closeConnection;
module.exports.isConnected = isConnected; 