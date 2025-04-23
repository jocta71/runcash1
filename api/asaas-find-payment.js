// Endpoint para buscar informações de pagamento no Asaas
const axios = require('axios');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

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

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  // Validar autenticação
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária'
    });
  }

  // Extrair e verificar token
  const token = authHeader.split(' ')[1];
  let userId;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcash-default-secret');
    userId = decoded.id;
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido ou expirado'
    });
  }
  
  let client;
  
  try {
    const { paymentId, subscriptionId, customerId, _t } = req.query;
    
    // Verificar se é uma requisição forçada (com cache buster)
    const forceUpdate = !!_t;
    if (forceUpdate) {
      console.log(`Requisição forçada detectada (timestamp: ${_t})`);
    }

    // Validar campos obrigatórios
    if (!paymentId && !subscriptionId && !customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar paymentId, subscriptionId ou customerId' 
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
    
    // Conectar ao MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Verificar se o usuário tem permissão para acessar esses dados
    let isAuthorized = false;
    
    if (paymentId || subscriptionId) {
      // Buscar assinatura para verificar se pertence ao usuário autenticado
      let query = {};
      
      if (paymentId) {
        query.payment_id = paymentId;
      } else if (subscriptionId) {
        query.subscription_id = subscriptionId;
      }
      
      const subscription = await db.collection('subscriptions').findOne(query);
      
      if (subscription && subscription.user_id === userId) {
        isAuthorized = true;
      } else {
        console.warn(`Tentativa não autorizada de acesso: usuário ${userId} tentando acessar assinatura de outro usuário`);
      }
    } else if (customerId) {
      // Verificar se o customerId está associado ao usuário
      const customer = await db.collection('customers').findOne({
        customer_id: customerId,
        user_id: userId
      });
      
      if (customer) {
        isAuthorized = true;
      } else {
        console.warn(`Tentativa não autorizada de acesso: usuário ${userId} tentando acessar cliente de outro usuário`);
      }
    }
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Você não tem permissão para acessar esses dados'
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

    let paymentsData = [];
    let qrCode = null;
    let totalValue = 0;
    
    try {
      // Definir qual endpoint usar
      let endpoint = '';
      let params = {};
      
      if (paymentId) {
        endpoint = `/payments/${paymentId}`;
      } else if (subscriptionId) {
        endpoint = '/payments';
        params = { subscription: subscriptionId };
      } else if (customerId) {
        endpoint = '/payments';
        params = { customer: customerId };
      }
      
      // Fazer a requisição
      const response = await apiClient.get(endpoint, { params });
      
      // Processar a resposta (depende do tipo de endpoint)
      if (paymentId) {
        // Retorno de um único pagamento
        paymentsData = [response.data];
        totalValue = response.data.value;
        
        // Se for PIX, obter QR code
        if (response.data.billingType === 'PIX' && response.data.status === 'PENDING') {
          try {
            const pixResponse = await apiClient.get(`/payments/${paymentId}/pixQrCode`);
            qrCode = {
              encodedImage: pixResponse.data.encodedImage,
              payload: pixResponse.data.payload,
              expirationDate: pixResponse.data.expirationDate
            };
          } catch (pixError) {
            console.error(`Erro ao obter QR code para pagamento ${paymentId}:`, pixError.message);
          }
        }
      } else {
        // Retorno de lista de pagamentos
        paymentsData = response.data.data || [];
        
        // Calcular valor total
        totalValue = paymentsData.reduce((sum, payment) => sum + payment.value, 0);
      }
      
      // Registrar a consulta no log de atividades
      await db.collection('activity_logs').insertOne({
        user_id: userId,
        action: 'payment_check',
        payment_id: paymentId,
        subscription_id: subscriptionId,
        customer_id: customerId,
        timestamp: new Date()
      });
      
      // Retornar os dados
      return res.json({
        success: true,
        data: {
          payments: paymentsData,
          qrCode,
          totalValue
        }
      });
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error.message);
      
      // Verificar se o erro vem da API do Asaas
      if (error.response) {
        return res.status(error.response.status || 500).json({
          success: false,
          error: 'Erro na API do Asaas',
          message: error.response.data?.errors?.[0]?.description || error.response.data?.message || error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar pagamentos',
        message: error.message
      });
    }
  } catch (error) {
    console.error('Erro ao processar requisição:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 