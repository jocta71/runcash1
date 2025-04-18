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

// Configurações de timeout
const MONGODB_CONNECT_TIMEOUT = 5000; // 5 segundos
const ASAAS_REQUEST_TIMEOUT = 7000; // 7 segundos

// Instância axios configurada
const asaasClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: ASAAS_REQUEST_TIMEOUT,
  headers: { 'access_token': ASAAS_API_KEY }
});

// Função para conectar ao MongoDB com timeout
async function connectToMongo() {
  const client = new MongoClient(MONGODB_URI, { 
    serverSelectionTimeoutMS: MONGODB_CONNECT_TIMEOUT,
    connectTimeoutMS: MONGODB_CONNECT_TIMEOUT 
  });
  await client.connect();
  return client;
}

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let client;
  const startTime = Date.now();

  try {
    const { 
      planId, 
      userId, 
      customerId, 
      billingType = 'PIX',
      creditCard,
      creditCardHolderInfo 
    } = req.body;
    
    // Gerar userId automático se não for fornecido
    const userIdentifier = userId || `auto_${customerId}_${Date.now()}`;
    
    if (!planId || !customerId) {
      return res.status(400).json({ 
        error: 'Dados incompletos',
        message: 'É necessário fornecer planId e customerId'
      });
    }
    
    console.log(`[${Date.now() - startTime}ms] Iniciando criação de assinatura: planId=${planId}, userId=${userIdentifier}, customerId=${customerId}`);
    
    // Conectar ao MongoDB - com timeout e tratamento de erro
    try {
      client = await connectToMongo();
    } catch (dbError) {
      console.error(`[${Date.now() - startTime}ms] Erro ao conectar ao MongoDB:`, dbError.message);
      return res.status(500).json({ 
        error: 'Erro ao conectar ao banco de dados',
        message: 'Tente novamente mais tarde'
      });
    }
    
    const db = client.db(MONGODB_DB);
    
    // Buscar dados do plano no MongoDB - com timeout
    let planData;
    try {
      planData = await db.collection('plans').findOne({ id: planId });
      console.log(`[${Date.now() - startTime}ms] Dados do plano recuperados`);
    } catch (planError) {
      await client.close();
      console.error(`[${Date.now() - startTime}ms] Erro ao buscar plano:`, planError.message);
      return res.status(500).json({ error: 'Erro ao buscar dados do plano' });
    }
    
    if (!planData) {
      await client.close();
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    
    // Para plano gratuito, processar de forma diferente (mais rápido)
    if (planId === 'free') {
      try {
        const subscriptionId = `free_${Date.now()}`;
        
        const subscription = await db.collection('subscriptions').insertOne({
          user_id: userIdentifier,
          plan_id: planId,
          status: 'active',
          start_date: new Date(),
          payment_platform: 'free',
          payment_id: subscriptionId
        });

        await client.close();
        
        const freeSubscriptionId = subscription.insertedId.toString();
        console.log(`[${Date.now() - startTime}ms] Assinatura gratuita criada: ${freeSubscriptionId}`);
        
        return res.json({
          success: true,
          free: true,
          redirectUrl: '/payment-success?free=true',
          id: freeSubscriptionId,
          subscriptionId: freeSubscriptionId,
          data: {
            id: freeSubscriptionId,
            subscriptionId: freeSubscriptionId
          },
          status: 'ACTIVE'
        });
      } catch (freeError) {
        await client.close();
        console.error(`[${Date.now() - startTime}ms] Erro ao criar assinatura gratuita:`, freeError.message);
        return res.status(500).json({ error: 'Erro ao criar assinatura gratuita' });
      }
    }

    // Cálculo de datas e valores para a assinatura
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
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
      externalReference: userIdentifier,
    };

    // Se for pagamento com cartão, adicionar os dados
    if (billingType === 'CREDIT_CARD' && creditCard) {
      subscriptionData.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      };
      
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
    
    // Log de criação com redação de informações sensíveis
    console.log(`[${Date.now() - startTime}ms] Enviando dados para Asaas (${billingType})`);
    
    // Criar assinatura no Asaas - com timeout
    let asaasSubscription;
    try {
      const asaasResponse = await asaasClient.post('/subscriptions', subscriptionData);
      asaasSubscription = asaasResponse.data;
      console.log(`[${Date.now() - startTime}ms] Assinatura criada no Asaas: ${asaasSubscription.id}`);
    } catch (asaasError) {
      await client.close();
      console.error(`[${Date.now() - startTime}ms] Erro na API do Asaas:`, asaasError.message);
      
      // Retornar detalhes do erro da API do Asaas
      if (asaasError.response && asaasError.response.data) {
        return res.status(asaasError.response.status || 500).json({
          error: 'Erro na API do Asaas',
          details: asaasError.response.data
        });
      }
      
      return res.status(500).json({
        error: 'Erro ao criar assinatura no Asaas',
        message: asaasError.message
      });
    }
    
    // Informações adicionais para a resposta
    let paymentId = null;
    let redirectUrl = null;
    
    // Obter informações de pagamento (em paralelo ao registro no MongoDB)
    const paymentPromise = (async () => {
      try {
        if (billingType === 'PIX') {
          // Buscar pagamentos da assinatura
          const paymentsResponse = await asaasClient.get(`/payments?subscription=${asaasSubscription.id}`);
          
          if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
            paymentId = paymentsResponse.data.data[0].id;
            console.log(`[${Date.now() - startTime}ms] Pagamento PIX criado: ${paymentId}`);
          }
        }
        
        // Obter link de pagamento (exceto para cartão)
        if (billingType !== 'CREDIT_CARD') {
          try {
            const paymentLinkResponse = await asaasClient.get(`/subscriptions/${asaasSubscription.id}/paymentLink`);
            redirectUrl = paymentLinkResponse.data.url;
            console.log(`[${Date.now() - startTime}ms] Link de pagamento gerado`);
          } catch (linkError) {
            console.error(`[${Date.now() - startTime}ms] Erro ao obter link de pagamento:`, linkError.message);
            // Não falhar se não conseguir obter o link
          }
        }
      } catch (paymentError) {
        console.error(`[${Date.now() - startTime}ms] Erro ao processar informações de pagamento:`, paymentError.message);
        // Não falhar se não conseguir obter informações de pagamento
      }
    })();
    
    // Registrar assinatura no MongoDB
    let dbSubscription;
    try {
      dbSubscription = await db.collection('subscriptions').insertOne({
        user_id: userIdentifier,
        plan_id: planId,
        status: 'pending',
        payment_platform: 'asaas',
        payment_id: asaasSubscription.id,
        start_date: new Date(),
        payment_data: JSON.stringify({
          id: asaasSubscription.id,
          status: asaasSubscription.status
        }), // Armazenar apenas o essencial
        updated_at: new Date()
      });
      
      console.log(`[${Date.now() - startTime}ms] Assinatura registrada no MongoDB`);
    } catch (dbError) {
      console.error(`[${Date.now() - startTime}ms] Erro ao registrar assinatura no MongoDB:`, dbError.message);
      // Continuar mesmo com erro no MongoDB
    }
    
    // Aguardar a conclusão da promise de pagamento
    await paymentPromise;
    
    // Fechar conexão com MongoDB
    await client.close();
    
    console.log(`[${Date.now() - startTime}ms] Processo de criação de assinatura concluído`);
    
    // Retornar resposta em formato compatível com o frontend
    return res.json({
      success: true,
      id: asaasSubscription.id,
      subscriptionId: asaasSubscription.id,
      data: {
        id: asaasSubscription.id,
        subscriptionId: asaasSubscription.id
      },
      paymentId,
      redirectUrl,
      status: asaasSubscription.status,
      internalId: dbSubscription?.insertedId?.toString() || null
    });
    
  } catch (error) {
    console.error(`[${Date.now() - startTime}ms] Erro não tratado:`, error.message);
    
    // Fechar conexão com MongoDB em caso de erro
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Erro ao fechar conexão MongoDB:', closeError.message);
      }
    }
    
    return res.status(500).json({
      error: 'Erro ao processar solicitação',
      message: 'Ocorreu um erro ao processar sua solicitação. Tente novamente.'
    });
  }
}; 