// Endpoint para regenerar QR code PIX para um pagamento existente
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

  // Aceitar solicitações GET (para uso direto) e POST (para chamadas de API)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
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
}; 