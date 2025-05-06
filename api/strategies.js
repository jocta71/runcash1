import connectToDatabase from '../lib/mongodb'; // Caminho ajustado para api/lib
import Strategy from '../models/Strategy';   // Caminho ajustado para api/models

export default async function handler(req, res) {
  const { method } = req;

  try {
    await connectToDatabase();
  } catch (dbError) {
    console.error("Falha ao conectar ao banco de dados (api/strategies):", dbError);
    return res.status(500).json({ success: false, message: 'Falha ao conectar ao banco de dados.' });
  }

  switch (method) {
    case 'POST':
      try {
        const { name, conditions, roletaId } = req.body;

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
          name,
          conditions,
          createdAt: new Date(),
        };

        if (roletaId && roletaId.trim() !== '') {
          newStrategyData.roletaId = roletaId;
        }

        const strategy = new Strategy(newStrategyData);
        await strategy.save();

        res.status(201).json({ success: true, data: strategy, message: "Estratégia salva com sucesso!" });
      } catch (error) {
        console.error("Erro ao salvar estratégia no backend (POST api/strategies):", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: error.message || 'Erro interno do servidor ao salvar estratégia.' });
      }
      break;
    
    case 'GET':
      try {
        const strategies = await Strategy.find({}).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: strategies, count: strategies.length });
      } catch (error) {
        console.error("Erro ao buscar estratégias (GET api/strategies):", error);
        res.status(500).json({ success: false, message: 'Erro ao buscar estratégias.' });
      }
      break;

    default:
      res.setHeader('Allow', ['POST', 'GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
} 