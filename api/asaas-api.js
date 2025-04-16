// API unificada para Asaas
const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  console.log('=== INÍCIO DA REQUISIÇÃO UNIFICADA ASAAS ===');
  console.log('Método:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', JSON.stringify(req.query, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    console.log('Requisição OPTIONS recebida - Respondendo com 200');
    return res.status(200).end();
  }

  // Extrair a operação da URL ou parâmetros da consulta
  const path = req.url.split('?')[0];
  const operation = req.query.operation || path.split('/').pop();

  console.log(`Operação detectada: ${operation}`);

  let client;

  try {
    // Configurar Asaas
    const ASAAS_ENVIRONMENT = 'sandbox'; // Ou obter do ambiente
    const asaasBaseUrl = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
    
    const asaasApiKey = process.env.ASAAS_API_KEY;
    
    if (!asaasApiKey) {
      throw new Error('Chave da API do Asaas não configurada');
    }
    
    if (asaasApiKey === '$api_key_aqui' || asaasApiKey.includes('$api_key')) {
      throw new Error('Chave da API do Asaas inválida - valor padrão detectado');
    }

    // Configurar headers comuns para todas as solicitações
    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'RunCash/1.0',
      'access_token': asaasApiKey
    };
    
    // Conectar MongoDB (quando necessário)
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');

    // Processar operações com base no parâmetro ou caminho
    switch (operation) {
      // === CRIAR CLIENTE ===
      case 'create-customer':
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { name, email: customerEmail, cpfCnpj: customerCpfCnpj, phone, userId } = req.body;
        
        if (!name || !customerEmail || !customerCpfCnpj) {
          return res.status(400).json({
            success: false,
            error: 'Dados incompletos',
            details: 'Nome, email e CPF/CNPJ são obrigatórios'
          });
        }
        
        // Verificar cliente existente
        const existingCustomer = await db.collection('customers').findOne({
          cpf_cnpj: customerCpfCnpj.replace(/[^\d]/g, '')
        });
        
        if (existingCustomer && existingCustomer.asaas_id) {
          return res.status(200).json({
            success: true,
            data: {
              customerId: existingCustomer.asaas_id
            },
            message: 'Cliente já cadastrado'
          });
        }
        
        // Dados para criar cliente
        const customerData = {
          name,
          email: customerEmail,
          cpfCnpj: customerCpfCnpj.replace(/[^\d]/g, ''),
          mobilePhone: phone ? phone.replace(/[^\d]/g, '') : undefined,
          notificationDisabled: false
        };
        
        // Criar cliente no Asaas
        const customerResponse = await axios.post(
          `${asaasBaseUrl}/customers`,
          customerData,
          {
            headers: requestHeaders,
            validateStatus: function (status) {
              return status >= 200 && status < 500;
            }
          }
        );
        
        if (customerResponse.status !== 200 && customerResponse.status !== 201) {
          throw new Error(`Erro na API do Asaas: ${customerResponse.status} - ${JSON.stringify(customerResponse.data)}`);
        }
        
        const asaasCustomerId = customerResponse.data.id;
        
        // Salvar cliente no MongoDB
        await db.collection('customers').insertOne({
          user_id: userId,
          asaas_id: asaasCustomerId,
          name,
          email: customerEmail,
          cpf_cnpj: customerCpfCnpj,
          phone,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        return res.status(201).json({
          success: true,
          data: {
            customerId: asaasCustomerId
          },
          message: 'Cliente criado com sucesso'
        });
        
      // === CRIAR ASSINATURA ===
      case 'create-subscription':
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { 
          customerId: customerIdForSubscription, planId, value, billingType = 'CREDIT_CARD', 
          userId: subscriptionUserId,
          holderName, cardNumber, expiryMonth, expiryYear, ccv,
          holderEmail, holderCpfCnpj, holderPostalCode, holderAddressNumber, holderPhone
        } = req.body;
        
        if (!customerIdForSubscription || !planId) {
          return res.status(400).json({
            success: false,
            error: 'Dados incompletos',
            details: 'ID do cliente e ID do plano são obrigatórios'
          });
        }
        
        // Mapear nomes de planos para valores e ciclos
        const planDetails = getPlanDetails(planId, value);
        
        // Configurar dados de assinatura
        const subscriptionData = {
          customer: customerIdForSubscription,
          billingType: billingType,
          value: planDetails.value,
          nextDueDate: getNextDueDate(),
          cycle: 'MONTHLY',
          description: `Assinatura RunCash - Plano ${planId}`,
          creditCard: billingType === 'CREDIT_CARD' ? {
            holderName,
            number: cardNumber,
            expiryMonth,
            expiryYear,
            ccv
          } : undefined,
          creditCardHolderInfo: billingType === 'CREDIT_CARD' ? {
            name: holderName || undefined,
            email: holderEmail || undefined,
            cpfCnpj: holderCpfCnpj || undefined,
            postalCode: holderPostalCode || undefined,
            addressNumber: holderAddressNumber || undefined,
            phone: holderPhone || undefined
          } : undefined
        };
        
        // Remover campos undefined
        Object.keys(subscriptionData).forEach(key => {
          if (subscriptionData[key] === undefined) {
            delete subscriptionData[key];
          } else if (typeof subscriptionData[key] === 'object' && subscriptionData[key] !== null) {
            Object.keys(subscriptionData[key]).forEach(subKey => {
              if (subscriptionData[key][subKey] === undefined) {
                delete subscriptionData[key][subKey];
              }
            });
            
            // Se objeto estiver vazio após remoção, excluir o objeto
            if (Object.keys(subscriptionData[key]).length === 0) {
              delete subscriptionData[key];
            }
          }
        });
        
        // Criar assinatura no Asaas
        const subscriptionResponse = await axios.post(
          `${asaasBaseUrl}/subscriptions`,
          subscriptionData,
          {
            headers: requestHeaders,
            validateStatus: function (status) {
              return status >= 200 && status < 500;
            }
          }
        );
        
        if (subscriptionResponse.status !== 200 && subscriptionResponse.status !== 201) {
          throw new Error(`Erro na API do Asaas: ${subscriptionResponse.status} - ${JSON.stringify(subscriptionResponse.data)}`);
        }
        
        const subscription = subscriptionResponse.data;
        
        // Salvar assinatura no MongoDB
        await db.collection('subscriptions').insertOne({
          user_id: subscriptionUserId,
          customer_id: customerIdForSubscription,
          asaas_id: subscription.id,
          plan_id: planId,
          value: planDetails.value,
          status: subscription.status,
          next_due_date: subscription.nextDueDate,
          payment_link: subscription.invoiceUrl,
          payment_method: billingType,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        // Obter primeiro pagamento
        let firstPaymentId = '';
        let paymentData = null;
        
        if (subscription.payments && subscription.payments.length > 0) {
          firstPaymentId = subscription.payments[0];
          
          try {
            const paymentResponse = await axios.get(
              `${asaasBaseUrl}/payments/${firstPaymentId}`,
              {
                headers: requestHeaders
              }
            );
            
            if (paymentResponse.status === 200) {
              paymentData = paymentResponse.data;
            }
          } catch (paymentError) {
            console.error('Erro ao buscar informações do pagamento:', paymentError);
          }
        }
        
        // Resposta formatada
        return res.status(201).json({
          success: true,
          subscriptionId: subscription.id,
          paymentId: firstPaymentId,
          redirectUrl: paymentData?.invoiceUrl || subscription.invoiceUrl,
          status: subscription.status,
          value: planDetails.value,
          message: 'Assinatura criada com sucesso'
        });
        
      // === WEBHOOK ===
      case 'webhook':
        // Processar eventos de webhook
        const eventData = req.body;
        
        if (!eventData || !eventData.event) {
          return res.status(400).json({
            success: false,
            error: 'Dados de evento inválidos'
          });
        }
        
        // Salvar evento no MongoDB
        await db.collection('webhooks').insertOne({
          event_type: eventData.event,
          payload: eventData,
          created_at: new Date()
        });
        
        // Lidar com diferentes tipos de eventos
        switch (eventData.event) {
          case 'PAYMENT_CONFIRMED':
            await handlePaymentConfirmed(db, eventData);
            break;
          case 'PAYMENT_RECEIVED':
            await handlePaymentConfirmed(db, eventData);
            break;
          case 'PAYMENT_OVERDUE':
            await handlePaymentOverdue(db, eventData);
            break;
          case 'PAYMENT_REFUNDED':
            await handlePaymentRefunded(db, eventData);
            break;
          case 'SUBSCRIPTION_CANCELLED':
            await handleSubscriptionCanceled(db, eventData);
            break;
          case 'SUBSCRIPTION_RENEWED':
            await handleSubscriptionRenewed(db, eventData);
            break;
          case 'SUBSCRIPTION_DELETED':
            await handleSubscriptionDeleted(db, eventData);
            break;
        }
        
        return res.status(200).json({
          success: true,
          message: `Evento ${eventData.event} processado com sucesso`
        });
      
      // === CANCELAR ASSINATURA ===
      case 'cancel-subscription':
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { subscriptionId } = req.body;
        
        if (!subscriptionId) {
          return res.status(400).json({
            success: false,
            error: 'ID da assinatura é obrigatório'
          });
        }
        
        // Cancelar assinatura no Asaas
        const cancelResponse = await axios.post(
          `${asaasBaseUrl}/subscriptions/${subscriptionId}/cancel`,
          {},
          {
            headers: requestHeaders,
            validateStatus: function (status) {
              return status >= 200 && status < 500;
            }
          }
        );
        
        if (cancelResponse.status !== 200 && cancelResponse.status !== 204) {
          throw new Error(`Erro ao cancelar assinatura: ${cancelResponse.status} - ${JSON.stringify(cancelResponse.data)}`);
        }
        
        // Atualizar status no MongoDB
        await db.collection('subscriptions').updateOne(
          { asaas_id: subscriptionId },
          { 
            $set: { 
              status: 'CANCELLED',
              updated_at: new Date(),
              canceled_at: new Date()
            } 
          }
        );
        
        return res.status(200).json({
          success: true,
          message: 'Assinatura cancelada com sucesso'
        });
      
      // === BUSCAR CLIENTE ===
      case 'find-customer':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { customerId: customerIdToFind, cpfCnpj: cpfCnpjToFind, email: emailToFind } = req.query;
        
        if (!customerIdToFind && !cpfCnpjToFind && !emailToFind) {
          return res.status(400).json({
            success: false,
            error: 'Parâmetros insuficientes',
            details: 'É necessário informar customerId, cpfCnpj ou email'
          });
        }
        
        let customerQuery;
        
        if (customerIdToFind) {
          // Buscar por ID do cliente
          const response = await axios.get(
            `${asaasBaseUrl}/customers/${customerIdToFind}`,
            { headers: requestHeaders }
          );
          
          customerQuery = response.data;
        } else {
          // Buscar por CPF/CNPJ ou email
          let queryParams = '';
          
          if (cpfCnpjToFind) {
            queryParams = `?cpfCnpj=${cpfCnpjToFind.replace(/[^\d]/g, '')}`;
          } else if (emailToFind) {
            queryParams = `?email=${encodeURIComponent(emailToFind)}`;
          }
          
          const response = await axios.get(
            `${asaasBaseUrl}/customers${queryParams}`,
            { headers: requestHeaders }
          );
          
          customerQuery = response.data.data?.[0] || null;
        }
        
        if (!customerQuery) {
          return res.status(404).json({
            success: false,
            error: 'Cliente não encontrado'
          });
        }
        
        // Buscar assinaturas do cliente
        const subscriptionsResponse = await axios.get(
          `${asaasBaseUrl}/subscriptions?customer=${customerQuery.id}`,
          { headers: requestHeaders }
        );
        
        return res.status(200).json({
          success: true,
          customer: customerQuery,
          subscriptions: subscriptionsResponse.data.data || []
        });
      
      // === BUSCAR ASSINATURA ===
      case 'find-subscription':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { subscriptionId: subscriptionIdToFind } = req.query;
        
        if (!subscriptionIdToFind) {
          return res.status(400).json({
            success: false,
            error: 'ID da assinatura é obrigatório'
          });
        }
        
        // Buscar assinatura no Asaas
        const subscriptionInfoResponse = await axios.get(
          `${asaasBaseUrl}/subscriptions/${subscriptionIdToFind}`,
          { headers: requestHeaders }
        );
        
        // Buscar pagamentos da assinatura
        const paymentsResponse = await axios.get(
          `${asaasBaseUrl}/payments?subscription=${subscriptionIdToFind}`,
          { headers: requestHeaders }
        );
        
        return res.status(200).json({
          success: true,
          subscription: subscriptionInfoResponse.data,
          payments: paymentsResponse.data.data || []
        });
      
      // === OBTER CÓDIGO QR PIX ===
      case 'pix-qrcode':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { paymentId: pixPaymentId } = req.query;
        
        if (!pixPaymentId) {
          return res.status(400).json({
            success: false,
            error: 'ID do pagamento é obrigatório'
          });
        }
        
        // Buscar QR code PIX no Asaas
        const pixResponse = await axios.get(
          `${asaasBaseUrl}/payments/${pixPaymentId}/pixQrCode`,
          { headers: requestHeaders }
        );
        
        if (!pixResponse.data.encodedImage) {
          return res.status(400).json({
            success: false,
            error: 'QR code PIX não disponível para este pagamento'
          });
        }
        
        return res.status(200).json({
          success: true,
          qrCodeImage: pixResponse.data.encodedImage,
          qrCodeText: pixResponse.data.payload,
          expirationDate: pixResponse.data.expirationDate
        });
      
      // === BUSCAR PAGAMENTO ===
      case 'find-payment':
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { paymentId: paymentToFind } = req.query;
        
        if (!paymentToFind) {
          return res.status(400).json({
            success: false,
            error: 'ID do pagamento é obrigatório'
          });
        }
        
        // Buscar pagamento no Asaas
        const paymentInfoResponse = await axios.get(
          `${asaasBaseUrl}/payments/${paymentToFind}`,
          { headers: requestHeaders }
        );
        
        return res.status(200).json({
          success: true,
          payment: paymentInfoResponse.data
        });
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Operação não reconhecida',
          operation
        });
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      } : 'Sem resposta'
    });
    
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar requisição',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
};

