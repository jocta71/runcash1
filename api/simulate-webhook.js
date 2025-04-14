/**
 * Simulador de eventos de webhook da Hubla
 * Para uso em ambiente de desenvolvimento e testes
 */

const axios = require('axios');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Lidar com solicitações OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter configuração do evento a ser simulado
    const {
      eventType = 'test',
      userId,
      planId = 'basic',
      metadata = {},
      endpoint = '/api/hubla-webhook'
    } = req.body;
    
    // Validar dados obrigatórios
    if (!userId) {
      return res.status(400).json({ 
        error: 'Dados incompletos', 
        message: 'O userId é obrigatório para simular eventos'
      });
    }
    
    // Montar o payload adequado com base no tipo de evento
    let eventPayload;
    
    // Timestamp único para eventos
    const timestamp = new Date().toISOString();
    
    // ID aleatório para o evento
    const eventId = `test_${Math.random().toString(36).substring(2, 15)}`;
    
    // Preparar dados de cliente simulados
    const customerData = {
      id: `cus_${Math.random().toString(36).substring(2, 10)}`,
      name: 'Usuário de Teste',
      email: `teste_${userId}@exemplo.com.br`,
      tax_id: '99966633300'
    };
    
    // Preparar dados de assinatura simulados
    const subscriptionData = {
      id: `sub_${Math.random().toString(36).substring(2, 10)}`,
      plan_id: planId,
      status: 'active',
      start_date: timestamp,
      customer_id: customerData.id
    };
    
    // Combinar metadados padrão com os fornecidos
    const combinedMetadata = {
      userId,
      planId,
      ...metadata
    };
    
    // Montar payload com base no tipo de evento
    switch (eventType) {
      case 'checkout.completed':
      case 'NewSale':
        eventPayload = {
          id: eventId,
          type: 'NewSale',
          created_at: timestamp,
          event: {
            userId,
            userName: 'Test Payer Name',
            userEmail: `teste_${userId}@exemplo.com.br`,
            userPhone: '+5511999999999',
            userDocument: '12.345.678/0001-90',
            groupId: planId === 'basic' ? 'sD6k3KyqLtK7Kyyyl5YA' : '5dYVW0YLLn8qC3dPQDFf',
            groupName: 'RunCash',
            sellerId: 'XSxd2qnnfCXtkOGekqsqMSgGI3A2',
            recurring: 'subscription',
            paymentMethod: 'pix',
            transactionId: `${Math.random().toString(36).substring(2, 10)}-tester`,
            createdAt: timestamp,
            expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            paidAt: timestamp,
            url: `https://exemplo.com/${Math.random().toString(36).substring(2, 15)}-tester`,
            isRenewing: false,
            totalAmount: planId === 'basic' ? 39.9 : 99.9,
            discount: 0,
            affiliates: []
          },
          version: '1.0.0'
        };
        break;
        
      case 'subscription.cancelled':
      case 'CanceledSubscription':
        eventPayload = {
          id: eventId,
          type: 'CanceledSubscription',
          created_at: timestamp,
          event: {
            userId,
            userName: 'Test Payer Name',
            userEmail: `teste_${userId}@exemplo.com.br`,
            userPhone: '+5511999999999',
            userDocument: '12.345.678/0001-90',
            groupId: planId === 'basic' ? 'sD6k3KyqLtK7Kyyyl5YA' : '5dYVW0YLLn8qC3dPQDFf',
            groupName: 'RunCash',
            sellerId: 'XSxd2qnnfCXtkOGekqsqMSgGI3A2',
            totalAmount: planId === 'basic' ? 39.9 : 99.9
          },
          version: '1.0.0'
        };
        break;
        
      case 'NewUser':
        eventPayload = {
          id: eventId,
          type: 'NewUser',
          created_at: timestamp,
          event: {
            userId,
            userName: 'Test Payer Name',
            userEmail: `teste_${userId}@exemplo.com.br`,
            userPhone: '+5511999999999',
            userDocument: '12.345.678/0001-90',
            groupId: planId === 'basic' ? 'sD6k3KyqLtK7Kyyyl5YA' : '5dYVW0YLLn8qC3dPQDFf',
            groupName: 'RunCash',
            sellerId: 'XSxd2qnnfCXtkOGekqsqMSgGI3A2',
            amount: planId === 'basic' ? 39.9 : 99.9
          },
          version: '1.0.0'
        };
        break;
        
      case 'subscription.created':
      case 'subscription.activated':
        eventPayload = {
          id: eventId,
          type: eventType,
          created_at: timestamp,
          data: {
            id: subscriptionData.id,
            status: 'active',
            metadata: combinedMetadata,
            customer: customerData,
            subscription: subscriptionData
          }
        };
        break;
        
      case 'test':
      default:
        eventPayload = {
          id: eventId,
          type: 'test',
          created_at: timestamp,
          data: {
            metadata: combinedMetadata,
            test: true,
            message: 'Evento de teste gerado pelo simulador'
          }
        };
    }
    
    console.log(`Simulando evento ${eventType}:`, eventPayload);
    
    // Enviar payload para o endpoint do webhook
    const isProduction = process.env.NODE_ENV === 'production';
    const webhookUrl = isProduction
      ? `https://runcashh11.vercel.app${endpoint}`
      : `https://${process.env.VERCEL_URL || 'localhost:3000'}${endpoint}`;
    
    console.log('Enviando webhook para:', webhookUrl);
    
    // Enviar como um webhook com cabeçalhos adequados
    const webhookResponse = await axios.post(
      webhookUrl,
      eventPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-hubla-token': 'teste_simulador',
          'x-hubla-sandbox': 'true',
          'x-hubla-idempotency': eventId
        }
      }
    );
    
    // Retornar resultados
    return res.status(200).json({
      success: true,
      event: eventPayload,
      webhook_response: webhookResponse.data,
      webhook_status: webhookResponse.status
    });
    
  } catch (error) {
    console.error('Erro ao simular webhook:', error.message);
    
    // Se o erro ocorreu no envio do webhook, tentar extrair mais informações
    if (error.response) {
      return res.status(500).json({
        error: 'Erro ao processar webhook simulado',
        status: error.response.status,
        data: error.response.data,
        message: error.message
      });
    }
    
    return res.status(500).json({
      error: 'Erro ao simular webhook',
      message: error.message
    });
  }
}; 