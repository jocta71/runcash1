const { MongoClient, ObjectId } = require('mongodb');
const config = require('../config');

// Cache para conexão do banco de dados
let cachedDb = null;

/**
 * Conecta ao banco de dados MongoDB
 * @returns {Promise<Object>} Objeto com a conexão e o banco de dados
 */
async function connect() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await MongoClient.connect(config.db.uri, config.db.options);
  const db = client.db();
  
  cachedDb = {
    client,
    db
  };
  
  return cachedDb;
}

/**
 * Fecha a conexão do banco de dados
 * @returns {Promise<void>}
 */
async function close() {
  if (cachedDb) {
    await cachedDb.client.close();
    cachedDb = null;
  }
}

/**
 * Insere um documento em uma coleção
 * @param {string} collection - Nome da coleção
 * @param {Object} document - Documento a ser inserido
 * @returns {Promise<Object>} Documento inserido com _id gerado
 */
async function insertOne(collection, document) {
  const { db } = await connect();
  const result = await db.collection(collection).insertOne(document);
  return { ...document, _id: result.insertedId };
}

/**
 * Insere múltiplos documentos em uma coleção
 * @param {string} collection - Nome da coleção
 * @param {Array<Object>} documents - Documentos a serem inseridos
 * @returns {Promise<Object>} Resultado da operação
 */
async function insertMany(collection, documents) {
  const { db } = await connect();
  return db.collection(collection).insertMany(documents);
}

/**
 * Busca um documento por ID
 * @param {string} collection - Nome da coleção
 * @param {string} id - ID do documento
 * @returns {Promise<Object>} Documento encontrado ou null
 */
async function findById(collection, id) {
  const { db } = await connect();
  return db.collection(collection).findOne({ _id: new ObjectId(id) });
}

/**
 * Busca documentos com base em um filtro
 * @param {string} collection - Nome da coleção
 * @param {Object} filter - Filtro de busca
 * @param {Object} options - Opções adicionais (sort, limit, skip, etc.)
 * @returns {Promise<Array<Object>>} Documentos encontrados
 */
async function find(collection, filter = {}, options = {}) {
  const { db } = await connect();
  
  const {
    sort = {},
    limit = 0,
    skip = 0,
    projection = {}
  } = options;
  
  return db.collection(collection)
    .find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .project(projection)
    .toArray();
}

/**
 * Busca um único documento com base em um filtro
 * @param {string} collection - Nome da coleção
 * @param {Object} filter - Filtro de busca
 * @param {Object} options - Opções adicionais (projection, etc.)
 * @returns {Promise<Object>} Documento encontrado ou null
 */
async function findOne(collection, filter = {}, options = {}) {
  const { db } = await connect();
  return db.collection(collection).findOne(filter, options);
}

/**
 * Atualiza um documento por ID
 * @param {string} collection - Nome da coleção
 * @param {string} id - ID do documento
 * @param {Object} update - Campos a serem atualizados
 * @param {boolean} returnUpdated - Se true, retorna o documento atualizado
 * @returns {Promise<Object>} Resultado da operação ou documento atualizado
 */
async function updateById(collection, id, update, returnUpdated = false) {
  const { db } = await connect();
  
  // Verifica se o update usa operadores do MongoDB (como $set, $inc)
  // Se não, envolve automaticamente em $set
  const updateOp = Object.keys(update).some(key => key.startsWith('$'))
    ? update
    : { $set: update };
  
  const options = {
    returnDocument: returnUpdated ? 'after' : 'before'
  };
  
  return db.collection(collection).findOneAndUpdate(
    { _id: new ObjectId(id) },
    updateOp,
    options
  );
}

/**
 * Atualiza documentos com base em um filtro
 * @param {string} collection - Nome da coleção
 * @param {Object} filter - Filtro de busca
 * @param {Object} update - Campos a serem atualizados
 * @returns {Promise<Object>} Resultado da operação
 */
async function updateMany(collection, filter, update) {
  const { db } = await connect();
  
  // Verifica se o update usa operadores do MongoDB (como $set, $inc)
  // Se não, envolve automaticamente em $set
  const updateOp = Object.keys(update).some(key => key.startsWith('$'))
    ? update
    : { $set: update };
  
  return db.collection(collection).updateMany(filter, updateOp);
}

/**
 * Exclui um documento por ID
 * @param {string} collection - Nome da coleção
 * @param {string} id - ID do documento
 * @returns {Promise<boolean>} true se o documento foi excluído, false caso contrário
 */
async function deleteById(collection, id) {
  const { db } = await connect();
  const result = await db.collection(collection).deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

/**
 * Exclui documentos com base em um filtro
 * @param {string} collection - Nome da coleção
 * @param {Object} filter - Filtro de busca
 * @returns {Promise<number>} Número de documentos excluídos
 */
async function deleteMany(collection, filter) {
  const { db } = await connect();
  const result = await db.collection(collection).deleteMany(filter);
  return result.deletedCount;
}

/**
 * Conta documentos com base em um filtro
 * @param {string} collection - Nome da coleção
 * @param {Object} filter - Filtro de busca
 * @returns {Promise<number>} Número de documentos
 */
async function count(collection, filter = {}) {
  const { db } = await connect();
  return db.collection(collection).countDocuments(filter);
}

/**
 * Realiza agregação em uma coleção
 * @param {string} collection - Nome da coleção
 * @param {Array<Object>} pipeline - Pipeline de agregação
 * @returns {Promise<Array<Object>>} Resultado da agregação
 */
async function aggregate(collection, pipeline) {
  const { db } = await connect();
  return db.collection(collection).aggregate(pipeline).toArray();
}

/**
 * Cria índice em uma coleção
 * @param {string} collection - Nome da coleção
 * @param {Object} keys - Campos e direção do índice (1 para ascendente, -1 para descendente)
 * @param {Object} options - Opções do índice
 * @returns {Promise<string>} Nome do índice criado
 */
async function createIndex(collection, keys, options = {}) {
  const { db } = await connect();
  return db.collection(collection).createIndex(keys, options);
}

/**
 * Verifica se uma coleção existe
 * @param {string} collection - Nome da coleção
 * @returns {Promise<boolean>} true se a coleção existe, false caso contrário
 */
async function collectionExists(collection) {
  const { db } = await connect();
  const collections = await db.listCollections({ name: collection }).toArray();
  return collections.length > 0;
}

/**
 * Inicia uma transação
 * @returns {Promise<Object>} Sessão da transação
 */
async function startTransaction() {
  const { client } = await connect();
  const session = client.startSession();
  session.startTransaction();
  return session;
}

/**
 * Confirma uma transação
 * @param {Object} session - Sessão da transação
 * @returns {Promise<void>}
 */
async function commitTransaction(session) {
  await session.commitTransaction();
  await session.endSession();
}

/**
 * Cancela uma transação
 * @param {Object} session - Sessão da transação
 * @returns {Promise<void>}
 */
async function abortTransaction(session) {
  await session.abortTransaction();
  await session.endSession();
}

module.exports = {
  connect,
  close,
  insertOne,
  insertMany,
  findById,
  find,
  findOne,
  updateById,
  updateMany,
  deleteById,
  deleteMany,
  count,
  aggregate,
  createIndex,
  collectionExists,
  startTransaction,
  commitTransaction,
  abortTransaction
}; 