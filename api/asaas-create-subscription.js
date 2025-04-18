const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações da API Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

// URL do MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DATABASE || 'runcash';

module.exports = async (req, res) => {
  // Configurar CORS para aceitar qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar POST para criar assinaturas
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let client;

  try {
    const { 
      planId, 
      userId, 
      customerId, 
      billingType = 'PIX',
      creditCard,
      creditCardHolderInfo 
    } = req.body;
    
    if (!planId || !userId || !customerId) {
      return res.status(400).json({ 
        error: 'Dados incompletos',
        message: 'É necessário fornecer planId, userId e customerId'
      });
    }
    
    console.log(`Iniciando criação de assinatura: planId=${planId}, userId=${userId}, customerId=${customerId}`);
    
    // Conectar ao MongoDB para buscar os dados do plano
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB);
    
    // Buscar dados do plano no MongoDB
    const planData = await db.collection('plans').findOne({ id: planId });
    
    if (!planData) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    
    // Para plano gratuito, processar de forma diferente
    if (planId === 'free') {
      // Criar registro de assinatura no MongoDB
      const subscriptionId = `free_${Date.now()}`;
      
      const subscription = await db.collection('subscriptions').insertOne({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        start_date: new Date(),
        payment_platform: 'free',
        payment_id: subscriptionId
      });

      return res.json({
        success: true,
        free: true,
        redirectUrl: '/payment-success?free=true',
        subscriptionId: subscription.insertedId.toString(),
        status: 'ACTIVE'
      });
    }

    // Calcular dados para a assinatura
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); // Definir vencimento para o dia seguinte
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    const cycle = planData.interval === 'monthly' ? 'MONTHLY' : 'YEARLY';
    const value = planData.price;

    // Dados para criar a assinatura no Asaas
    const subscriptionData = {
      customer: customerId,
      billingType,
      value,
      nextDueDate: nextDueDateStr,
      cycle,
      description: `Assinatura ${planData.name} - ${planData.interval}`,
      externalReference: userId,
    };

    // Se for pagamento com cartão, adicionar os dados
    if (billingType === 'CREDIT_CARD' && creditCard) {
      // Adicionar dados do cartão
      subscriptionData.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      };
      
      // Adicionar dados do titular se fornecidos
      if (creditCardHolderInfo) {
        subscriptionData.creditCardHolderInfo = {
          name: creditCardHolderInfo.name || creditCard.holderName,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj,
          postalCode: creditCardHolderInfo.postalCode,
          addressNumber: creditCardHolderInfo.addressNumber,
          addressComplement: creditCardHolderInfo.addressComplement,
          phone: creditCardHolderInfo.phone
        };
      }
    }
    
    console.log('Criando assinatura no Asaas:', {
      ...subscriptionData,
      creditCard: subscriptionData.creditCard ? {
        ...subscriptionData.creditCard,
        number: '************' + (subscriptionData.creditCard.number || '').slice(-4),
        ccv: '***'
      } : undefined,
      creditCardHolderInfo: subscriptionData.creditCardHolderInfo ? {
        ...subscriptionData.creditCardHolderInfo,
        cpfCnpj: '********'
      } : undefined
    });
    
    // Criar assinatura no Asaas
    const asaasResponse = await axios.post(
      `${API_BASE_URL}/subscriptions`, 
      subscriptionData,
      { headers: { 'access_token': ASAAS_API_KEY } }
    );
    
    const asaasSubscription = asaasResponse.data;
    console.log('Assinatura criada no Asaas:', asaasSubscription);
    
    // Obter o pagamento ou link de pagamento
    let paymentId = null;
    let redirectUrl = null;
    
    // Se for PIX, buscar o primeiro pagamento para obter o QR code depois
    if (billingType === 'PIX') {
      // Buscar os pagamentos da assinatura
      const paymentsResponse = await axios.get(
        `${API_BASE_URL}/payments?subscription=${asaasSubscription.id}`,
        { headers: { 'access_token': ASAAS_API_KEY } }
      );
      
      if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
        paymentId = paymentsResponse.data.data[0].id;
        console.log('Pagamento PIX criado:', paymentId);
      }
    }
    
    // Se for cartão, não precisamos do link, pois o pagamento é automático
    if (billingType === 'CREDIT_CARD') {
      console.log('Pagamento com cartão processado automaticamente');
    } else {
      // Para outros métodos como PIX, obter o link de pagamento
      try {
        const paymentLinkResponse = await axios.get(
          `${API_BASE_URL}/subscriptions/${asaasSubscription.id}/paymentLink`,
          { headers: { 'access_token': ASAAS_API_KEY } }
        );
        redirectUrl = paymentLinkResponse.data.url;
        console.log('Link de pagamento gerado:', redirectUrl);
      } catch (linkError) {
        console.error('Erro ao obter link de pagamento:', linkError.message);
        // Continuar mesmo sem o link, pois a assinatura já foi criada
      }
    }
    
    // Registrar assinatura no MongoDB
    const dbSubscription = await db.collection('subscriptions').insertOne({
      user_id: userId,
      plan_id: planId,
      status: 'pending',
      payment_platform: 'asaas',
      payment_id: asaasSubscription.id,
      start_date: new Date(),
      payment_data: JSON.stringify(asaasSubscription),
      updated_at: new Date()
    });
    
    return res.json({
      success: true,
      subscriptionId: asaasSubscription.id,
      paymentId,
      redirectUrl,
      status: asaasSubscription.status,
      internalId: dbSubscription.insertedId.toString()
    });
    
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 