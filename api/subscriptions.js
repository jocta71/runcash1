const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuração do MongoDB e variáveis de ambiente
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_jwt';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';

// Planos disponíveis
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Acesso a estatísticas básicas', 'Visualização de até 5 roletas', 'Atualizações a cada 10 minutos']
  },
  basic: {
    id: 'basic',
    name: 'Básico',
    price: 19.90,
    features: ['Acesso a estatísticas padrão', 'Visualização de até 15 roletas', 'Atualizações a cada 5 minutos', 'Suporte por email']
  },
  pro: {
    id: 'pro',
    name: 'Profissional',
    price: 49.90,
    features: ['Acesso a estatísticas avançadas', 'Visualização de roletas ilimitadas', 'Atualizações a cada 1 minuto', 'Suporte prioritário', 'Alertas personalizados']
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 99.90,
    features: ['Acesso a estatísticas em tempo real', 'Visualização de roletas ilimitadas', 'Atualizações em tempo real', 'Suporte VIP 24/7', 'Alertas avançados personalizados', 'Estratégias exclusivas', 'Acesso antecipado a novas funcionalidades']
  }
};

// Verificar token de autenticação
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Configuração de CORS (Helper)
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Validação do usuário (Helper)
const validateUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token de autenticação não fornecido', status: 401 };
  }
  
  const token = authHeader.substring(7); // Remover "Bearer " do início
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return { error: 'Token inválido ou expirado', status: 401 };
  }
  
  const userId = decoded.id || decoded.userId || decoded.sub;
  
  if (!userId) {
    return { error: 'ID de usuário não encontrado no token', status: 401 };
  }
  
  return { userId, decoded };
};

