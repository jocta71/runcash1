const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client;
  try {
    // Extrair dados do corpo da requisição
    const {
      customerId,
      planId,
      userId,
      creditCard,
      creditCardHolderInfo,
      billingType = 'CREDIT_CARD',
      nextDueDate,
      value
    } = req.body;

    // Validação dos campos obrigatórios
    if (!customerId || !planId || !userId) {
      return res.status(400).json({
        error: 'Dados incompletos',
        message: 'Os campos customerId, planId e userId são obrigatórios'
      });
    }

    // Para pagamentos com cartão de crédito, validar dados do cartão
    if (billingType === 'CREDIT_CARD') {
      if (!creditCard || !creditCardHolderInfo) {
        return res.status(400).json({
          error: 'Dados de pagamento incompletos',
          message: 'Para pagamento com cartão, é necessário fornecer os dados do cartão e do titular'
        });
      }
      
      // Validar informações do titular do cartão
      const { name, email, cpfCnpj, postalCode, addressNumber, phone } = creditCardHolderInfo;
      if (!name || !email || !cpfCnpj || !postalCode || !addressNumber || !phone) {
        return res.status(400).json({
          error: 'Dados do titular incompletos',
          message: 'Todos os dados do titular do cartão são obrigatórios'
        });
      }
    }

    // Configuração da API Asaas
    const apiKey = process.env.ASAAS_API_KEY;
    const apiBaseUrl = process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!apiKey) {
      console.error('Chave da API Asaas não configurada');
      return res.status(500).json({ error: 'Configuração do servidor incompleta' });
    }

    // Conectar ao MongoDB para obter dados do plano
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Buscar informações do plano
    const plan = await db.collection('plans').findOne({ _id: planId });
    if (!plan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Preparar dados da assinatura
    const subscription = {
      customer: customerId,
      billingType,
      value: value || plan.price,
      nextDueDate: nextDueDate || new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
      cycle: 'MONTHLY',
      description: `Assinatura do plano ${plan.name}`,
      externalReference: userId
    };

    // Adicionar dados do cartão para pagamento com cartão de crédito
    if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
      subscription.creditCard = creditCard;
      subscription.creditCardHolderInfo = creditCardHolderInfo;
    }

    console.log('Criando assinatura no Asaas:', JSON.stringify(subscription, null, 2).replace(/,"creditCard":\{.*?\}/g, ',"creditCard":"[REDACTED]"'));

    // Criar assinatura na API Asaas
    const response = await axios.post(`${apiBaseUrl}/subscriptions`, subscription, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      }
    });

    console.log('Resposta da criação de assinatura:', response.data);

    // Salvar assinatura no MongoDB
    const subscriptionData = {
      userId,
      planId,
      customerId,
      asaasId: response.data.id,
      status: response.data.status,
      value: response.data.value,
      nextDueDate: response.data.nextDueDate,
      cycle: response.data.cycle,
      billingType: response.data.billingType,
      description: response.data.description,
      asaasData: response.data,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('subscriptions').insertOne(subscriptionData);
    console.log(`Assinatura salva no MongoDB com ID: ${result.insertedId}`);

    // Atualizar usuário com informações da assinatura (plano ativo)
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          activePlan: planId,
          activeSubscription: subscriptionData.asaasId,
          subscriptionStatus: response.data.status,
          updated_at: new Date()
        } 
      }
    );

    return res.status(201).json({
      message: 'Assinatura criada com sucesso',
      subscription: {
        id: response.data.id,
        status: response.data.status,
        nextDueDate: response.data.nextDueDate
      }
    });

  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    
    // Verificar se o erro é da API Asaas
    if (error.response && error.response.data) {
      console.error('Erro API Asaas:', error.response.data);
      return res.status(error.response.status || 500).json({
        error: 'Erro ao processar a requisição no Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({ 
      error: 'Erro ao processar a requisição',
      message: error.message 
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 