const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

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
    // Obter e validar os dados necessários
    const { 
      customerId, 
      planId, 
      paymentMethod, 
      creditCard, 
      creditCardHolderInfo,
      userId
    } = req.body;

    // Validar campos obrigatórios
    if (!customerId || !planId || !paymentMethod || !userId) {
      return res.status(400).json({ 
        error: 'Dados incompletos', 
        details: 'ID do cliente, ID do plano, método de pagamento e ID do usuário são obrigatórios' 
      });
    }

    // Validar cartão de crédito quando o método de pagamento for CREDIT_CARD
    if (paymentMethod === 'CREDIT_CARD' && (!creditCard || !creditCardHolderInfo)) {
      return res.status(400).json({ 
        error: 'Dados de cartão incompletos', 
        details: 'Para pagamentos com cartão de crédito, os dados do cartão e do titular são obrigatórios' 
      });
    }

    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Buscar o plano no MongoDB
    const plan = await db.collection('plans').findOne({ _id: new ObjectId(planId) });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Verificar se já existe uma assinatura ativa para este usuário
    const existingSubscription = await db.collection('subscriptions').findOne({
      user_id: userId,
      status: { $in: ['ACTIVE', 'PENDING'] }
    });

    if (existingSubscription) {
      return res.status(409).json({ 
        error: 'Assinatura já existe', 
        details: 'O usuário já possui uma assinatura ativa ou pendente',
        subscriptionId: existingSubscription.asaas_id
      });
    }

    // Configurar chamada para API do Asaas
    const asaasBaseUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
    const asaasApiKey = process.env.ASAAS_API_KEY;

    if (!asaasApiKey) {
      throw new Error('Chave da API do Asaas não configurada');
    }

    // Preparar dados para criação da assinatura no Asaas
    const subscriptionData = {
      customer: customerId,
      billingType: paymentMethod,
      value: plan.price_monthly,
      nextDueDate: new Date().toISOString().split('T')[0], // Hoje
      cycle: 'MONTHLY',
      description: `Assinatura - ${plan.name}`,
      creditCard: paymentMethod === 'CREDIT_CARD' ? creditCard : undefined,
      creditCardHolderInfo: paymentMethod === 'CREDIT_CARD' ? creditCardHolderInfo : undefined
    };

    // Criar assinatura no Asaas
    const response = await axios.post(
      `${asaasBaseUrl}/subscriptions`,
      subscriptionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    const asaasSubscriptionId = response.data.id;
    const paymentId = response.data.payments?.[0]?.id;
    
    // Salvar assinatura no MongoDB
    const subscriptionDoc = {
      user_id: userId,
      plan_id: planId,
      asaas_id: asaasSubscriptionId,
      payment_id: paymentId,
      customer_id: customerId,
      payment_method: paymentMethod,
      value: plan.price_monthly,
      cycle: 'MONTHLY',
      status: response.data.status,
      next_due_date: new Date(response.data.nextDueDate),
      created_at: new Date(),
      updated_at: new Date(),
      payment_history: [{
        payment_id: paymentId,
        status: 'PENDING',
        value: plan.price_monthly,
        description: `Pagamento inicial - ${plan.name}`,
        payment_date: new Date(),
        due_date: new Date(response.data.nextDueDate)
      }]
    };

    const result = await db.collection('subscriptions').insertOne(subscriptionDoc);

    // Atualizar o usuário com a informação do plano e assinatura
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          plan_id: planId,
          subscription_id: result.insertedId.toString(),
          subscription_status: response.data.status,
          updated_at: new Date()
        } 
      }
    );

    console.log(`Assinatura criada no Asaas: ${asaasSubscriptionId} para usuário ${userId}, plano ${planId}`);
    
    // Responder com sucesso
    return res.status(201).json({
      subscriptionId: asaasSubscriptionId,
      paymentId: paymentId,
      status: response.data.status,
      message: 'Assinatura criada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error);
    
    // Tratar erros específicos da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro ao criar assinatura',
      message: error.message 
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 