const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { 
    subscriptionId, 
    userId,
    newPlanId,
    newValue,
    applyImmediately = false
  } = req.body;
  
  if (!subscriptionId || !newPlanId || !newValue) {
    return res.status(400).json({ 
      error: 'ID da assinatura, ID do novo plano e novo valor são obrigatórios' 
    });
  }

  let client;
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // Verificar se a assinatura existe
    const subscription = await db.collection('subscriptions').findOne({ asaas_id: subscriptionId });
    if (!subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }
    
    // Verificar se o usuário tem permissão (opcional)
    if (userId && subscription.user_id && subscription.user_id !== userId) {
      return res.status(403).json({ error: 'Não autorizado a modificar esta assinatura' });
    }
    
    // Buscar informações do novo plano (se armazenamos os planos no MongoDB)
    const plan = await db.collection('plans').findOne({ id: newPlanId });
    const planName = plan ? plan.name : `Plano ${newPlanId}`;
    
    // Preparar dados para atualização no Asaas
    const updateData = {
      value: parseFloat(newValue),
      description: `Assinatura RunCash - ${planName}`
    };
    
    let proRataPayment = null;
    
    // Se aplicar imediatamente e valor for maior, criar um pagamento único para a diferença
    if (applyImmediately && parseFloat(newValue) > parseFloat(subscription.value)) {
      try {
        // Calcular diferença pro-rata para o ciclo atual
        const today = new Date();
        const nextDueDate = new Date(subscription.next_due_date);
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const remainingDays = Math.max(0, (nextDueDate - today) / (1000 * 60 * 60 * 24));
        
        if (remainingDays > 0) {
          // Calcular valor da diferença pro-rata
          const valueDifference = (parseFloat(newValue) - parseFloat(subscription.value)) * (remainingDays / daysInMonth);
          
          if (valueDifference > 0) {
            // Criar pagamento único para a diferença
            const paymentResponse = await axios.post(
              `${ASAAS_BASE_URL}/payments`,
              {
                customer: subscription.customer_id,
                billingType: subscription.billing_type,
                value: valueDifference.toFixed(2),
                dueDate: new Date().toISOString().split('T')[0],
                description: `Diferença pro-rata para upgrade para ${planName}`
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'RunCash/1.0',
                  'access_token': ASAAS_API_KEY
                }
              }
            );
            
            // Registrar o pagamento no MongoDB
            const paymentData = {
              asaas_id: paymentResponse.data.id,
              customer_id: subscription.customer_id,
              subscription_id: subscriptionId,
              value: valueDifference.toFixed(2),
              status: paymentResponse.data.status,
              billing_type: subscription.billing_type,
              description: `Diferença pro-rata para upgrade para ${planName}`,
              due_date: new Date().toISOString().split('T')[0],
              type: 'UPGRADE_DIFFERENCE',
              created_at: new Date(),
              updated_at: new Date()
            };
            
            await db.collection('payments').insertOne(paymentData);
            proRataPayment = paymentResponse.data;
          }
        }
      } catch (paymentError) {
        console.error('Erro ao criar pagamento pro-rata:', paymentError);
        // Não vamos falhar a requisição principal se o pagamento pro-rata falhar
      }
    }
    
    // Atualizar assinatura no Asaas
    const response = await axios.post(
      `${ASAAS_BASE_URL}/subscriptions/${subscriptionId}`,
      updateData,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    // Atualizar registro no MongoDB
    await db.collection('subscriptions').updateOne(
      { asaas_id: subscriptionId },
      { 
        $set: { 
          plan_id: newPlanId,
          value: newValue,
          description: updateData.description,
          updated_at: new Date()
        } 
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Plano atualizado com sucesso',
      subscription: response.data,
      proRataPayment: proRataPayment
    });
  } catch (error) {
    console.error('Erro ao alterar plano da assinatura:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ error: 'Erro ao alterar plano da assinatura' });
  } finally {
    if (client) await client.close();
  }
}; 