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
      cpfCnpj, // Adicionado para atualização do CPF
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
    const FRONTEND_URL = process.env.FRONTEND_URL;

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

    // Atualizar o CPF do cliente se fornecido
    if (cpfCnpj) {
      try {
        console.log(`Atualizando CPF/CNPJ do cliente ${customerId}: ${cpfCnpj}`);
        await apiClient.post(`/customers/${customerId}`, {
          cpfCnpj
        });
        console.log('CPF/CNPJ atualizado com sucesso');
      } catch (updateError) {
        console.error('Erro ao atualizar CPF/CNPJ do cliente:', updateError.message);
        // Continuar mesmo com erro na atualização do CPF
      }
    }

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
        
        // Verificar se o pagamento já está disponível na resposta da assinatura
        if (subscription.firstPayment) {
          console.log(`Encontrado firstPayment na resposta da assinatura:`, subscription.firstPayment);
          paymentId = subscription.firstPayment.id;
          
          try {
            console.log(`Solicitando QR Code PIX para pagamento ${paymentId} (via firstPayment)...`);
            const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
            
            qrCode = {
              encodedImage: pixResponse.data.encodedImage,
              payload: pixResponse.data.payload
            };
            
            console.log('QR Code PIX gerado com sucesso via firstPayment');
          } catch (fpPixError) {
            console.error(`Erro ao obter QR Code do firstPayment:`, fpPixError.message);
          }
        }
        
        // Se não conseguiu o QR code via firstPayment, tentar via API de pagamentos
        if (!qrCode) {
          // Obter o pagamento associado à assinatura
          const paymentsResponse = await apiClient.get(`/payments`, {
            params: { subscription: subscription.id }
          });

          console.log(`Resposta de pagamentos:`, {
            status: paymentsResponse.status,
            count: paymentsResponse.data.data ? paymentsResponse.data.data.length : 0
          });

          if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
            const payment = paymentsResponse.data.data[0];
            paymentId = payment.id;
            
            console.log(`Pagamento encontrado: ${paymentId}, status: ${payment.status}`);
            
            // Buscar QR Code PIX
            console.log(`Solicitando QR Code PIX para pagamento ${paymentId}...`);
            
            try {
              const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
              
              console.log(`QR Code obtido com sucesso:`, {
                hasEncodedImage: !!pixResponse.data.encodedImage,
                hasPayload: !!pixResponse.data.payload,
                dataSize: JSON.stringify(pixResponse.data).length
              });
              
              qrCode = {
                encodedImage: pixResponse.data.encodedImage,
                payload: pixResponse.data.payload
              };
              
              console.log('QR Code PIX gerado com sucesso');
            } catch (pixSpecificError) {
              console.error(`Erro ao obter QR Code PIX para pagamento ${paymentId}:`, {
                message: pixSpecificError.message,
                status: pixSpecificError.response?.status,
                data: pixSpecificError.response?.data
              });
              
              // Tentar obter informações do pagamento diretamente
              try {
                const paymentDetailsResponse = await apiClient.get(`/payments/${paymentId}`);
                console.log(`Detalhes do pagamento:`, {
                  status: paymentDetailsResponse.data.status,
                  billingType: paymentDetailsResponse.data.billingType,
                  value: paymentDetailsResponse.data.value
                });
              } catch (detailsError) {
                console.error(`Erro ao obter detalhes do pagamento:`, detailsError.message);
              }
            }
          } else {
            console.warn(`Nenhum pagamento encontrado para assinatura ${subscription.id}`);
          }
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
        
        // Log do status retornado pelo Asaas para depuração
        console.log(`Status da assinatura retornado pelo Asaas: ${subscription.status}`);
        
        // Forçar status inicial como "pending" independente do retorno da API
        await db.collection('subscriptions').insertOne({
          subscription_id: subscription.id,
          user_id: userId,
          customer_id: customerId,
          plan_id: planId,
          payment_id: paymentId,
          status: "pending", // Forçando o status inicial como pending
          original_asaas_status: subscription.status, // Mantendo o status original para referência
          billing_type: billingType,
          value: subscriptionValue, // Usar o valor oficial
          created_at: new Date(),
          status_history: [
            {
              status: "pending",
              timestamp: new Date(),
              source: "initial_creation"
            }
          ]
        });
        
        console.log('Assinatura registrada no MongoDB com status inicial "pending"');
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
        status: "pending", // Informando ao cliente o status correto
        asaasStatus: subscription.status, // Apenas para informação
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