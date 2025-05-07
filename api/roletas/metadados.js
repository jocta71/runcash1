/**
 * API para retornar metadados das roletas
 * Endpoint: /api/roletas/metadados
 */

const { MongoClient } = require('mongodb');

// Configurações
const CONFIG = {
  db: {
    uri: process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash",
    name: process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db',
    metadataCollection: 'metadados_roletas',
    options: { 
      connectTimeoutMS: 10000, 
      socketTimeoutMS: 30000, 
      serverSelectionTimeoutMS: 10000 
    }
  }
};

// Função para conectar ao MongoDB
async function conectarAoMongoDB() {
  const client = new MongoClient(CONFIG.db.uri, CONFIG.db.options);
  
  try {
    await client.connect();
    return client.db(CONFIG.db.name);
  } catch (erro) {
    console.error('Erro ao conectar ao MongoDB:', erro);
    throw erro;
  }
}

// Função principal do endpoint
module.exports = async (req, res) => {
  // CORS para permitir acesso do frontend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Responder imediatamente a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verificar se é método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: true, message: 'Método não permitido' });
  }

  let client = null;
  try {
    const db = await conectarAoMongoDB();
    
    // Obter metadados da coleção
    const metadados = await db.collection(CONFIG.db.metadataCollection)
      .find({})
      .project({ roleta_id: 1, roleta_nome: 1, _id: 0 })
      .toArray();
    
    // Como fallback, usar dados do arquivo numeros_mongodb.json
    if (!metadados || metadados.length === 0) {
      // Verificar se numeros_mongodb.json existe e carregá-lo
      try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.resolve(process.cwd(), 'numeros_mongodb.json');
        
        if (fs.existsSync(filePath)) {
          const dadosArquivo = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (Array.isArray(dadosArquivo) && dadosArquivo.length > 0) {
            console.log(`Usando dados de fallback de numeros_mongodb.json (${dadosArquivo.length} roletas)`);
            return res.status(200).json(dadosArquivo);
          }
        }
      } catch (erroFallback) {
        console.error('Erro ao carregar dados de fallback:', erroFallback);
      }
    }
    
    // Retornar os metadados encontrados (ou array vazio se não encontrou)
    return res.status(200).json(metadados || []);
  } catch (erro) {
    console.error('Erro ao buscar metadados das roletas:', erro);
    return res.status(500).json({ 
      error: true, 
      message: 'Erro ao buscar metadados das roletas', 
      details: erro.message 
    });
  } finally {
    // Fechar conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 