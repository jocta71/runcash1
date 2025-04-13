/**
 * Script para testar a conexão com o MongoDB
 * 
 * Este script verifica se a configuração do MongoDB está funcionando corretamente,
 * testando a conexão e listando os bancos de dados disponíveis.
 * 
 * Uso: node test-mongodb-connection.js
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configurar dotenv para carregar o arquivo .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, './backend/api/.env') });

async function testMongoDBConnection() {
  console.log('🔍 Iniciando teste de conexão com MongoDB');
  
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ URI do MongoDB não configurada no arquivo .env');
    return;
  }
  
  console.log('✅ URI do MongoDB configurada');
  
  try {
    console.log('🔄 Tentando conectar ao MongoDB...');
    
    const client = new MongoClient(uri);
    await client.connect();
    
    console.log('✅ Conexão com MongoDB estabelecida com sucesso!');
    
    // Listar bancos de dados disponíveis
    const dbList = await client.db().admin().listDatabases();
    console.log('📊 Bancos de dados disponíveis:');
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
    
    // Fechar conexão
    await client.close();
    console.log('🔌 Conexão fechada');
    
  } catch (error) {
    console.error('❌ Erro ao conectar com MongoDB:');
    console.error(error);
    
    console.log('\n🔧 Sugestões para solução:');
    console.log('1. Verifique se a string de conexão está correta');
    console.log('2. Confirme se o IP do servidor atual está na lista de IPs permitidos no MongoDB Atlas');
    console.log('3. Verifique se o usuário e senha estão corretos');
  }
}

// Executar o teste
testMongoDBConnection(); 