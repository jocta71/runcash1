/**
 * Script para testar a conexão com o MongoDB
 * Verifica se o banco de dados está acessível e lista as coleções disponíveis
 * 
 * Uso: node scripts/test-mongo-connection.js
 */

const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// Configuração
const CONNECTION_STRING = 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const DATABASE_NAME = 'runcash';

// Testar conexão usando Mongoose
async function testMongooseConnection() {
  try {
    console.log('\n=== TESTE DE CONEXÃO COM MONGOOSE ===');
    console.log('Tentando conectar via Mongoose...');
    
    await mongoose.connect(CONNECTION_STRING, {
      serverSelectionTimeoutMS: 10000, // 10 segundos para timeout
    });
    
    console.log('✅ Conexão Mongoose estabelecida com sucesso!');
    console.log(`Status da conexão: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Não conectado'}`);
    console.log(`Nome do banco de dados: ${mongoose.connection.name}`);
    
    // Listar modelos disponíveis
    console.log('\nModelos registrados:');
    const modelNames = mongoose.modelNames();
    if (modelNames.length === 0) {
      console.log('Nenhum modelo registrado.');
    } else {
      modelNames.forEach(model => console.log(`- ${model}`));
    }
    
    // Testar criação de modelo
    try {
      const testSchema = new mongoose.Schema({ name: String, testDate: { type: Date, default: Date.now } });
      const TestModel = mongoose.model('TestConnection', testSchema);
      console.log('✅ Modelo de teste criado com sucesso');
      
      // Testar operação de leitura
      const count = await TestModel.countDocuments();
      console.log(`✅ Operação de leitura bem-sucedida. Total de documentos: ${count}`);
    } catch (modelError) {
      console.error('❌ Erro ao criar/usar modelo de teste:', modelError);
    }
    
    await mongoose.disconnect();
    console.log('Conexão Mongoose fechada.');
  } catch (error) {
    console.error('❌ ERRO DE CONEXÃO MONGOOSE:', error);
  }
}

// Testar conexão usando MongoDB nativo
async function testMongoDBConnection() {
  let client;
  
  try {
    console.log('\n=== TESTE DE CONEXÃO COM MONGODB NATIVO ===');
    console.log('Tentando conectar via MongoDB nativo...');
    
    client = await MongoClient.connect(CONNECTION_STRING, {
      serverSelectionTimeoutMS: 10000 // 10 segundos para timeout
    });
    
    console.log('✅ Conexão MongoDB nativa estabelecida com sucesso!');
    
    // Listar bases de dados
    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    
    console.log('\nBases de dados disponíveis:');
    dbs.databases.forEach(db => console.log(`- ${db.name} (${db.sizeOnDisk} bytes)`));
    
    // Acessar banco de dados específico
    const db = client.db(DATABASE_NAME);
    console.log(`\nAcessando banco de dados: ${DATABASE_NAME}`);
    
    // Listar coleções
    const collections = await db.listCollections().toArray();
    
    console.log('Coleções disponíveis:');
    if (collections.length === 0) {
      console.log('Nenhuma coleção encontrada.');
    } else {
      collections.forEach(coll => console.log(`- ${coll.name}`));
    }
    
    // Contar documentos na coleção 'users'
    if (collections.some(c => c.name === 'users')) {
      const userCount = await db.collection('users').countDocuments();
      console.log(`✅ Coleção 'users': ${userCount} documentos`);
    }
    
    // Contar documentos na coleção 'subscriptions'
    if (collections.some(c => c.name === 'subscriptions')) {
      const subCount = await db.collection('subscriptions').countDocuments();
      console.log(`✅ Coleção 'subscriptions': ${subCount} documentos`);
    }
  } catch (error) {
    console.error('❌ ERRO DE CONEXÃO MONGODB NATIVO:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Conexão MongoDB nativa fechada.');
    }
  }
}

// Executar testes
async function runTests() {
  console.log('=== INICIANDO TESTES DE CONEXÃO AO MONGODB ===');
  console.log(`String de conexão: ${CONNECTION_STRING.replace(/:[^:]*@/, ':***@')}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  await testMongoDBConnection();
  await testMongooseConnection();
  
  console.log('\n=== TESTES DE CONEXÃO CONCLUÍDOS ===');
}

// Executar
runTests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Erro fatal nos testes:', error);
    process.exit(1);
  }); 