// Endpoint de criação de assinatura no Asaas para Vercel
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
    const { 
      customerId, 
      planId, 
      userId, 
      billingType = 'PIX',
      cycle = 'MONTHLY',
      value,
      description,
      // Dados de cartão de crédito (opcional)
      holderName,
      cardNumber,
      expiryMonth,
      expiryYear,
      ccv,
      // Dados de titular do cartão (opcional)
      holderEmail,
      holderCpfCnpj,
      holderPostalCode,
      holderAddressNumber,
      holderPhone
    } = req.body;

    // Validar campos obrigatórios
    if (!customerId || !planId) {
      return res.status(400).json({ 
        success: false,
        error: 'Campos obrigatórios: customerId, planId' 
      });
    }

    // Tabela de valores oficiais para cada plano (único local confiável de preços)
    const OFFICIAL_PLAN_PRICES = {
      'basic': 19.90,
      'basico': 19.90,
      'pro': 49.90,
      'premium': 99.90,
      'professional': 49.90,
      'profissional': 49.90,
      'vip': 99.90
    };
    
    // Converter planId para minúsculas para busca no objeto
    const planKey = planId.toString().toLowerCase();
    
    // Verificar se o plano existe na tabela de preços oficiais
    if (!OFFICIAL_PLAN_PRICES[planKey]) {
      return res.status(400).json({ 
        success: false,
        error: `Plano '${planId}' não reconhecido`
      });
    }
    
    // Obter o valor oficial para este plano
    const officialPrice = OFFICIAL_PLAN_PRICES[planKey];
    
    // Valor recebido do cliente
    const clientValue = parseFloat(value);
    
    // Sempre usar o valor oficial, mas registrar se um valor diferente foi enviado
    if (!clientValue || clientValue <= 0) {
      console.log(`Valor não fornecido ou inválido. Usando valor oficial ${officialPrice} para o plano ${planId}`);
    } else if (clientValue !== officialPrice) {
      console.warn(`ALERTA DE SEGURANÇA: Cliente tentou definir valor ${clientValue} para plano ${planId}. Usando valor oficial ${officialPrice}`);
    }
    
    // Sempre usar o valor oficial, independente do que foi enviado
    const subscriptionValue = officialPrice;

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'Chave de API do Asaas não configurada' 
      });
    }

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // Log para depuração dos dados recebidos
    console.log('Dados recebidos para criação de assinatura:', {
      customerId,
      planId,
      valueFromClient: value,
      valueUsed: subscriptionValue,
      billingType,
      cycle
    });

    // Construir o payload da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType,
      cycle,
      value: subscriptionValue, // Usar sempre o valor oficial
      nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Amanhã
      description: description || `Assinatura RunCash - Plano ${planId}`,
      callback: {
        activated: `${FRONTEND_URL}/api/asaas-webhook`,
        invoiceCreated: `${FRONTEND_URL}/api/asaas-webhook`,
        payment: `${FRONTEND_URL}/api/asaas-webhook`,
        successUrl: `${FRONTEND_URL}/success` // URL para redirecionamento após pagamento bem-sucedido
      },
      notifyPaymentCreatedImmediately: true
    };

    // Adicionar dados de cartão de crédito se for pagamento com cartão
    if (billingType === 'CREDIT_CARD' && holderName && cardNumber && expiryMonth && expiryYear && ccv) {
      subscriptionData.creditCard = {
        holderName,
        number: cardNumber,
        expiryMonth,
        expiryYear,
        ccv
      };

      // Adicionar dados do titular se fornecidos
      if (holderEmail && holderCpfCnpj) {
        subscriptionData.creditCardHolderInfo = {
          name: holderName,
          email: holderEmail,
          cpfCnpj: holderCpfCnpj,
          postalCode: holderPostalCode,
          addressNumber: holderAddressNumber,
          phone: holderPhone
        };
      }
    }

    console.log('Criando assinatura no Asaas:', {
      ...subscriptionData,
      creditCard: subscriptionData.creditCard ? '*** OMITIDO ***' : undefined
    });

    // Criar assinatura
    const subscriptionResponse = await apiClient.post('/subscriptions', subscriptionData);
    const subscription = subscriptionResponse.data;
    
    console.log('Assinatura criada com sucesso:', {
      id: subscription.id,
      status: subscription.status
    });

    // Buscar primeiro pagamento (PIX)
    let paymentId = null;
    let qrCode = null;
    let redirectUrl = null;

    if (billingType === 'PIX') {
      try {
        console.log(`Buscando pagamento para assinatura ${subscription.id}...`);
        
        // Abordagem otimizada: Verificar se o pagamento está disponível na resposta da assinatura (firstPayment)
        if (subscription.firstPayment) {
          console.log(`Pagamento encontrado nos dados da assinatura:`, subscription.firstPayment);
          paymentId = subscription.firstPayment.id;
          
          // Solicitar QR Code PIX utilizando ID do pagamento
          try {
            console.log(`Solicitando QR Code PIX para pagamento ${paymentId}...`);
            const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
            
            qrCode = {
              encodedImage: pixResponse.data.encodedImage,
              payload: pixResponse.data.payload,
              expirationDate: pixResponse.data.expirationDate
            };
            
            console.log('QR Code PIX obtido com sucesso');
            
            // Também obter detalhes adicionais do pagamento
            const paymentDetails = await apiClient.get(`/payments/${paymentId}`);
            console.log(`Detalhes do pagamento obtidos: status=${paymentDetails.data.status}, valor=${paymentDetails.data.value}`);
            
          } catch (pixError) {
            console.error(`Erro ao obter QR Code PIX para pagamento ${paymentId}:`, pixError.message);
            
            // Se ocorrer erro, registrar detalhes completos para diagnóstico
            if (pixError.response) {
              console.error('Detalhes do erro:', {
                status: pixError.response.status,
                data: pixError.response.data
              });
            }
          }
        }
        
        // Se não conseguiu o QR code via firstPayment, tentar via API de pagamentos
        if (!qrCode) {
          // Implementar um mecanismo de tentativas com intervalos crescentes
          const maxRetries = 3;
          const initialDelay = 500; // 500ms
          
          for (let attempt = 0; attempt < maxRetries && !qrCode; attempt++) {
            try {
              // Aplicar delay progressivo (0ms, 500ms, 1000ms)
              const delay = attempt > 0 ? initialDelay * attempt : 0;
              if (delay > 0) {
                console.log(`Aguardando ${delay}ms antes da tentativa ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              
              // Obter o pagamento associado à assinatura
              const paymentsResponse = await apiClient.get(`/payments`, {
                params: { subscription: subscription.id }
              });

              console.log(`Resposta de pagamentos (tentativa ${attempt + 1}):`, {
                status: paymentsResponse.status,
                count: paymentsResponse.data.data ? paymentsResponse.data.data.length : 0
              });

              if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
                const payment = paymentsResponse.data.data[0];
                paymentId = payment.id;
                
                console.log(`Pagamento encontrado: ${paymentId}, status: ${payment.status}`);
                
                // Buscar QR Code PIX
                const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
                
                console.log(`QR Code obtido com sucesso:`, {
                  hasEncodedImage: !!pixResponse.data.encodedImage,
                  hasPayload: !!pixResponse.data.payload
                });
                
                qrCode = {
                  encodedImage: pixResponse.data.encodedImage,
                  payload: pixResponse.data.payload,
                  expirationDate: pixResponse.data.expirationDate
                };
                
                // Se encontrou o QR code, parar as tentativas
                break;
              } else {
                console.warn(`Nenhum pagamento encontrado para assinatura ${subscription.id} na tentativa ${attempt + 1}`);
              }
            } catch (attemptError) {
              console.error(`Erro na tentativa ${attempt + 1}:`, attemptError.message);
            }
          }
        }
        
        // Se ainda não temos QR Code, informar claramente ao cliente que ele pode usar o endpoint de regeneração
        if (!qrCode && paymentId) {
          console.log(`QR Code não pôde ser obtido. Cliente deverá usar endpoint de regeneração com paymentId=${paymentId}`);
        }
      } catch (pixError) {
        console.error('Erro ao obter QR Code PIX:', {
          message: pixError.message,
          response: pixError.response?.data
        });
      }
    } else if (billingType === 'CREDIT_CARD') {
      // Para cartão de crédito, só precisamos do ID do pagamento
      try {
        const paymentsResponse = await apiClient.get(`/payments`, {
          params: { subscription: subscription.id }
        });

        if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
          paymentId = paymentsResponse.data.data[0].id;
        }
      } catch (paymentError) {
        console.error('Erro ao obter pagamento:', paymentError.message);
      }
    }

    // Registrar no MongoDB
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        await db.collection('subscriptions').insertOne({
          subscription_id: subscription.id,
          user_id: userId,
          customer_id: customerId,
          plan_id: planId,
          payment_id: paymentId,
          status: subscription.status,
          billing_type: billingType,
          value: subscriptionValue, // Usar o valor oficial
          created_at: new Date()
        });
        
        console.log('Assinatura registrada no MongoDB');
      } catch (dbError) {
        console.error('Erro ao registrar assinatura no MongoDB:', dbError.message);
      }
    }

    // Retornar resposta com dados da assinatura e QR Code, se disponível
    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        paymentId,
        status: subscription.status,
        qrCode,
        redirectUrl
      }
    });
  } catch (error) {
    console.error('Erro ao processar solicitação:', error.message);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
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