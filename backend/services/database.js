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

let client = null;
let db = null;

/**
 * Obtém uma conexão com o banco de dados
 * @returns {Promise<Object>} Instância do banco de dados MongoDB
 */
const getDb = async () => {
  try {
    // Verificar se já existe conexão
    if (client && db) {
      return db;
    }
    
    // Estabelecer nova conexão
    console.log('[Database] Tentando conectar ao MongoDB...');
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // 5 segundos de timeout
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    console.log(`[Database] Conectado com sucesso ao MongoDB (${MONGODB_URI.replace(/:[^:]*@/, ':****@')}) e banco ${DB_NAME}`);
    return db;
  } catch (error) {
    console.error('[Database] Erro ao conectar ao MongoDB:', error.message);
    // Retornar null em vez de lançar erro
    // Isso permite que a aplicação continue funcionando com dados mockados
    return null;
  }
};

module.exports = getDb; 