/**
 * Biblioteca para gerenciar conexões com MongoDB
 * Oferece funções para conectar, desconectar e acessar o banco de dados
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const DB_NAME = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'runcash';

let client = null;
let db = null;

/**
 * Conecta ao MongoDB e ao banco de dados
 * @returns {Promise<Object>} - Objeto com cliente e banco de dados
 * @throws {Error} - Se a conexão falhar
 */
async function connect() {
  try {
    if (client && db) {
      console.log('Já conectado ao MongoDB.');
      return { client, db };
    }
    
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    console.log(`Conectado com sucesso ao MongoDB (${MONGO_URI}) e banco ${DB_NAME}`);
    return { client, db };
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    throw error;
  }
}

/**
 * Desconecta do MongoDB
 * @returns {Promise<boolean>} - Sucesso da operação
 */
async function disconnect() {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      console.log('Desconectado do MongoDB.');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao desconectar do MongoDB:', error);
    return false;
  }
}

/**
 * Obter a conexão do banco de dados
 * @returns {Object} - Objeto de banco de dados ou null
 */
function getDb() {
  return db;
}

/**
 * Verifica se a conexão está ativa
 * @returns {boolean} - Status da conexão
 */
function isConnected() {
  return client !== null && db !== null;
}

/**
 * Reinicia a conexão com o banco de dados
 * @returns {Promise<Object>} - Objeto com cliente e banco de dados
 */
async function reconnect() {
  await disconnect();
  return connect();
}

/**
 * Função de ajuda para mapear IDs inconsistentes para um formato canônico
 * @param {string} id - ID original
 * @returns {string} - ID canônico
 */
function mapToCanonicalId(id) {
  if (!id) return null;
  
  // Aqui podemos implementar regras de mapeamento específicas
  // Por exemplo, converter IDs em diferentes formatos para um padrão
  
  return id;
}

module.exports = {
  connect,
  disconnect,
  getDb,
  isConnected,
  reconnect,
  mapToCanonicalId
}; 