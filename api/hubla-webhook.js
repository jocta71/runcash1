const crypto = require('crypto');
const axios = require('axios');

// Função para verificar a assinatura do webhook
const verifyHublaSignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;
  
  // Calcular a assinatura esperada
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  
  // Comparar assinaturas
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

// Handler para webhook do Hubla
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hubla-signature');
  
  // Lidar com solicitações OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter a assinatura do webhook
    const signature = req.headers['x-hubla-signature'];
    
    // Verificar assinatura (em ambiente de produção)
    if (process.env.NODE_ENV === 'production') {
      const isValid = verifyHublaSignature(
        req.body,
        signature,
        process.env.HUBLA_WEBHOOK_SECRET
      );
      
      if (!isValid) {
        console.error('Assinatura inválida do webhook Hubla');
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
    }
    
    // Processar evento
    const event = req.body;
    console.log(`Webhook Hubla recebido: ${event.type}`);
    
    // Processar diferentes tipos de eventos
    switch (event.type) {
      case 'checkout.completed': {
        // Checkout concluído com sucesso
        const { metadata, customer, subscription } = event.data;
        const userId = metadata?.userId;
        const planId = metadata?.planId;
        
        if (!userId || !planId) {
          console.error('Metadados incompletos no evento:', event);
          return res.status(400).json({ error: 'Metadados incompletos' });
        }
        
        // Atualizar assinatura no banco de dados
        try {
          // URL da API para atualizar assinatura do usuário
          const apiUrl = process.env.API_SERVICE_URL || 'https://backendapi-production-36b5.up.railway.app';
          
          // Mapear tipo de plano
          const planTypeMap = {
            'MENSAL': 'BASIC',
            'ANUAL': 'PREMIUM'
          };
          
          // Dados da assinatura
          const subscriptionData = {
            userId,
            planId,
            planType: planTypeMap[planId] || 'BASIC',
            paymentProvider: 'hubla',
            paymentId: subscription?.id || event.data.id,
            status: 'active',
            customerInfo: {
              name: customer.name,
              email: customer.email,
              taxId: customer.tax_id
            }
          };
          
          // Chamar API para atualizar assinatura
          await axios.post(
            `${apiUrl}/api/subscriptions/update`,
            subscriptionData,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_SECRET_KEY}`
              }
            }
          );
          
          console.log(`Assinatura atualizada com sucesso para o usuário ${userId}`);
        } catch (dbError) {
          console.error('Erro ao atualizar assinatura:', dbError);
          // Continuar processamento mesmo com erro no banco de dados
        }
        
        break;
      }
      
      case 'subscription.cancelled':
      case 'subscription.expired': {
        // Assinatura cancelada ou expirada
        const { metadata, subscription } = event.data;
        const userId = metadata?.userId;
        
        if (!userId) {
          console.error('Metadados incompletos no evento:', event);
          return res.status(400).json({ error: 'Metadados incompletos' });
        }
        
        // Atualizar status da assinatura no banco de dados
        try {
          // URL da API para atualizar assinatura do usuário
          const apiUrl = process.env.API_SERVICE_URL || 'https://backendapi-production-36b5.up.railway.app';
          
          // Dados da assinatura
          const subscriptionData = {
            userId,
            paymentId: subscription?.id || event.data.id,
            status: 'cancelled'
          };
          
          // Chamar API para atualizar assinatura
          await axios.post(
            `${apiUrl}/api/subscriptions/update-status`,
            subscriptionData,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_SECRET_KEY}`
              }
            }
          );
          
          console.log(`Assinatura cancelada com sucesso para o usuário ${userId}`);
        } catch (dbError) {
          console.error('Erro ao cancelar assinatura:', dbError);
          // Continuar processamento mesmo com erro no banco de dados
        }
        
        break;
      }
      
      // Adicionar outros tipos de eventos conforme necessário
      
      default:
        console.log(`Evento não processado: ${event.type}`);
    }
    
    // Retornar sucesso
    return res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Erro ao processar webhook Hubla:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}; 