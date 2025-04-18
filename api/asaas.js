// API consolidada para todas as operações do Asaas
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

  // Roteamento baseado no caminho da API
  const path = req.query.action || '';
  
  console.log(`Requisição Asaas API: ${path}`, {
    method: req.method,
    body: req.method === 'POST' ? 'Presente' : 'Ausente',
    query: req.query
  });

  try {
    switch (path) {
      case 'create-subscription':
        return handleCreateSubscription(req, res);
      case 'find-customer':
        return handleFindCustomer(req, res);
      case 'create-customer':
        return handleCreateCustomer(req, res);
      case 'find-subscription':
        return handleFindSubscription(req, res);
      case 'cancel-subscription':
        return handleCancelSubscription(req, res);
      case 'find-payment':
        return handleFindPayment(req, res);
      case 'pix-qrcode':
        return handlePixQrcode(req, res);
      case 'regenerate-pix-code':
        return handleRegeneratePixCode(req, res);
      case 'check-payment-status':
        return handleCheckPaymentStatus(req, res);
      case 'webhook':
        return handleWebhook(req, res);
      default:
        return res.status(404).json({
          success: false,
          error: 'Função Asaas não encontrada'
        });
    }
  } catch (error) {
    console.error('Erro na API Asaas:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no servidor',
      message: error.message
    });
  }
};

// IMPORTANTE: Aqui você deve implementar cada uma das funções abaixo
// copiando o conteúdo correspondente de cada arquivo original.