// ======== FUNÇÕES AUXILIARES ========

// Obter detalhes do plano
function getPlanDetails(planId, customValue) {
  // Se tiver valor personalizado, usar ele
  if (customValue && !isNaN(parseFloat(customValue))) {
    return {
      value: parseFloat(customValue),
      name: 'Personalizado'
    };
  }
  
  // Valores padrão dos planos
  const plans = {
    basic: { value: 29.90, name: 'Básico' },
    pro: { value: 49.90, name: 'Profissional' },
    premium: { value: 99.90, name: 'Premium' }
  };
  
  return plans[planId] || { value: 29.90, name: 'Padrão' };
}

// Obter próxima data de vencimento
function getNextDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1); // Data de amanhã
  return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

// ======== HANDLERS DE EVENTOS DE WEBHOOK ========

// Pagamento confirmado
async function handlePaymentConfirmed(db, eventData) {
  const payment = eventData.payment;
  
  // Atualizar status do pagamento
  await db.collection('payments').updateOne(
    { payment_id: payment.id },
    {
      $set: {
        status: payment.status,
        confirmed_at: new Date(),
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  
  // Se pagamento associado a assinatura, atualizar status
  if (payment.subscription) {
    await db.collection('subscriptions').updateOne(
      { asaas_id: payment.subscription },
      {
        $set: {
          status: 'ACTIVE',
          updated_at: new Date()
        }
      }
    );
  }
}

// Pagamento atrasado
async function handlePaymentOverdue(db, eventData) {
  const payment = eventData.payment;
  
  // Atualizar status do pagamento
  await db.collection('payments').updateOne(
    { payment_id: payment.id },
    {
      $set: {
        status: payment.status,
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  
  // Se pagamento associado a assinatura, atualizar status
  if (payment.subscription) {
    await db.collection('subscriptions').updateOne(
      { asaas_id: payment.subscription },
      {
        $set: {
          status: 'OVERDUE',
          updated_at: new Date()
        }
      }
    );
  }
}

// Pagamento reembolsado
async function handlePaymentRefunded(db, eventData) {
  const payment = eventData.payment;
  
  // Atualizar status do pagamento
  await db.collection('payments').updateOne(
    { payment_id: payment.id },
    {
      $set: {
        status: payment.status,
        refunded_at: new Date(),
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
}

// Assinatura cancelada
async function handleSubscriptionCanceled(db, eventData) {
  const subscription = eventData.subscription;
  
  // Atualizar status da assinatura
  await db.collection('subscriptions').updateOne(
    { asaas_id: subscription.id },
    {
      $set: {
        status: 'CANCELLED',
        canceled_at: new Date(),
        updated_at: new Date()
      }
    }
  );
}

// Assinatura renovada
async function handleSubscriptionRenewed(db, eventData) {
  const subscription = eventData.subscription;
  
  // Atualizar status da assinatura
  await db.collection('subscriptions').updateOne(
    { asaas_id: subscription.id },
    {
      $set: {
        status: 'ACTIVE',
        next_due_date: subscription.nextDueDate,
        updated_at: new Date()
      }
    }
  );
}

// Assinatura excluída
async function handleSubscriptionDeleted(db, eventData) {
  const subscription = eventData.subscription;
  
  // Atualizar status da assinatura
  await db.collection('subscriptions').updateOne(
    { asaas_id: subscription.id },
    {
      $set: {
        status: 'DELETED',
        deleted_at: new Date(),
        updated_at: new Date()
      }
    }
  );
} 