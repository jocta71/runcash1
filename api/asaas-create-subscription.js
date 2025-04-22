// Endpoint para criar assinaturas no Asaas e atualizar dados de cliente
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Configuração da API do Asaas
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
  const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
  const API_URL = ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
  
  const MONGO_URI = process.env.MONGODB_URI;
  const RECORD_TO_MONGODB = process.env.RECORD_TO_MONGODB === 'true';

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

  // Endpoint para atualizar CPF/CNPJ do cliente
  if (req.method === 'PUT') {
    const { customerId, cpfCnpj } = req.body;

    // Validar dados obrigatórios
    if (!customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'customerId é obrigatório' 
      });
    }

    if (!cpfCnpj) {
      return res.status(400).json({ 
        success: false,
        error: 'cpfCnpj é obrigatório' 
      });
    }

    // Limpar o CPF/CNPJ para conter apenas números
    const cleanedCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
    
    // Validar CPF/CNPJ
    if (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14) {
      return res.status(400).json({ 
        success: false,
        error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos' 
      });
    }

    try {
      console.log(`Atualizando cliente ${customerId} com CPF/CNPJ: ${cleanedCpfCnpj}`);
      
      // Fazer a requisição para atualizar o cliente na API do Asaas
      const response = await apiClient.post(`/customers/${customerId}`, {
        cpfCnpj: cleanedCpfCnpj
      });

      // Log da resposta completa para diagnóstico
      console.log('Resposta da API Asaas (atualização de CPF/CNPJ):', JSON.stringify(response.data));

      // Verificar a resposta do Asaas
      if (response.data && response.data.id) {
        return res.status(200).json({ 
          success: true, 
          message: 'CPF/CNPJ atualizado com sucesso',
          customer: response.data 
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'Erro na atualização do CPF/CNPJ. Resposta inválida do Asaas.' 
        });
      }
    } catch (error) {
      console.error('Erro ao atualizar CPF/CNPJ no Asaas:', error.response ? error.response.data : error.message);
      
      return res.status(500).json({
        success: false,
        error: error.response && error.response.data ? 
          `Erro do Asaas: ${JSON.stringify(error.response.data)}` : 
          `Erro ao atualizar CPF/CNPJ: ${error.message}`
      });
    }
  }
  // Endpoint para criar assinatura (original)
  else if (req.method === 'POST') {
    try {
      // Obter dados do corpo da solicitação
      const {
        customerId,
        planId,
        creditCard,
        creditCardHolderInfo,
        nextDueDate,
        userId,
        billingType = 'PIX',
        callbackUrl,
        description,
        cpfCnpj, // Adicionado para atualização do cliente
        mobilePhone // Adicionado para atualização do cliente
      } = req.body;

      // Validar campos obrigatórios
      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: 'O ID do cliente (customerId) é obrigatório'
        });
      }

      if (!planId) {
        return res.status(400).json({
          success: false,
          error: 'O ID do plano (planId) é obrigatório'
        });
      }

      console.log(`Iniciando processo de criação de assinatura para cliente ${customerId}, plano ${planId}`);

      // Preços oficiais dos planos
      const planPrices = {
        'Plan1': 29.90,
        'Plan2': 49.90,
        'Plan3': 99.90,
        'PlanAnual1': 287.04,
        'PlanAnual2': 479.04,
        'PlanAnual3': 959.04
      };

      // Obter preço do plano
      const planValue = planPrices[planId];
      if (!planValue) {
        return res.status(400).json({
          success: false,
          error: 'Plano inválido'
        });
      }

      // Verificar e atualizar cliente se necessário
      let customerData;
      try {
        console.log(`Verificando dados do cliente ${customerId} antes de criar assinatura`);
        const customerResponse = await apiClient.get(`/customers/${customerId}`);
        customerData = customerResponse.data;
        
        // Verificar se o cliente tem CPF/CNPJ válido
        const needsUpdate = (
          (!customerData.cpfCnpj && cpfCnpj) || 
          (!customerData.mobilePhone && mobilePhone)
        );
        
        if (needsUpdate) {
          console.log(`Atualizando informações do cliente ${customerId}`);
          const updateData = {};
          
          if (!customerData.cpfCnpj && cpfCnpj) {
            updateData.cpfCnpj = cpfCnpj;
          }
          
          if (!customerData.mobilePhone && mobilePhone) {
            updateData.mobilePhone = mobilePhone;
          }
          
          if (Object.keys(updateData).length > 0) {
            const updateResponse = await apiClient.post(`/customers/${customerId}`, updateData);
            console.log(`Cliente atualizado com sucesso:`, updateResponse.data);
            customerData = updateResponse.data;
          }
        }
      } catch (customerError) {
        console.error(`Erro ao verificar/atualizar cliente:`, customerError.message);
        // Continuar com a criação da assinatura mesmo com erro
      }

      // Construir dados da assinatura
      const subscriptionData = {
        customer: customerId,
        billingType,
        value: planValue,
        nextDueDate: nextDueDate || undefined,
        cycle: planId.includes('Anual') ? 'YEARLY' : 'MONTHLY',
        description: description || `Assinatura do plano ${planId}`,
        externalReference: userId || undefined
      };

      // Configurar URLs de callback
      if (callbackUrl) {
        subscriptionData.callback = {
          invoiceUrl: `${callbackUrl}/api/asaas-webhook`,
          paymentLinkUrl: `${callbackUrl}/api/asaas-webhook`,
          paymentUrl: `${callbackUrl}/api/asaas-webhook`
        };
      }

      // Configurar pagamento com cartão de crédito
      if (billingType === 'CREDIT_CARD' && creditCard && creditCardHolderInfo) {
        subscriptionData.creditCard = creditCard;
        subscriptionData.creditCardHolderInfo = creditCardHolderInfo;
      }

      console.log('Dados da assinatura construídos:', JSON.stringify(subscriptionData, null, 2));

      // Criar assinatura
      let subscriptionResponse;
      try {
        console.log('Enviando solicitação para criar assinatura...');
        subscriptionResponse = await apiClient.post('/subscriptions', subscriptionData);
        console.log('Assinatura criada com sucesso:', subscriptionResponse.data.id);
      } catch (subscriptionError) {
        console.error('Erro ao criar assinatura:', subscriptionError.message);
        
        // Verificar se o erro está relacionado a CPF/CNPJ
        const errorDetails = subscriptionError.response?.data;
        const isCpfCnpjError = 
          errorDetails?.errors?.some(e => 
            e.description?.includes('CPF/CNPJ') || 
            e.description?.includes('cpfCnpj')
          );
        
        if (isCpfCnpjError && cpfCnpj) {
          console.log('Erro relacionado a CPF/CNPJ detectado. Tentando atualizar cliente e tentar novamente.');
          
          try {
            // Forçar atualização do CPF/CNPJ
            await apiClient.post(`/customers/${customerId}`, { cpfCnpj });
            console.log(`Cliente ${customerId} atualizado com CPF/CNPJ: ${cpfCnpj}`);
            
            // Tentar criar a assinatura novamente
            console.log('Tentando criar assinatura novamente após atualização do cliente...');
            subscriptionResponse = await apiClient.post('/subscriptions', subscriptionData);
            console.log('Assinatura criada com sucesso na segunda tentativa:', subscriptionResponse.data.id);
          } catch (retryError) {
            console.error('Erro na segunda tentativa de criar assinatura:', retryError.message);
            return res.status(500).json({
              success: false,
              error: 'Falha ao criar assinatura após tentativa de correção de CPF/CNPJ',
              details: retryError.response?.data || retryError.message
            });
          }
        } else {
          // Se não for um erro de CPF/CNPJ ou não temos CPF/CNPJ para corrigir
          return res.status(500).json({
            success: false,
            error: 'Erro ao criar assinatura',
            details: errorDetails || subscriptionError.message
          });
        }
      }

      // Obter dados da assinatura
      const subscription = subscriptionResponse.data;
      
      // Obter URL de pagamento para PIX
      let paymentUrl = null;
      let qrCode = null;
      let payment = null;
      
      if (billingType === 'PIX') {
        try {
          console.log(`Buscando cobrança para assinatura ${subscription.id}`);
          
          // Buscar pagamentos para a assinatura
          const paymentsResponse = await apiClient.get('/payments', {
            params: { subscription: subscription.id }
          });
          
          const payments = paymentsResponse.data.data;
          console.log(`Encontrados ${payments.length} pagamentos para a assinatura`);
          
          if (payments && payments.length > 0) {
            payment = payments[0];
            
            // Obter QR Code para pagamento PIX
            try {
              const qrCodeResponse = await apiClient.get(`/payments/${payment.id}/pixQrCode`);
              qrCode = qrCodeResponse.data;
              console.log('QR Code obtido com sucesso');
            } catch (qrCodeError) {
              console.error('Erro ao obter QR Code:', qrCodeError.message);
            }
          }
        } catch (paymentsError) {
          console.error('Erro ao buscar pagamentos:', paymentsError.message);
        }
      }

      // Salvar no MongoDB se configurado
      if (RECORD_TO_MONGODB && MONGO_URI && userId) {
        try {
          console.log('Conectando ao MongoDB para registrar assinatura...');
          const client = new MongoClient(MONGO_URI);
          await client.connect();
          
          const db = client.db();
          const subscriptionsCollection = db.collection('subscriptions');
          
          const subscriptionRecord = {
            subscription_id: subscription.id,
            user_id: userId,
            customer_id: customerId,
            plan_id: planId,
            payment_id: payment?.id,
            value: planValue,
            status: subscription.status,
            created_at: new Date(),
            payment_info: payment,
            qr_code_info: qrCode
          };
          
          await subscriptionsCollection.insertOne(subscriptionRecord);
          console.log('Registro salvo no MongoDB');
          
          await client.close();
        } catch (dbError) {
          console.error('Erro ao salvar no MongoDB:', dbError.message);
          // Não bloquear a resposta por erros de banco de dados
        }
      }

      // Retornar resposta de sucesso
      return res.status(200).json({
        success: true,
        subscription: {
          id: subscription.id,
          value: subscription.value,
          cycle: subscription.cycle,
          nextDueDate: subscription.nextDueDate,
          status: subscription.status,
          billingType: subscription.billingType,
          description: subscription.description
        },
        payment: payment ? {
          id: payment.id,
          value: payment.value,
          status: payment.status,
          dueDate: payment.dueDate
        } : null,
        pix: qrCode ? {
          encodedImage: qrCode.encodedImage,
          payload: qrCode.payload,
          expirationDate: qrCode.expirationDate
        } : null
      });
    } catch (error) {
      console.error('Erro geral:', error.message);
      
      // Verificar se é um erro da API do Asaas
      if (error.response && error.response.data) {
        // Verificar se há erros relacionados a CPF/CNPJ
        const cpfCnpjErrors = error.response.data.errors?.filter(e => 
          e.description?.includes('CPF/CNPJ') || 
          e.description?.includes('cpfCnpj')
        );
        
        if (cpfCnpjErrors && cpfCnpjErrors.length > 0) {
          return res.status(error.response.status || 400).json({
            success: false,
            error: 'Erro de validação de CPF/CNPJ',
            details: cpfCnpjErrors,
            message: 'Por favor, forneça um CPF/CNPJ válido para criar a assinatura'
          });
        }
        
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
    }
  } else {
    // Método não suportado
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para criar assinatura ou PUT para atualizar cliente.'
    });
  }
}; 