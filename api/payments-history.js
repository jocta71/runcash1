const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Obter parâmetros
  const { customerId, userId, limit = 20, offset = 0 } = req.query;
  
  if (!customerId && !userId) {
    return res.status(400).json({ error: 'É necessário informar customerId ou userId' });
  }

  let client;
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    let customerAsaasId = customerId;
    
    // Se foi fornecido userId, precisamos encontrar o customerId correspondente
    if (!customerAsaasId && userId) {
      const customer = await db.collection('customers').findOne({ user_id: userId });
      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado para este usuário' });
      }
      customerAsaasId = customer.asaas_id;
    }
    
    // Buscar pagamentos no MongoDB
    const payments = await db.collection('payments')
      .find({ customer_id: customerAsaasId })
      .sort({ date: -1, created_at: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .toArray();
    
    // Verificar se precisamos buscar dados adicionais do Asaas
    // (por exemplo, se tivermos poucos registros no MongoDB)
    let asaasPayments = [];
    if (payments.length < limit) {
      try {
        // Buscar pagamentos diretamente do Asaas
        const response = await axios.get(
          `${ASAAS_BASE_URL}/payments?customer=${customerAsaasId}&limit=${limit}&offset=${offset}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'RunCash/1.0',
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        if (response.data && response.data.data) {
          // Filtrar para remover pagamentos que já temos no MongoDB
          const existingIds = new Set(payments.map(p => p.asaas_id));
          asaasPayments = response.data.data
            .filter(p => !existingIds.has(p.id))
            .map(p => ({
              asaas_id: p.id,
              customer_id: p.customer,
              value: p.value,
              net_value: p.netValue,
              status: p.status,
              due_date: p.dueDate,
              billing_type: p.billingType,
              invoice_url: p.invoiceUrl,
              description: p.description,
              external: true // Marcar que veio diretamente do Asaas
            }));
          
          // Opcional: salvar esses pagamentos no MongoDB para consultas futuras
          if (asaasPayments.length > 0) {
            await db.collection('payments').insertMany(
              asaasPayments.map(p => ({
                ...p,
                created_at: new Date(),
                updated_at: new Date()
              }))
            );
          }
        }
      } catch (asaasError) {
        console.error('Erro ao buscar pagamentos no Asaas:', asaasError);
        // Não vamos falhar a requisição, apenas logar o erro
      }
    }
    
    // Buscar dados da assinatura para enriquecer a resposta
    let subscription = null;
    try {
      subscription = await db.collection('subscriptions')
        .findOne({ customer_id: customerAsaasId, status: { $in: ['ACTIVE', 'PENDING'] } });
    } catch (subError) {
      console.error('Erro ao buscar dados da assinatura:', subError);
    }
    
    // Combinar pagamentos do MongoDB com os do Asaas, sem duplicações
    const allPayments = [...payments, ...asaasPayments];
    
    // Contar total de pagamentos (para paginação)
    const totalCount = await db.collection('payments').countDocuments({ customer_id: customerAsaasId });
    
    return res.status(200).json({
      success: true,
      data: {
        payments: allPayments,
        subscription: subscription,
        pagination: {
          total: totalCount + (payments.length < limit ? asaasPayments.length : 0),
          offset: parseInt(offset),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de pagamentos:', error);
    return res.status(500).json({ error: 'Erro ao buscar histórico de pagamentos' });
  } finally {
    if (client) await client.close();
  }
}; 