// Função para criar assinatura (de asaas-create-subscription.js)
async function handleCreateSubscription(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Inserir aqui o código de asaas-create-subscription.js
  // Remova a configuração CORS e a verificação de método, pois já estão no wrapper
  console.log('Requisição criar assinatura recebida');
  
  // Temporário - você deve substituir isso pelo código real
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para buscar cliente (de asaas-find-customer.js)
async function handleFindCustomer(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de asaas-find-customer.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para criar cliente (de asaas-create-customer.js)
async function handleCreateCustomer(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de asaas-create-customer.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para buscar assinatura (de asaas-find-subscription.js)
async function handleFindSubscription(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de asaas-find-subscription.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para cancelar assinatura (de asaas-cancel-subscription.js)
async function handleCancelSubscription(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de asaas-cancel-subscription.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para buscar pagamento (de asaas-find-payment.js)
async function handleFindPayment(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de asaas-find-payment.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para gerar QR code PIX (de asaas-pix-qrcode.js)
async function handlePixQrcode(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de asaas-pix-qrcode.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para regenerar QR code PIX (de regenerate-pix-code.js)
async function handleRegeneratePixCode(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Definir timestamps para medição de performance
  const startTime = Date.now();
  
  try {
    // Obter paymentId ou subscriptionId da query ou body
    let paymentId = null;
    let subscriptionId = null;
    
    if (req.method === 'GET') {
      paymentId = req.query.paymentId;
      subscriptionId = req.query.subscriptionId;
    } else {
      paymentId = req.body.paymentId;
      subscriptionId = req.body.subscriptionId;
    }

    // Precisamos de pelo menos um dos IDs
    if (!paymentId && !subscriptionId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar paymentId ou subscriptionId' 
      });
    }

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

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
      },
      timeout: 10000 // Timeout de 10 segundos
    });

    // Se temos apenas o subscriptionId, precisamos buscar o paymentId
    if (!paymentId && subscriptionId) {
      console.log(`Buscando pagamento para assinatura ${subscriptionId}...`);
      
      try {
        const paymentsResponse = await apiClient.get('/payments', {
          params: { subscription: subscriptionId }
        });
        
        if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
          // Buscar o pagamento mais recente em status pendente
          const pendingPayments = paymentsResponse.data.data.filter(p => 
            p.status !== 'RECEIVED' && p.status !== 'CONFIRMED' && p.status !== 'REFUNDED');
          
          if (pendingPayments.length > 0) {
            paymentId = pendingPayments[0].id;
            console.log(`Pagamento pendente encontrado: ${paymentId}`);
          } else {
            // Se não tiver pendentes, pegar o mais recente
            paymentId = paymentsResponse.data.data[0].id;
            console.log(`Nenhum pagamento pendente. Usando o mais recente: ${paymentId}`);
          }
        } else {
          return res.status(404).json({
            success: false,
            error: 'Nenhum pagamento encontrado para esta assinatura'
          });
        }
      } catch (searchError) {
        console.error('Erro ao buscar pagamento:', searchError.message);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar pagamento',
          details: searchError.message
        });
      }
    }

    // Agora que temos o paymentId, buscar informações do pagamento
    console.log(`Verificando detalhes do pagamento ${paymentId}...`);
    
    let payment;
    try {
      const paymentResponse = await apiClient.get(`/payments/${paymentId}`);
      payment = paymentResponse.data;
      
      if (payment.billingType !== 'PIX') {
        return res.status(400).json({
          success: false,
          error: 'Este pagamento não é do tipo PIX'
        });
      }
      
      if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
        return res.status(400).json({
          success: false,
          error: 'Este pagamento já foi confirmado',
          payment: {
            id: payment.id,
            value: payment.value,
            status: payment.status,
            dueDate: payment.dueDate
          }
        });
      }
      
      console.log(`Pagamento PIX válido. Status: ${payment.status}`);
    } catch (paymentError) {
      console.error('Erro ao verificar pagamento:', paymentError.message);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar pagamento',
        details: paymentError.message
      });
    }
    
    // Gerar QR Code PIX com mecanismo de tentativas
    console.log(`Gerando QR Code PIX para o pagamento ${paymentId}...`);
    
    let qrCodeData = null;
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Adicionar atraso crescente entre tentativas
          const delay = 500 * attempt; // 0, 500ms, 1000ms
          console.log(`Tentativa ${attempt + 1}/${maxRetries}. Aguardando ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
        qrCodeData = pixResponse.data;
        
        // Se obteve com sucesso, sair do loop
        break;
      } catch (pixError) {
        lastError = pixError;
        console.error(`Erro na tentativa ${attempt + 1}/${maxRetries}:`, pixError.message);
        
        if (pixError.response) {
          console.error('Detalhes do erro:', {
            status: pixError.response.status,
            data: pixError.response.data
          });
        }
      }
    }
    
    // Verificar se conseguimos o QR Code
    if (!qrCodeData) {
      console.error('Falha em todas as tentativas de obter QR Code');
      return res.status(500).json({
        success: false,
        error: 'Não foi possível gerar o QR Code após várias tentativas',
        details: lastError?.message || 'Erro desconhecido'
      });
    }
    
    console.log('QR Code PIX gerado com sucesso!');
    
    // Tentar registrar no MongoDB, se configurado
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Registrar log da operação
        await db.collection('pix_regeneration_logs').insertOne({
          payment_id: paymentId,
          subscription_id: subscriptionId,
          timestamp: new Date(),
          success: true,
          processing_time_ms: Date.now() - startTime
        });
        
        await client.close();
      } catch (dbError) {
        console.error('Erro ao registrar regeneração no MongoDB:', dbError.message);
        // Não falhamos a request se o log falhar
      }
    }
    
    // Retornar QR Code e informações do pagamento
    return res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        value: payment.value,
        status: payment.status,
        dueDate: payment.dueDate,
        description: payment.description,
        customer: payment.customer,
        subscription: payment.subscription
      },
      qrCode: {
        encodedImage: qrCodeData.encodedImage,
        payload: qrCodeData.payload,
        expirationDate: qrCodeData.expirationDate
      },
      processingTime: Date.now() - startTime
    });
  } catch (error) {
    console.error('Erro inesperado:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro inesperado',
      message: error.message
    });
  }
}

// Função para verificar status do pagamento (de check-payment-status.js)
async function handleCheckPaymentStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de check-payment-status.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
}

// Função para processar webhook do Asaas (de asaas-webhook.js)
async function handleWebhook(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Inserir aqui o código de asaas-webhook.js
  return res.status(501).json({ 
    success: false, 
    error: 'Função não implementada completamente'
  });
} 