/**
 * Serviço de banco de dados Singleton
 * Garante uma única conexão MongoDB reutilizada.
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração de conexão
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const DB_NAME = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'runcash';

let client = null;
let db = null;
let connectionPromise = null; // Para gerenciar a conexão inicial

/**
 * Estabelece a conexão com o MongoDB. Deve ser chamada na inicialização da aplicação.
 * @returns {Promise<Object>} Instância do banco de dados MongoDB conectada.
 */
const connectDb = async () => {
  // Evitar múltiplas tentativas de conexão concorrentes
  if (connectionPromise) {
    return connectionPromise;
  }

  // Se já conectado, retorna imediatamente
  if (db) {
    return Promise.resolve(db);
  }

  console.log('[Database] Iniciando conexão Singleton com MongoDB...');
  connectionPromise = (async () => {
    try {
      client = new MongoClient(MONGODB_URI, {
        // Remover opções obsoletas
        // useNewUrlParser: true, 
        // useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000 // Aumentar timeout para padrão (30s)
      });
      
      await client.connect();
      db = client.db(DB_NAME);
      
      console.log(`[Database] Conexão Singleton estabelecida com sucesso ao MongoDB (${MONGODB_URI.replace(/:[^:]*@/, ':****@')}) e banco ${DB_NAME}`);
      return db;
    } catch (error) {
      console.error('[Database] ERRO FATAL ao conectar ao MongoDB (Singleton):', error.message);
      client = null; // Resetar estado em caso de falha
      db = null;
      connectionPromise = null; // Permitir nova tentativa
      // Relançar o erro para que a aplicação saiba que a conexão falhou
      throw error; 
    }
  })();

  return connectionPromise;
};

/**
 * Obtém a instância do banco de dados já conectada.
 * Lança um erro se a conexão não foi estabelecida previamente por connectDb().
 * @returns {Object} Instância do banco de dados MongoDB
 */
const getDb = () => {
  if (!db || !client) {
    throw new Error('[Database] Conexão com o banco de dados não foi inicializada. Chame connectDb() primeiro.');
  }
  return db;
};

// Exportar ambas as funções
module.exports = { connectDb, getDb }; 