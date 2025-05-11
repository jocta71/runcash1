/**
 * Serviço de banco de dados
 * Fornece conexão MongoDB independente
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração de conexão
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const DB_NAME = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'runcash';
const ROLETAS_DB_NAME = process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db';

// Cache para conexões com diferentes bancos de dados
let client = null;
let dbInstances = {};

/**
 * Obtém uma conexão com o banco de dados
 * @param {string} [dbName] - Nome opcional do banco de dados a ser utilizado
 * @returns {Promise<Object>} Instância do banco de dados MongoDB
 */
const getDb = async (dbName) => {
  try {
    // Determinar qual banco de dados usar
    const targetDbName = dbName || DB_NAME;
    
    // Verificar se já existe conexão para este banco
    if (client && dbInstances[targetDbName]) {
      console.log(`[Database] Usando conexão existente para banco ${targetDbName}`);
      return dbInstances[targetDbName];
    }
    
    // Estabelecer nova conexão se o cliente ainda não existe
    if (!client) {
      console.log('[Database] Tentando conectar ao MongoDB...');
      client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000 // 5 segundos de timeout
      });
      
      await client.connect();
      console.log(`[Database] Conectado com sucesso ao MongoDB (${MONGODB_URI.replace(/:[^:]*@/, ':****@')})`);
    }
    
    // Obter instância do banco de dados solicitado
    const dbInstance = client.db(targetDbName);
    
    // Armazenar no cache
    dbInstances[targetDbName] = dbInstance;
    
    console.log(`[Database] Usando banco de dados: ${targetDbName}`);
    return dbInstance;
  } catch (error) {
    console.error(`[Database] Erro ao conectar ao MongoDB (${dbName || DB_NAME}):`, error.message);
    // Retornar null em vez de lançar erro
    // Isso permite que a aplicação continue funcionando com dados mockados
    return null;
  }
};

module.exports = getDb; 