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
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_ENABLED = process.env.MONGODB_ENABLED;

console.log("\nVerificando variáveis de ambiente:");
console.log(`MONGODB_URI: ${MONGODB_URI ? '✅ definida' : '❌ não definida'}`);
console.log(`MONGODB_ENABLED: ${MONGODB_ENABLED ? '✅ definida' : '❌ não definida'}`);

if (isRailway && (!MONGODB_URI || !MONGODB_ENABLED || MONGODB_ENABLED.toLowerCase() !== 'true')) {
  console.log("\n⚠️ Variáveis de ambiente para MongoDB não estão configuradas corretamente no Railway!");
  console.log("\nSolução: Você precisa definir as seguintes variáveis de ambiente no Railway:");
  console.log("1. MONGODB_URI = mongodb+srv://<seu-usuario>:<sua-senha>@<seu-cluster>/runcash");
  console.log("2. MONGODB_ENABLED = true");
  console.log("3. MONGODB_DB_NAME = runcash (ou o nome que você escolher)");
  
  console.log("\nPara configurar estas variáveis no Railway:");
  console.log("1. Acesse o dashboard do Railway");
  console.log("2. Selecione seu projeto");
  console.log("3. Acesse a aba 'Variables'");
  console.log("4. Adicione as variáveis mencionadas acima");
  
  console.log("\nAlém disso, você deve garantir que o MongoDB está provisionado:");
  console.log("1. No dashboard do Railway, clique em 'New'");
  console.log("2. Selecione 'Database' > 'MongoDB'");
  console.log("3. Conecte esse banco de dados ao seu serviço");
} else if (!isRailway) {
  console.log("\nDica para ambiente local:");
  console.log("Crie um arquivo .env na raiz do projeto com as seguintes variáveis:");
  console.log("MONGODB_URI=mongodb://localhost:27017/runcash");
  console.log("MONGODB_ENABLED=true");
  console.log("MONGODB_DB_NAME=runcash");
}

// Verificar conexão com o MongoDB
if (MONGODB_URI) {
  console.log("\nTentando verificar conexão com o MongoDB...");
  
  const { MongoClient } = require('mongodb');
  
  const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  });
  
  client.connect()
    .then(async () => {
      console.log("✅ Conexão com MongoDB estabelecida com sucesso!");
      
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
        }
      } else {
        console.log("\n⚠️ Coleção 'roleta_numeros' não encontrada!");
        console.log("Isso indica que o scraper ainda não enviou nenhum dado.");
      }
      
      await client.close();
    })
    .catch(err => {
      console.error("❌ Erro ao conectar ao MongoDB:", err.message);
    });
} else {
  console.log("\n❌ MONGODB_URI não está definida, não é possível verificar a conexão.");
} 