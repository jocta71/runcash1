/**
 * Script para verificar a estrutura e os campos dos documentos
 * na coleção roleta_numeros no MongoDB
 */

const { MongoClient } = require('mongodb');

// URI de conexão
const MONGODB_URI = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = "runcash";

async function checkMongoDbCollection() {
  console.log("🔍 Verificando a coleção roleta_numeros no MongoDB...");
  
  let client;
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log("✅ Conexão estabelecida com sucesso");
    
    const db = client.db(MONGODB_DB_NAME);
    const roletaNumeros = db.collection('roleta_numeros');
    
    // Contagem de documentos
    const count = await roletaNumeros.countDocuments({});
    console.log(`📊 Total de documentos na coleção: ${count}`);
    
    if (count > 0) {
      // Obter um documento de exemplo
      const sampleDoc = await roletaNumeros.findOne({});
      console.log("\n📄 Exemplo de documento:");
      console.log(JSON.stringify(sampleDoc, null, 2));
      
      // Analisar os campos desse documento
      console.log("\n🔑 Campos presentes no documento:");
      Object.keys(sampleDoc).forEach(key => {
        console.log(`- ${key}: ${typeof sampleDoc[key]} (${JSON.stringify(sampleDoc[key])})`);
      });
      
      // Verificar valores da cor
      const corValues = await roletaNumeros.distinct('cor');
      console.log("\n🎨 Valores distintos para o campo 'cor':");
      console.log(corValues);
      
      // Obter os 5 números mais recentes
      console.log("\n🕒 5 entradas mais recentes:");
      const recentDocs = await roletaNumeros
        .find({})
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray();
      
      recentDocs.forEach((doc, index) => {
        console.log(`\n[${index + 1}] Número: ${doc.numero}, Cor: ${doc.cor}, Timestamp: ${doc.timestamp}`);
      });
    } else {
      console.log("⚠️ A coleção está vazia");
    }
  } catch (error) {
    console.error("❌ Erro ao acessar o MongoDB:", error);
  } finally {
    if (client) {
      await client.close();
      console.log("\n✅ Conexão fechada");
    }
  }
}

// Executar a verificação
checkMongoDbCollection(); 