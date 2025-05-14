/**
 * API para listar roletas e seus metadados
 */

const { MongoClient } = require('mongodb');

// Conexão MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db';

export default async function handler(req, res) {
  try {
    // Permitir apenas GET
    if (req.method !== 'GET') {
      return res.status(405).json({ 
        mensagem: 'Método não permitido' 
      });
    }
    
    // Conectar ao MongoDB
    console.log('[API Roletas] Conectando ao MongoDB');
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 
    });
    
    await client.connect();
    const db = client.db(DB_NAME);
    
    // Verificar se existe a coleção de metadados
    const collections = await db.listCollections().toArray();
    const metadataCollection = collections.find(col => 
      col.name === 'metadados' || col.name === 'metadados_roletas'
    );
    
    let roletas = [];
    
    if (metadataCollection) {
      console.log(`[API Roletas] Buscando dados na coleção ${metadataCollection.name}`);
      
      // Buscar roletas da coleção de metadados
      roletas = await db.collection(metadataCollection.name)
        .find({})
        .project({ 
          _id: 0, 
          roleta_id: 1, 
          roleta_nome: 1,
          colecao: 1
        })
        .toArray();
      
      // Transformar para formato padronizado
      roletas = roletas.map(r => ({
        id: r.roleta_id || r.colecao,
        name: r.roleta_nome || `Roleta ${r.roleta_id || r.colecao}`
      }));
    } else {
      // Se não há coleção de metadados, listar todas as coleções numéricas
      console.log('[API Roletas] Nenhuma coleção de metadados encontrada, listando coleções');
      
      const numericCollections = collections
        .filter(col => /^\d+$/.test(col.name))
        .map(col => col.name);
      
      // Transformar em formato de roletas
      roletas = numericCollections.map(id => ({
        id,
        name: `Roleta ${id}`
      }));
    }
    
    // Ordenar por nome
    roletas.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`[API Roletas] Retornando ${roletas.length} roletas`);
    
    // Fechar conexão
    await client.close();
    
    // Retornar lista
    return res.status(200).json(roletas);
  } catch (error) {
    console.error('[API Roletas] Erro:', error);
    
    return res.status(500).json({ 
      mensagem: 'Erro ao buscar roletas', 
      erro: error.message 
    });
  }
} 