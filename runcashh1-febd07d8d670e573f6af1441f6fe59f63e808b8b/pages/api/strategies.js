import connectToDatabase from '../../lib/mongodb'; // Caminho para o helper de conexão
import Strategy from '../../models/Strategy';   // Caminho para o modelo Mongoose/DB

export default async function handler(req, res) {
  const { method } = req;

  // Tente conectar ao banco de dados. Se falhar, retorne um erro.
  try {
    await connectToDatabase();
  } catch (dbError) {
    console.error("Falha ao conectar ao banco de dados:", dbError);
    return res.status(500).json({ success: false, message: 'Falha ao conectar ao banco de dados.' });
  }

  switch (method) {
    case 'POST':
      try {
        const { name, conditions, roletaId } = req.body;

        // Validação básica no backend
        if (!name || !name.trim()) {
          return res.status(400).json({ success: false, message: 'O nome da estratégia é obrigatório.' });
        }
        if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
          return res.status(400).json({ success: false, message: 'Adicione pelo menos uma condição à sua estratégia.' });
        }
        
        // Validação mais detalhada das condições (exemplo)
        for (const condition of conditions) {
          if (!condition.type || !condition.operator || condition.value === undefined) {
            // Para tipos complexos, value é um objeto e precisa de validação interna
            if (typeof condition.value === 'object' && condition.value !== null) {
              const complexValue = condition.value;
              if (complexValue.color === undefined || complexValue.count === undefined) {
                 return res.status(400).json({ success: false, message: `Condição do tipo '${condition.type}' está incompleta (cor ou contagem faltando).` });
              }
            } else if (typeof condition.value !== 'object' && (condition.value === '' || condition.value === null)) {
              // Para tipos simples, valor não pode ser vazio/nulo se já passou a validação inicial de undefined
              return res.status(400).json({ success: false, message: `Condição do tipo '${condition.type}' tem um valor inválido.` });
            }
          }
        }

        // TODO: Obter userId se você tiver autenticação
        // const userId = getUserIdFromRequest(req); // Função hipotética

        const newStrategyData = {
          name,
          conditions,
          // userId, // Se tiver usuários
          createdAt: new Date(),
        };

        // Adicionar roletaId apenas se fornecido e não vazio
        if (roletaId && roletaId.trim() !== '') {
          newStrategyData.roletaId = roletaId;
        }

        const strategy = new Strategy(newStrategyData);
        await strategy.save();

        res.status(201).json({ success: true, data: strategy, message: "Estratégia salva com sucesso!" });
      } catch (error) {
        console.error("Erro ao salvar estratégia no backend (POST /api/strategies):", error);
        // Verifica se é um erro de validação do Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: error.message || 'Erro interno do servidor ao salvar estratégia.' });
      }
      break;
    case 'GET':
      try {
        // TODO: Adicionar filtros como req.query.userId ou req.query.roletaId se necessário
        // Exemplo: const { userId } = req.query;
        // const queryOptions = userId ? { userId } : {};
        // const strategies = await Strategy.find(queryOptions).sort({ createdAt: -1 });
        
        const strategies = await Strategy.find({}).sort({ createdAt: -1 }); // Busca todas e ordena pelas mais recentes
        
        res.status(200).json({ success: true, data: strategies, count: strategies.length });
      } catch (error) {
        console.error("Erro ao buscar estratégias (GET /api/strategies):", error);
        res.status(500).json({ success: false, message: 'Erro ao buscar estratégias.' });
      }
      break;
    default:
      res.setHeader('Allow', ['POST', 'GET']); // Adicionado 'GET' aos métodos permitidos
      res.status(405).end(`Method ${method} Not Allowed`);
  }
} 