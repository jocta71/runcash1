// Endpoint para buscar assinaturas do usuário
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  const { userId } = req.query;

  // Validar parâmetro obrigatório
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'O ID do usuário é obrigatório'
    });
  }

  let client;
  
  try {
    // Verificar se MongoDB está configurado
    if (!process.env.MONGODB_URI) {
      console.warn('MongoDB não configurado. URI ausente.');
      return res.status(500).json({
        success: false,
        error: 'Configuração do banco de dados ausente'
      });
    }

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    console.log(`Buscando assinaturas para o usuário ${userId}...`);
    
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    
    // Buscar todas as assinaturas do usuário, ordenadas por data de criação (mais recentes primeiro)
    const subscriptions = await db.collection('subscriptions')
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .toArray();
    
    console.log(`Encontradas ${subscriptions.length} assinaturas para o usuário ${userId}`);
    
    // Enriquecer dados das assinaturas com informações de pagamento se necessário
    for (const subscription of subscriptions) {
      if (subscription.payment_id) {
        try {
          const payment = await db.collection('payments')
            .findOne({ payment_id: subscription.payment_id });
          
          if (payment) {
            subscription.payment_status = payment.status;
            subscription.payment_date = payment.payment_date;
            subscription.payment_method = payment.payment_method;
          }
        } catch (paymentError) {
          console.error(`Erro ao buscar pagamento para assinatura ${subscription.subscription_id}:`, paymentError);
        }
      }
    }
    
    // Retornar resposta com as assinaturas encontradas
    return res.status(200).json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Erro ao buscar assinaturas do usuário:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar assinaturas',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 