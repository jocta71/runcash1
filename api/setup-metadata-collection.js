/**
 * Script para criar e popular a coleção metadados_roletas no MongoDB
 * Execute com: node api/setup-metadata-collection.js
 */

const { MongoClient } = require('mongodb');

// Configuração do MongoDB (usando a mesma conexão de query.js)
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const ROLETAS_DB_NAME = process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db';
const METADATA_COLLECTION_NAME = 'metadados_roletas';

// Dados a serem inseridos na coleção metadados_roletas
const roletasMetadata = [
  { "roleta_id": "2010108", "roleta_nome": "Dragonara Roulette" },
  { "roleta_id": "2380038", "roleta_nome": "Roulette Macao" },
  { "roleta_id": "2380117", "roleta_nome": "VIP Roulette" },
  { "roleta_id": "2380032", "roleta_nome": "Russian Roulette" },
  { "roleta_id": "2380033", "roleta_nome": "German Roulette" },
  { "roleta_id": "2380039", "roleta_nome": "Turkish Roulette" },
  { "roleta_id": "2380346", "roleta_nome": "VIP Auto Roulette" },
  { "roleta_id": "2010170", "roleta_nome": "Lightning Roulette Italia" },
  { "roleta_id": "2010106", "roleta_nome": "Türkçe Rulet" },
  { "roleta_id": "2010049", "roleta_nome": "Ruletka Live" },
  { "roleta_id": "2010098", "roleta_nome": "Auto-Roulette VIP" },
  { "roleta_id": "2010012", "roleta_nome": "American Roulette" },
  { "roleta_id": "2010440", "roleta_nome": "XXXtreme Lightning Roulette" },
  { "roleta_id": "2010165", "roleta_nome": "Roulette" },
  { "roleta_id": "2010016", "roleta_nome": "Immersive Roulette" },
  { "roleta_id": "2010096", "roleta_nome": "Speed Auto Roulette" },
  { "roleta_id": "2010143", "roleta_nome": "Ruleta Relámpago en Vivo" },
  { "roleta_id": "2010045", "roleta_nome": "Ruleta en Vivo" },
  { "roleta_id": "2380335", "roleta_nome": "Brazilian Mega Roulette" },
  { "roleta_id": "2010065", "roleta_nome": "Bucharest Auto-Roulette" },
  { "roleta_id": "2380034", "roleta_nome": "Roulette Italia Tricolore" },
  { "roleta_id": "2010110", "roleta_nome": "Hippodrome Grand Casino" },
  { "roleta_id": "2010048", "roleta_nome": "Dansk Roulette" },
  { "roleta_id": "2010059", "roleta_nome": "Bucharest Roulette" },
  { "roleta_id": "2380010", "roleta_nome": "Speed Roulette 1" },
  { "roleta_id": "2380049", "roleta_nome": "Mega Roulette" },
  { "roleta_id": "2380159", "roleta_nome": "Romanian Roulette" },
  { "roleta_id": "2380390", "roleta_nome": "Immersive Roulette Deluxe" },
  { "roleta_id": "2380373", "roleta_nome": "Fortune Roulette" },
  { "roleta_id": "2010011", "roleta_nome": "Deutsches Roulette" },
  { "roleta_id": "2010033", "roleta_nome": "Lightning Roulette" },
  { "roleta_id": "2010100", "roleta_nome": "Venezia Roulette" },
  { "roleta_id": "2010565", "roleta_nome": "Gold Vault Roulette" },
  { "roleta_id": "2010099", "roleta_nome": "Football Studio Roulette" },
  { "roleta_id": "2010031", "roleta_nome": "Jawhara Roulette" },
  { "roleta_id": "2010336", "roleta_nome": "Türkçe Lightning Rulet" },
  { "roleta_id": "2010017", "roleta_nome": "Ruleta Automática" },
  { "roleta_id": "2380064", "roleta_nome": "Roulette 1" }
];

async function setupMetadataCollection() {
  console.log('Iniciando criação e população da coleção metadados_roletas...');
  
  let client;
  try {
    // Conectar ao MongoDB
    console.log(`Conectando ao MongoDB em ${MONGODB_URI}...`);
    client = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 15000
    });
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso!');
    
    // Obter referência ao banco de dados e coleção
    const db = client.db(ROLETAS_DB_NAME);
    
    // Verificar se a coleção já existe e, caso positivo, deletá-la
    const collections = await db.listCollections({ name: METADATA_COLLECTION_NAME }).toArray();
    if (collections.length > 0) {
      console.log(`A coleção ${METADATA_COLLECTION_NAME} já existe. Deletando...`);
      await db.collection(METADATA_COLLECTION_NAME).drop();
      console.log(`Coleção ${METADATA_COLLECTION_NAME} deletada com sucesso.`);
    }
    
    // Criar a coleção metadados_roletas
    console.log(`Criando a coleção ${METADATA_COLLECTION_NAME}...`);
    await db.createCollection(METADATA_COLLECTION_NAME);
    console.log(`Coleção ${METADATA_COLLECTION_NAME} criada com sucesso.`);
    
    // Inserir os metadados das roletas
    console.log(`Inserindo ${roletasMetadata.length} documentos na coleção ${METADATA_COLLECTION_NAME}...`);
    const result = await db.collection(METADATA_COLLECTION_NAME).insertMany(roletasMetadata);
    console.log(`Inseridos com sucesso ${result.insertedCount} documentos na coleção ${METADATA_COLLECTION_NAME}.`);
    
    // Criar índice para pesquisa rápida por ID e nome
    console.log('Criando índices para otimizar consultas...');
    await db.collection(METADATA_COLLECTION_NAME).createIndex({ roleta_id: 1 }, { unique: true });
    await db.collection(METADATA_COLLECTION_NAME).createIndex({ roleta_nome: 1 });
    console.log('Índices criados com sucesso.');
    
    console.log('Processo concluído com sucesso!');
    
  } catch (error) {
    console.error('Erro durante o processo:', error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    if (client) {
      console.log('Fechando conexão com MongoDB...');
      await client.close();
      console.log('Conexão fechada.');
    }
  }
}

// Executar o script
setupMetadataCollection().catch(console.error); 