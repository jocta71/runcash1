/**
 * Script para verificar e configurar o MongoDB no Railway
 * 
 * Este script verifica se as variáveis de ambiente necessárias estão definidas
 * no ambiente Railway e as configura se necessário.
 */

const { exec } = require('child_process');
require('dotenv').config();

// Verificar se estamos no Railway
const isRailway = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_SERVICE_ID;

console.log("==== Script de verificação e configuração do MongoDB ====");
console.log(`Ambiente: ${isRailway ? 'Railway' : 'Local'}`);

// Verificar variáveis de ambiente
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash';
const MONGODB_ENABLED = process.env.MONGODB_ENABLED || 'true';
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://runcash1-production.up.railway.app';

console.log("\nVerificando variáveis de ambiente:");
console.log(`MONGODB_URI: ${MONGODB_URI ? '✅ definida' : '❌ não definida'}`);
console.log(`MONGODB_ENABLED: ${MONGODB_ENABLED ? '✅ definida' : '❌ não definida'}`);
console.log(`RAILWAY_URL: ${RAILWAY_URL ? '✅ definida' : '❌ não definida'}`);

if (isRailway && (!MONGODB_URI || !MONGODB_ENABLED || MONGODB_ENABLED.toLowerCase() !== 'true')) {
  console.log("\n⚠️ Variáveis de ambiente para MongoDB não estão configuradas corretamente no Railway!");
  console.log("\nSolução: Você precisa definir as seguintes variáveis de ambiente no Railway:");
  console.log("1. MONGODB_URI = mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash");
  console.log("2. MONGODB_ENABLED = true");
  console.log("3. MONGODB_DB_NAME = runcash");
  
  console.log("\nPara configurar estas variáveis no Railway:");
  console.log("1. Acesse o dashboard do Railway");
  console.log("2. Selecione seu projeto");
  console.log("3. Acesse a aba 'Variables'");
  console.log("4. Adicione as variáveis mencionadas acima");
} else if (!isRailway) {
  console.log("\nDica para ambiente local:");
  console.log("Crie um arquivo .env na raiz do projeto com as seguintes variáveis:");
  console.log("MONGODB_URI=mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash");
  console.log("MONGODB_ENABLED=true");
  console.log("MONGODB_DB_NAME=runcash");
  console.log("RAILWAY_URL=https://runcash1-production.up.railway.app");
}

// Verificar conexão com o MongoDB
if (MONGODB_URI) {
  console.log("\nTentando verificar conexão com o MongoDB Atlas...");
  
  const { MongoClient } = require('mongodb');
  
  const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000 // Aumentando o timeout para 10 segundos
  });
  
  client.connect()
    .then(async () => {
      console.log("✅ Conexão com MongoDB Atlas estabelecida com sucesso!");
      
      const db = client.db();
      console.log(`Base de dados: ${db.databaseName}`);
      
      // Listar coleções
      const collections = await db.listCollections().toArray();
      console.log(`\nColeções disponíveis (${collections.length}):`);
      collections.forEach(col => {
        console.log(`- ${col.name}`);
      });
      
      // Verificar dados
      if (collections.find(c => c.name === 'roleta_numeros')) {
        const count = await db.collection('roleta_numeros').countDocuments();
        console.log(`\nTotal de documentos em roleta_numeros: ${count}`);
        
        if (count === 0) {
          console.log("⚠️ Nenhum documento encontrado na coleção 'roleta_numeros'");
          console.log("Isso pode indicar que o scraper não está enviando dados para o MongoDB.");
          console.log("Verifique se o scraper está rodando e se MONGODB_ENABLED=true.");
          
          // Tentar inserir um documento de teste
          console.log("\nTentando inserir um documento de teste...");
          try {
            const result = await db.collection('roleta_numeros').insertOne({
              roleta_id: 'test',
              roleta_nome: 'Roleta de Teste',
              numero: Math.floor(Math.random() * 37), // 0-36
              cor: 'vermelho',
              timestamp: new Date(),
              teste: true
            });
            
            console.log(`✅ Documento de teste inserido com sucesso! ID: ${result.insertedId}`);
            console.log("⚠️ Removendo documento de teste...");
            
            await db.collection('roleta_numeros').deleteOne({ _id: result.insertedId });
            console.log("✅ Documento de teste removido com sucesso!");
          } catch (err) {
            console.error("❌ Erro ao inserir documento de teste:", err.message);
          }
        } else {
          console.log("\nÚltimos 5 documentos inseridos:");
          const latest = await db.collection('roleta_numeros')
            .find({})
            .sort({ timestamp: -1 })
            .limit(5)
            .toArray();
          
          latest.forEach((doc, i) => {
            console.log(`${i+1}. Roleta: ${doc.roleta_nome}, Número: ${doc.numero}, Timestamp: ${doc.timestamp}`);
          });
        }
      } else {
        console.log("\n⚠️ Coleção 'roleta_numeros' não encontrada!");
        console.log("Isso indica que o scraper ainda não enviou nenhum dado.");
        console.log("Criando a coleção...");
        
        await db.createCollection('roleta_numeros');
        console.log("✅ Coleção 'roleta_numeros' criada com sucesso!");
      }
      
      // Verificar a URL do Railway
      console.log(`\nVerificando a URL do Railway (${RAILWAY_URL})...`);
      const https = require('https');
      
      // Função para fazer requisição HTTP
      const checkURL = (url) => {
        return new Promise((resolve, reject) => {
          https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              resolve({ statusCode: res.statusCode, data });
            });
          }).on('error', (err) => {
            reject(err);
          });
        });
      };
      
      try {
        const response = await checkURL(RAILWAY_URL);
        console.log(`✅ URL do Railway respondeu com status: ${response.statusCode}`);
        console.log(`Resposta: ${response.data}`);
      } catch (err) {
        console.error(`❌ Erro ao acessar a URL do Railway: ${err.message}`);
      }
      
      await client.close();
      console.log("\n✅ Verificação concluída com sucesso!");
    })
    .catch(err => {
      console.error("❌ Erro ao conectar ao MongoDB Atlas:", err.message);
      console.log("\nVerifique se:");
      console.log("1. A string de conexão está correta (incluindo usuário e senha)");
      console.log("2. O IP do seu servidor está na lista de IPs permitidos no MongoDB Atlas");
      console.log("3. O cluster do MongoDB Atlas está ativo");
    });
} else {
  console.log("\n❌ MONGODB_URI não está definida, não é possível verificar a conexão.");
} 