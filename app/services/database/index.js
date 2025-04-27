/**
 * Serviço de acesso ao banco de dados
 * Fornece métodos para conectar e interagir com o MongoDB
 */
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// URI de conexão com o MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Cliente MongoDB
let client = null;
let db = null;

/**
 * Conecta ao banco de dados MongoDB
 * @returns {Promise<Object>} Instância do banco de dados
 */
const connect = async () => {
  try {
    if (db) return db;
    
    console.log('[Database] Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await client.connect();
    db = client.db(MONGODB_DB_NAME);
    
    console.log('[Database] Conexão estabelecida com sucesso');
    return db;
  } catch (error) {
    console.error('[Database] Erro ao conectar ao MongoDB:', error);
    throw error;
  }
};

/**
 * Obtém a instância do banco de dados
 * @returns {Promise<Object>} Instância do banco de dados
 */
const getDb = async () => {
  if (!db) {
    return await connect();
  }
  return db;
};

/**
 * Fecha a conexão com o banco de dados
 */
const close = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[Database] Conexão fechada');
  }
};

/**
 * Verifica se um usuário existe pelo ID ou email
 * @param {string} identifier - ID ou email do usuário
 * @returns {Promise<Object|null>} Dados do usuário ou null se não encontrado
 */
const findUserByIdOrEmail = async (identifier) => {
  try {
    console.log(`[Database] Buscando usuário por identificador: ${identifier}`);
    const database = await getDb();
    const usersCollection = database.collection('users');
    
    // Verificar se o identificador parece ser um email
    const isEmail = identifier && typeof identifier === 'string' && identifier.includes('@');
    
    // Buscar por ID ou email conforme o formato do identificador
    const query = isEmail 
      ? { email: identifier }
      : { $or: [{ _id: identifier }, { id: identifier }] };
    
    return await usersCollection.findOne(query);
  } catch (error) {
    console.error('[Database] Erro ao buscar usuário:', error);
    return null;
  }
};

module.exports = {
  connect,
  getDb,
  close,
  findUserByIdOrEmail
}; 