// Cliente para API do ASAAS
const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Handler principal
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  setCorsHeaders(res);

  // Responder a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Extrair o caminho da URL
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Ignorar o segmento "api" e "subscriptions" (os dois primeiros)
  const action = pathSegments[2] || '';
  const paramId = pathSegments[3] || '';
  
  // ROTA 1: Obter todos os planos (não requer autenticação)
  if (req.method === 'GET' && action === 'plans') {
    return res.status(200).json({
      success: true,
      plans: Object.values(PLANS)
    });
  }
  
  // Para as demais rotas, validar o usuário
  const userValidation = await validateUser(req, res);
  if (userValidation.error) {
    return res.status(userValidation.status).json({ error: userValidation.error });
  }
  
  const { userId } = userValidation;
  
  let client;
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // ROTA 2: Obter assinatura atual do usuário
    if (req.method === 'GET' && (action === '' || action === 'current')) {
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      // Verificar se o usuário tem assinatura
      const subscription = await db.collection('subscriptions').findOne({ user_id: userId });
      
      let subscriptionData = null;
      let currentPlan = PLANS.free; // Plano padrão é o gratuito
      
      // Se tiver assinatura, obter dados adicionais do ASAAS
      if (subscription && subscription.subscription_id && subscription.status === 'active') {
        try {
          // Tentar obter dados do ASAAS
          const asaasResponse = await asaasClient.get(`/subscriptions/${subscription.subscription_id}`);
          
          if (asaasResponse.data) {
            subscriptionData = {
              id: subscription._id.toString(),
              subscriptionId: subscription.subscription_id,
              status: subscription.status,
              planId: subscription.plan_id,
              startDate: subscription.start_date,
              endDate: subscription.end_date,
              nextBillingDate: asaasResponse.data.nextDueDate,
              paymentMethod: asaasResponse.data.billingType === 'CREDIT_CARD' ? 'Cartão de crédito' : asaasResponse.data.billingType,
              autoRenew: asaasResponse.data.deleted ? false : true
            };
            
            currentPlan = PLANS[subscription.plan_id] || PLANS.free;
          }
        } catch (asaasError) {
          console.error('Erro ao buscar dados do ASAAS:', asaasError);
          
          // Usar apenas dados locais caso falhe
          subscriptionData = {
            id: subscription._id.toString(),
            subscriptionId: subscription.subscription_id,
            status: subscription.status,
            planId: subscription.plan_id,
            startDate: subscription.start_date,
            endDate: subscription.end_date
          };
          
          currentPlan = PLANS[subscription.plan_id] || PLANS.free;
        }
      }
      
      return res.status(200).json({
        success: true,
        subscription: subscriptionData,
        currentPlan: currentPlan
      });
    }
    
    // ROTA 3: Cancelar assinatura
    if (req.method === 'POST' && action === 'cancel') {
      const subscription = await db.collection('subscriptions').findOne({ user_id: userId });
      
      if (!subscription) {
        return res.status(404).json({ error: 'Assinatura não encontrada' });
      }
      
      if (subscription.status !== 'active') {
        return res.status(400).json({ error: 'Apenas assinaturas ativas podem ser canceladas' });
      }
      
      try {
        // Cancelar assinatura no ASAAS
        if (subscription.subscription_id) {
          await asaasClient.delete(`/subscriptions/${subscription.subscription_id}`);
        }
        
        // Atualizar status na base local
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          {
            $set: {
              status: 'canceled',
              end_date: new Date(),
              updated_at: new Date()
            }
          }
        );
        
        // Criar notificação para o usuário
        await db.collection('notifications').insertOne({
          user_id: userId,
          title: 'Assinatura cancelada',
          message: 'Sua assinatura foi cancelada com sucesso. Você ainda terá acesso até o final do período pago.',
          type: 'info',
          notification_type: 'subscription',
          read: false,
          created_at: new Date()
        });
        
        return res.status(200).json({
          success: true,
          message: 'Assinatura cancelada com sucesso'
        });
      } catch (error) {
        console.error('Erro ao cancelar assinatura:', error);
        return res.status(500).json({ error: 'Erro ao processar solicitação de cancelamento' });
      }
    }
    
    // ROTA 4: Buscar histórico de pagamentos
    if (req.method === 'GET' && action === 'payments') {
      const subscription = await db.collection('subscriptions').findOne({ user_id: userId });
      
      if (!subscription || !subscription.subscription_id) {
        return res.status(200).json({
          success: true,
          payments: []
        });
      }
      
      try {
        // Buscar pagamentos no ASAAS
        const asaasResponse = await asaasClient.get(`/payments?subscription=${subscription.subscription_id}`);
        
        const payments = asaasResponse.data?.data?.map(payment => ({
          id: payment.id,
          value: payment.value,
          netValue: payment.netValue,
          status: payment.status,
          dueDate: payment.dueDate,
          paymentDate: payment.paymentDate,
          billingType: payment.billingType,
          invoiceUrl: payment.invoiceUrl
        })) || [];
        
        return res.status(200).json({
          success: true,
          payments
        });
      } catch (error) {
        console.error('Erro ao buscar histórico de pagamentos:', error);
        return res.status(500).json({ error: 'Erro ao obter histórico de pagamentos' });
      }
    }
    
    // ROTA 5: Webhook para receber eventos do ASAAS
    if (req.method === 'POST' && action === 'webhook') {
      // Processar eventos de pagamento/assinatura do ASAAS
      const event = req.body;
      
      if (!event || !event.event) {
        return res.status(400).json({ error: 'Payload inválido' });
      }
      
      // Log do evento para debug
      console.log('Evento recebido do ASAAS:', event);
      
      // Implementar lógica de processamento de eventos
      switch (event.event) {
        case 'PAYMENT_RECEIVED':
          // Atualizar status do pagamento
          break;
        case 'PAYMENT_OVERDUE':
          // Notificar usuário sobre pagamento atrasado
          break;
        case 'SUBSCRIPTION_CANCELED':
          // Processar cancelamento de assinatura
          break;
        // Outros eventos...
      }
      
      return res.status(200).json({ success: true });
    }
    
    // Se nenhuma rota corresponder
    return res.status(404).json({ error: 'Endpoint não encontrado' });
    
  } catch (error) {
    console.error('Erro na API de assinaturas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 