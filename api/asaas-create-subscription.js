const { MongoClient, ObjectId } = require('mongodb');
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
  console.log('=== INÍCIO DA REQUISIÇÃO CRIAR ASSINATURA ===');
  console.log('Método:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
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
    
    // Configurar requisição para API do Asaas
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
        'User-Agent': 'RunCash/1.0'
      }
    };

    console.log('Configuração da requisição para Asaas:', JSON.stringify(axiosConfig, null, 2));

    // Dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType: billingType,
      value: value,
      nextDueDate: nextDueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã como padrão
      cycle: cycle,
      description: description || `Assinatura RunCash`
    };
    
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
      ...axiosConfig.headers,
      'access_token': `${ASAAS_API_KEY.substring(0, 10)}...`
    }, null, 2));

    // Verificar se o cliente existe no Asaas
    console.log(`Verificando se cliente ${customerId} existe no Asaas`);
    
    // Log detalhado dos cabeçalhos para API
    const headers = {
      'access_token': ASAAS_API_KEY,
      'User-Agent': 'RunCash/1.0'
    };
    console.log('Cabeçalhos da requisição:', JSON.stringify(headers));
    
    const customerResponse = await axios.get(`${ASAAS_API_URL}/customers/${customerId}`, {
      headers
    });

    console.log('Criando assinatura no Asaas');
    
    // Logs para debugging
    console.log('Tentando criar assinatura no Asaas');
    console.log('API Key:', `${ASAAS_API_KEY.substring(0, 5)}...${ASAAS_API_KEY.substring(ASAAS_API_KEY.length - 5)}`);
    console.log('Dados da assinatura:', { customerId, value, billingType, nextDueDate, planId });

    // Criar assinatura
    console.log('Criando assinatura na Asaas com os dados:', JSON.stringify(subscriptionData, null, 2));
    const asaasResponse = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      subscriptionData,
      axiosConfig
    );

    console.log('Resposta da criação de assinatura:', JSON.stringify(asaasResponse.data, null, 2));
    
    // Verificar se a resposta foi bem sucedida
    if (asaasResponse.status !== 200 && asaasResponse.status !== 201) {
      console.log(`Erro ao criar assinatura - Status: ${asaasResponse.status}`);
      return res.status(400).json({
        success: false,
        message: 'Erro ao criar assinatura no Asaas',
        error: asaasResponse.data
      });
    }

    // Salvar assinatura
    const subscription = {
      asaas_id: asaasResponse.data.id,
      customer_id: customerId,
      plan_id: planId,
      value: value,
      status: asaasResponse.data.status,
      next_due_date: asaasResponse.data.nextDueDate,
      cycle: cycle,
      billing_type: billingType,
      created_at: new Date()
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
            subscription_id: asaasResponse.data.id,
            updated_at: new Date()
          }
        }
      );
      console.log('Status de assinatura do cliente atualizado:', customerId);
    }

    return res.status(201).json({
      success: true,
      subscription: asaasResponse.data,
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