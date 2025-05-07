const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Conectar ao MongoDB
const connectToDatabase = async () => {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    return { client, db, disconnect: async () => { await client.close(); } };
  } catch (error) {
    console.error("Erro ao conectar ao MongoDB:", error);
    throw error;
  }
};

// Middleware para CORS
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Criar estratégia
router.post('/', async (req, res) => {
  console.log('[api/strategy] Processando requisição POST');
  console.time('post-strategy');
  
  let connection = null;
  
  try {
    const { name, conditions, roletaId, roletaNome } = req.body;
    console.log(`[api/strategy] Dados recebidos: nome=${name}, condições=${conditions?.length}, roletaId=${roletaId || 'não informado'}, roletaNome=${roletaNome || 'não informado'}`);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'O nome da estratégia é obrigatório.' });
    }
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ success: false, message: 'Adicione pelo menos uma condição à sua estratégia.' });
    }
    
    for (const condition of conditions) {
      if (!condition.type || !condition.operator || condition.value === undefined) {
        if (typeof condition.value === 'object' && condition.value !== null) {
          const complexValue = condition.value;
          if (complexValue.color === undefined || complexValue.count === undefined) {
            return res.status(400).json({ success: false, message: `Condição do tipo '${condition.type}' está incompleta (cor ou contagem faltando).` });
          }
        } else if (typeof condition.value !== 'object' && (condition.value === '' || condition.value === null)) {
          return res.status(400).json({ success: false, message: `Condição do tipo '${condition.type}' tem um valor inválido.` });
        }
      }
    }

    const newStrategyData = {
      name: name.trim(),
      conditions,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (roletaId && roletaId.trim() !== '') {
      newStrategyData.roletaId = roletaId.trim();
    }
    
    if (roletaNome && roletaNome.trim() !== '') {
      newStrategyData.roletaNome = roletaNome.trim();
    }

    console.log('[api/strategy] Salvando estratégia no MongoDB');
    
    connection = await connectToDatabase();
    const collection = connection.db.collection('strategies');
    const result = await collection.insertOne(newStrategyData);
    
    if (!result.acknowledged) {
      throw new Error('Erro ao salvar estratégia: Operação não confirmada pelo MongoDB');
    }
    
    const savedStrategy = await collection.findOne({ _id: result.insertedId });
    
    console.timeEnd('post-strategy');
    console.log(`[api/strategy] Estratégia salva com sucesso: ${result.insertedId}`);
    
    return res.status(201).json({ 
      success: true, 
      strategy: savedStrategy,
      message: "Estratégia salva com sucesso!" 
    });
  } catch (error) {
    console.error("[api/strategy] Erro ao salvar estratégia:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Erro interno do servidor ao salvar estratégia.' 
    });
  } finally {
    if (connection) {
      try {
        await connection.disconnect();
        console.log('[api/strategy] Conexão com MongoDB fechada');
      } catch (closeError) {
        console.error('[api/strategy] Erro ao fechar conexão:', closeError);
      }
    }
  }
});

// Buscar estratégias
router.get('/', async (req, res) => {
  console.log('[api/strategy] Processando requisição GET');
  console.time('get-strategies');
  
  let connection = null;
  
  try {
    connection = await connectToDatabase();
    const collection = connection.db.collection('strategies');
    const strategies = await collection.find().sort({ createdAt: -1 }).toArray();
    
    console.timeEnd('get-strategies');
    console.log(`[api/strategy] ${strategies.length} estratégias encontradas`);
    
    return res.status(200).json({ 
      success: true, 
      data: strategies,
      count: strategies.length 
    });
  } catch (error) {
    console.error("[api/strategy] Erro ao buscar estratégias:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar estratégias.' 
    });
  } finally {
    if (connection) {
      try {
        await connection.disconnect();
        console.log('[api/strategy] Conexão com MongoDB fechada');
      } catch (closeError) {
        console.error('[api/strategy] Erro ao fechar conexão:', closeError);
      }
    }
  }
});

// Excluir estratégia
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[api/strategy] Processando requisição DELETE para o ID: ${id}`);
  console.time('delete-strategy');
  
  let connection = null;
  
  try {
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID da estratégia é obrigatório para exclusão.' });
    }

    let objectIdToDelete;
    try {
      objectIdToDelete = new ObjectId(id);
    } catch (error) {
      console.error("[api/strategy] ID inválido para exclusão:", id, error);
      return res.status(400).json({ success: false, message: 'ID da estratégia inválido.' });
    }

    connection = await connectToDatabase();
    const collection = connection.db.collection('strategies');
    const deleteResult = await collection.deleteOne({ _id: objectIdToDelete });

    console.timeEnd('delete-strategy');

    if (deleteResult.deletedCount === 1) {
      console.log(`[api/strategy] Estratégia com ID ${id} excluída com sucesso.`);
      return res.status(200).json({ success: true, message: 'Estratégia excluída com sucesso.' });
    } else {
      console.log(`[api/strategy] Nenhuma estratégia encontrada com o ID ${id} para exclusão.`);
      return res.status(404).json({ success: false, message: 'Estratégia não encontrada.' });
    }
  } catch (error) {
    console.error("[api/strategy] Erro ao excluir estratégia:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Erro interno do servidor ao excluir estratégia.' 
    });
  } finally {
    if (connection) {
      try {
        await connection.disconnect();
        console.log('[api/strategy] Conexão com MongoDB fechada');
      } catch (closeError) {
        console.error('[api/strategy] Erro ao fechar conexão:', closeError);
      }
    }
  }
});

module.exports = router; 