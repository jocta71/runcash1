/**
 * Script para testar a conexão com o MongoDB
 * Executar com: node test-mongodb.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME;

async function testarConexao() {
  let client;
  
  try {
    console.log('=== TESTE DE CONEXÃO COM MONGODB ===');
    console.log(`Conectando ao MongoDB: ${MONGODB_URI.replace(/:.*@/, ':****@')}`);
    console.log(`Banco de dados: ${DB_NAME}`);
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Conectado ao MongoDB com sucesso');
    
    const db = client.db(DB_NAME);
    
    // Listar coleções
    const collections = await db.listCollections().toArray();
    console.log('\n=== COLEÇÕES DISPONÍVEIS ===');
    collections.forEach(col => console.log(`- ${col.name}`));
    
    // Verificar roletas
    const roletasCollection = db.collection('roletas');
    const roletas = await roletasCollection.find({}).toArray();
    console.log(`\n=== ROLETAS (${roletas.length}) ===`);
    roletas.forEach((r, i) => {
      if (i < 10) { // Mostrar apenas as 10 primeiras para não sobrecarregar a saída
        console.log(`- ${r.nome || 'Sem nome'} (ID: ${r._id})`);
      }
    });
    
    if (roletas.length > 10) {
      console.log(`... e mais ${roletas.length - 10} roletas`);
    }
    
    // Verificar números
    const numerosCollection = db.collection('roleta_numeros');
    const count = await numerosCollection.countDocuments();
    console.log(`\n=== NÚMEROS DE ROLETA (${count} registros) ===`);
    
    if (count > 0) {
      const recentes = await numerosCollection
        .find({})
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray();
      
      console.log('Registros mais recentes:');
      recentes.forEach(n => {
        console.log(`- ${n.roleta_nome}: ${n.numero} (${n.cor}) - ${new Date(n.timestamp).toLocaleString()}`);
      });
      
      // Contar por roleta
      const porRoleta = await numerosCollection.aggregate([
        { $group: { _id: "$roleta_nome", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      console.log('\nDistribuição por roleta (top 10):');
      porRoleta.forEach(r => {
        console.log(`- ${r._id}: ${r.count} números`);
      });
    } else {
      console.log('⚠️ Nenhum número encontrado na coleção');
    }
    
    console.log('\n=== TESTE CONCLUÍDO COM SUCESSO ===');
    
  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Conexão fechada.');
    }
  }
}

// Executar o teste
testarConexao(); 