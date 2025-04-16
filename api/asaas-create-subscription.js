const { MongoClient } = require('mongodb');
const axios = require('axios');

const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

// Determinar ambiente do Asaas (sandbox ou produção)
// Forçar uso do sandbox enquanto estamos em teste
const ASAAS_ENVIRONMENT = 'sandbox'; 
console.log(`Usando ambiente Asaas: ${ASAAS_ENVIRONMENT}`);

// URL da API baseada no ambiente
const ASAAS_API_URL = ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

module.exports = async (req, res) => {
  console.log('=== INÍCIO DA REQUISIÇÃO DE ASSINATURA ===');
  console.log('Método:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body (parcial):', JSON.stringify({
    ...req.body,
    creditCard: req.body.creditCard ? 'DADOS SENSÍVEIS OMITIDOS' : undefined,
    creditCardHolderInfo: req.body.creditCardHolderInfo ? 'DADOS SENSÍVEIS OMITIDOS' : undefined
  }, null, 2));
  
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    console.log('Requisição OPTIONS recebida - Respondendo com 200');
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    console.log('Método não permitido:', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { 
    customerId, 
    planId,
    billingType = 'CREDIT_CARD',
    nextDueDate,
    value,
    cycle = 'MONTHLY',
    description,
    creditCardToken,
    creditCard,
    userEmail,
    userName,
    holderName,
    cardNumber,
    expiryMonth,
    expiryYear,
    ccv,
    holderEmail,
    holderCpfCnpj,
    holderPostalCode,
    holderAddressNumber,
    holderPhone
  } = req.body;

  console.log('Dados da assinatura recebidos:', {
    customerId,
    planId,
    billingType,
    value,
    cycle,
    temCartao: !!cardNumber,
    temTitular: !!holderName
  });

  if (!customerId) {
    console.log('Erro: ID do cliente não fornecido');
    return res.status(400).json({ error: 'ID do cliente é obrigatório' });
  }

  if (!value) {
    console.log('Erro: Valor não fornecido');
    return res.status(400).json({ error: 'Valor é obrigatório' });
  }

  // Verificar dados do cartão para pagamento com cartão de crédito
  if (billingType === 'CREDIT_CARD') {
    if (!holderName || !cardNumber || !expiryMonth || !expiryYear || !ccv) {
      console.log('Erro: Dados do cartão incompletos', { 
        temHolderName: !!holderName, 
        temCardNumber: !!cardNumber, 
        temExpiryMonth: !!expiryMonth, 
        temExpiryYear: !!expiryYear, 
        temCcv: !!ccv 
      });
      return res.status(400).json({ 
        error: 'Dados do cartão de crédito incompletos',
        details: 'Nome do titular, número do cartão, mês de expiração, ano de expiração e código de segurança são obrigatórios' 
      });
    }
    
    if (!holderEmail || !holderCpfCnpj || !holderPostalCode) {
      console.log('Erro: Dados do titular do cartão incompletos', { 
        temHolderEmail: !!holderEmail, 
        temHolderCpfCnpj: !!holderCpfCnpj, 
        temHolderPostalCode: !!holderPostalCode 
      });
      return res.status(400).json({ 
        error: 'Dados do titular do cartão incompletos',
        details: 'Email, CPF/CNPJ e CEP do titular são obrigatórios' 
      });
    }
  }

  // Configurar cliente MongoDB
  let client;
  try {
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conexão com MongoDB estabelecida');
    
    const db = client.db();
    
    // Configurar chamada para API Asaas
    const asaasConfig = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RunCash/1.0',
        'access_token': ASAAS_API_KEY
      }
    };

    console.log('Configuração do Asaas:', {
      url: ASAAS_API_URL,
      apiKey: ASAAS_API_KEY ? `${ASAAS_API_KEY.substring(0, 10)}...` : 'não definido'
    });

    // Dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType: billingType,
      value: value,
      nextDueDate: nextDueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã como padrão
      cycle: cycle,
      description: description || `Assinatura RunCash`
    };
    
    // Adicionar parâmetros para notificação imediata
    subscriptionData.notifyPaymentCreatedImmediately = true;
    
    // Adicionar dados do cartão se for pagamento por cartão de crédito
    if (billingType === 'CREDIT_CARD') {
      // Limpar dados para garantir formato correto
      const cleanCardNumber = cardNumber.replace(/[^\d]/g, '');
      const cleanCpfCnpj = holderCpfCnpj.replace(/[^\d]/g, '');
      const cleanPostalCode = holderPostalCode.replace(/[^\d]/g, '');
      const cleanHolderPhone = holderPhone ? holderPhone.replace(/[^\d]/g, '') : undefined;
      
      subscriptionData.creditCard = {
        holderName: holderName.trim(),
        number: cleanCardNumber,
        expiryMonth: expiryMonth.toString().padStart(2, '0'),
        expiryYear: expiryYear.toString().length <= 2 ? `20${expiryYear}` : expiryYear.toString(),
        ccv: ccv.toString()
      };
      
      subscriptionData.creditCardHolderInfo = {
        name: holderName.trim(),
        email: holderEmail.trim(),
        cpfCnpj: cleanCpfCnpj,
        postalCode: cleanPostalCode,
        addressNumber: holderAddressNumber,
        phone: cleanHolderPhone
      };
      
      console.log('Dados do cartão formatados:', {
        creditCard: {
          holderName: subscriptionData.creditCard.holderName,
          number: `****${subscriptionData.creditCard.number.slice(-4)}`,
          expiryMonth: subscriptionData.creditCard.expiryMonth,
          expiryYear: subscriptionData.creditCard.expiryYear,
          ccv: '***'
        },
        creditCardHolderInfo: {
          name: subscriptionData.creditCardHolderInfo.name,
          email: subscriptionData.creditCardHolderInfo.email,
          cpfCnpj: `***${subscriptionData.creditCardHolderInfo.cpfCnpj.slice(-4)}`,
          postalCode: subscriptionData.creditCardHolderInfo.postalCode,
          addressNumber: subscriptionData.creditCardHolderInfo.addressNumber,
          phone: subscriptionData.creditCardHolderInfo.phone ? `***${subscriptionData.creditCardHolderInfo.phone.slice(-4)}` : undefined
        }
      });
    }

    console.log('=== REQUISIÇÃO PARA O ASAAS (CRIAR ASSINATURA) ===');
    console.log('URL:', `${ASAAS_API_URL}/subscriptions`);
    console.log('Método: POST');
    console.log('Dados:', JSON.stringify({
      ...subscriptionData,
      creditCard: subscriptionData.creditCard ? {
        holderName: subscriptionData.creditCard.holderName,
        number: '************' + (subscriptionData.creditCard.number.slice(-4) || 'XXXX'),
        expiryMonth: subscriptionData.creditCard.expiryMonth,
        expiryYear: subscriptionData.creditCard.expiryYear,
        ccv: '***'
      } : undefined,
      creditCardHolderInfo: subscriptionData.creditCardHolderInfo ? {
        ...subscriptionData.creditCardHolderInfo,
        cpfCnpj: '***' + (subscriptionData.creditCardHolderInfo.cpfCnpj.slice(-4) || 'XXXX'),
        phone: subscriptionData.creditCardHolderInfo.phone ? '***' + subscriptionData.creditCardHolderInfo.phone.slice(-4) : undefined
      } : undefined
    }, null, 2));
    console.log('Headers:', JSON.stringify({
      ...asaasConfig.headers,
      'access_token': `${ASAAS_API_KEY.substring(0, 10)}...`
    }, null, 2));

    // Criar assinatura no Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      subscriptionData,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );

    console.log('=== RESPOSTA DO ASAAS (CRIAR ASSINATURA) ===');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));

    // Verificar se a resposta foi bem sucedida
    if (response.status !== 200 && response.status !== 201) {
      console.error('=== ERRO NA RESPOSTA DO ASAAS ===');
      console.error('Status:', response.status);
      console.error('Dados:', JSON.stringify(response.data, null, 2));
      throw new Error(`Erro na API do Asaas: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    // Salvar detalhes da assinatura no MongoDB
    const subscriptionsCollection = db.collection('subscriptions');
    const customerCollection = db.collection('customers');
    
    // Buscar informações do cliente
    let customer = await customerCollection.findOne({ asaas_id: customerId });
    
    // Salvar assinatura
    const subscription = {
      asaas_id: response.data.id,
      customer_id: customerId,
      plan_id: planId,
      value: value,
      status: response.data.status,
      next_due_date: response.data.nextDueDate,
      cycle: cycle,
      billing_type: billingType,
      description: subscriptionData.description,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await subscriptionsCollection.insertOne(subscription);
    console.log('Assinatura salva no MongoDB:', subscription.asaas_id);

    // Atualizar status do cliente
    if (customer) {
      await customerCollection.updateOne(
        { asaas_id: customerId },
        {
          $set: {
            subscription_status: 'ACTIVE',
            subscription_id: response.data.id,
            updated_at: new Date()
          }
        }
      );
      console.log('Status de assinatura do cliente atualizado:', customerId);
    }

    // Retornando resposta no formato que o frontend espera
    return res.status(201).json({
      success: true,
      data: {
        subscriptionId: response.data.id,
        paymentId: response.data.paymentId || response.data.id,
        redirectUrl: response.data.redirectUrl || null,
        status: response.data.status
      },
      message: 'Assinatura criada com sucesso'
    });
  } catch (error) {
    console.error('=== ERRO AO CRIAR ASSINATURA ===');
    console.error('Mensagem:', error.message);
    
    if (error.response) {
      console.error('Detalhes da resposta do erro:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      console.error('Requisição feita mas sem resposta');
      console.error('Request:', error.request);
    } else {
      console.error('Erro ao configurar requisição:', error.message);
    }
    console.error('Config:', JSON.stringify(error.config, null, 2));
    
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Erro ao criar assinatura',
      details: error.response?.data || error.message
    });
  } finally {
    if (client) {
      await client.close();
      console.log('Conexão com MongoDB fechada');
    }
    console.log('=== FIM DA REQUISIÇÃO DE ASSINATURA ===');
  }
} 