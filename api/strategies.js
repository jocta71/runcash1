import connectToDatabase from './libs/mongodb'; // Caminho para api/libs/mongodb
import { ObjectId } from 'mongodb'; // Importar ObjectId para converter o ID

export default async function handler(req, res) {
  const { method } = req;
  console.log(`[api/strategies] Recebida requisição ${method}`);
  
  let connection = null;
  let client = null;
  let db = null;
  
  try {
    console.time('mongodb-connect');
    connection = await connectToDatabase();
    client = connection.client;
    db = connection.db;
    console.timeEnd('mongodb-connect');
    console.log('[api/strategies] Conexão com MongoDB estabelecida');
  } catch (dbError) {
    console.error("[api/strategies] Falha ao conectar ao banco de dados:", dbError);
    return res.status(500).json({ success: false, message: 'Falha ao conectar ao banco de dados.' });
  }

  try {
    switch (method) {
      case 'POST':
        try {
          console.log('[api/strategies] Processando requisição POST');
          console.time('post-strategy');
          
          const { name, conditions, roletaId } = req.body;
          console.log(`[api/strategies] Dados recebidos: nome=${name}, condições=${conditions?.length}, roletaId=${roletaId || 'não informado'}`);

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

          console.log('[api/strategies] Salvando estratégia diretamente no MongoDB');
          
          const collection = db.collection('strategies');
          const result = await collection.insertOne(newStrategyData);
          
          if (!result.acknowledged) {
            throw new Error('Erro ao salvar estratégia: Operação não confirmada pelo MongoDB');
          }
          
          const savedStrategy = await collection.findOne({ _id: result.insertedId });
          
          console.timeEnd('post-strategy');
          console.log(`[api/strategies] Estratégia salva com sucesso: ${result.insertedId}`);
          
          return res.status(201).json({ 
            success: true, 
            data: savedStrategy, 
            message: "Estratégia salva com sucesso!" 
          });
        } catch (error) {
          console.error("[api/strategies] Erro ao salvar estratégia:", error);
          return res.status(500).json({ 
            success: false, 
            message: error.message || 'Erro interno do servidor ao salvar estratégia.' 
          });
        }
        break;
      
      case 'GET':
        try {
          console.log('[api/strategies] Processando requisição GET');
          console.time('get-strategies');
          
          const collection = db.collection('strategies');
          const strategies = await collection.find().sort({ createdAt: -1 }).toArray();
          
          console.timeEnd('get-strategies');
          console.log(`[api/strategies] ${strategies.length} estratégias encontradas`);
          
          return res.status(200).json({ 
            success: true, 
            data: strategies, 
            count: strategies.length 
          });
        } catch (error) {
          console.error("[api/strategies] Erro ao buscar estratégias:", error);
          return res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar estratégias.' 
          });
        }
        break;

      case 'DELETE':
        try {
          const { id } = req.query;
          console.log(`[api/strategies] Processando requisição DELETE para o ID: ${id}`);
          console.time('delete-strategy');

          if (!id) {
            return res.status(400).json({ success: false, message: 'ID da estratégia é obrigatório para exclusão.' });
          }

          let objectIdToDelete;
          try {
            objectIdToDelete = new ObjectId(id);
          } catch (error) {
            console.error("[api/strategies] ID inválido para exclusão:", id, error);
            return res.status(400).json({ success: false, message: 'ID da estratégia inválido.' });
          }

          const collection = db.collection('strategies');
          const deleteResult = await collection.deleteOne({ _id: objectIdToDelete });

          console.timeEnd('delete-strategy');

          if (deleteResult.deletedCount === 1) {
            console.log(`[api/strategies] Estratégia com ID ${id} excluída com sucesso.`);
            return res.status(200).json({ success: true, message: 'Estratégia excluída com sucesso.' });
          } else {
            console.log(`[api/strategies] Nenhuma estratégia encontrada com o ID ${id} para exclusão.`);
            return res.status(404).json({ success: false, message: 'Estratégia não encontrada.' });
          }
        } catch (error) {
          console.error("[api/strategies] Erro ao excluir estratégia:", error);
          return res.status(500).json({ 
            success: false, 
            message: error.message || 'Erro interno do servidor ao excluir estratégia.' 
          });
        }
        break;

      default:
        res.setHeader('Allow', ['POST', 'GET', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } finally {
    if (connection) {
      try {
        await connection.disconnect();
        console.log('[api/strategies] Conexão com MongoDB fechada');
      } catch (closeError) {
        console.error('[api/strategies] Erro ao fechar conexão:', closeError);
      }
    }
  }
} 