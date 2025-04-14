const crypto = require('crypto');
const axios = require('axios');

/**
 * Verifica o token do webhook Hubla
 * @param {string} token - Token recebido no cabeçalho da requisição
 * @param {string} secret - Secret configurado no ambiente
 * @returns {boolean} - Se o token é válido
 */
const verifyHublaToken = (token, secret) => {
  if (!token || !secret) return false;
  return token === secret;
};

/**
 * Manipulador de webhook da Hubla
 * Recebe e processa eventos enviados pela plataforma Hubla
 */
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-hubla-token, x-hubla-sandbox, x-hubla-idempotency');
  
  // Lidar com solicitações OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter informações do cabeçalho para debug
    const token = req.headers['x-hubla-token'];
    const isSandbox = req.headers['x-hubla-sandbox'] === 'true';
    const idempotencyKey = req.headers['x-hubla-idempotency'];
    
    // Registrar informações detalhadas do cabeçalho para debug
    console.log('Cabeçalhos do webhook Hubla:', {
      token: token ? 'Presente' : 'Ausente',
      sandbox: isSandbox ? 'Sim' : 'Não',
      idempotency: idempotencyKey || 'Não presente'
    });
    
    // Verificar token apenas em ambiente de produção e se não for teste/sandbox
    if (!isSandbox && process.env.NODE_ENV === 'production') {
      const webhookSecret = process.env.HUBLA_WEBHOOK_SECRET;
      const isValidToken = verifyHublaToken(token, webhookSecret);
      
      if (!isValidToken) {
        console.error('Token inválido do webhook Hubla');
        return res.status(401).json({ error: 'Token inválido' });
      }
      
      console.log('Token de webhook validado com sucesso');
    } else {
      console.log('Verificação de token ignorada: ambiente sandbox ou teste');
    }
    
    // Processar evento
    const event = req.body;
    
    // Log do evento completo para debugging
    console.log(`Webhook Hubla recebido (${event.type}):`, JSON.stringify(event));
    
    // Verificar se é um evento de teste 
    const isTestEvent = event.type === 'test' || isSandbox;
    
    if (isTestEvent) {
      console.log('Evento de teste recebido, processando simulação');
      
      // Para eventos de teste, enviamos uma resposta de sucesso
      return res.status(200).json({ 
        received: true, 
        message: 'Evento de teste processado com sucesso',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
    }
    
    // Processar diferentes tipos de eventos
    switch (event.type) {
      case 'checkout.completed':
      case 'NewSale': {
        // Checkout concluído com sucesso
        const { metadata, customer, subscription } = event.data || {};
        // Para NewSale, a estrutura é diferente
        const userId = metadata?.userId || event.event?.userId;
        const planId = metadata?.planId || 'basic'; // Assumir plano básico se não especificado
        
        console.log('Checkout completado:', {
          userId, 
          planId, 
          customer: customer?.email || event.event?.userEmail,
          subscriptionId: subscription?.id || event.event?.transactionId
        });
        
        if (!userId) {
          console.error('Metadados incompletos no evento:', { 
            metadata: metadata || event.event, 
            eventType: event.type,
            eventId: event.id
          });
          return res.status(400).json({ error: 'Metadados incompletos' });
        }
        
        // Atualizar assinatura no banco de dados
        try {
          // URL da API para atualizar assinatura do usuário
          const apiUrl = process.env.API_SERVICE_URL || 'https://backendapi-production-36b5.up.railway.app';
          
          // Mapear tipo de plano
          const planTypeMap = {
            'basic': 'BASIC',
            'pro': 'PRO'
          };
          
          // Determinar informações do cliente com base no formato do evento
          const customerInfo = customer ? {
            name: customer.name,
            email: customer.email,
            taxId: customer.tax_id
          } : {
            name: event.event?.userName,
            email: event.event?.userEmail,
            taxId: event.event?.userDocument
          };
          
          // Determinar ID de pagamento com base no formato do evento
          const paymentId = subscription?.id || 
                          event.event?.transactionId || 
                          event.event?.id || 
                          `hubla_${new Date().getTime()}`;
          
          // Dados da assinatura
          const subscriptionData = {
            userId,
            planId,
            planType: planTypeMap[planId] || 'BASIC',
            paymentProvider: 'hubla',
            paymentId,
            status: 'active',
            customerInfo
          };
          
          console.log('Enviando dados de assinatura para API:', subscriptionData);
          
          // Chamar API para atualizar assinatura
          const response = await axios.post(
            `${apiUrl}/api/subscriptions/update`,
            subscriptionData,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_SECRET_KEY}`
              }
            }
          );
          
          console.log(`Assinatura atualizada com sucesso para o usuário ${userId}:`, response.data);
        } catch (dbError) {
          console.error('Erro ao atualizar assinatura:', dbError.message);
          if (dbError.response) {
            console.error('Detalhes da resposta:', {
              status: dbError.response.status,
              data: dbError.response.data
            });
          }
          // Continuar processamento mesmo com erro no banco de dados
        }
        
        break;
      }
      
      case 'subscription.cancelled':
      case 'CanceledSubscription': {
        // Assinatura cancelada ou expirada
        const { metadata, subscription } = event.data || {};
        // Para CanceledSubscription, a estrutura é diferente
        const userId = metadata?.userId || event.event?.userId;
        
        console.log(`Evento de cancelamento de assinatura (${event.type}):`, {
          userId,
          subscriptionId: subscription?.id || event.event?.transactionId
        });
        
        if (!userId) {
          console.error('Metadados incompletos no evento de cancelamento:', { 
            metadata: metadata || event.event, 
            eventType: event.type,
            eventId: event.id
          });
          return res.status(400).json({ error: 'Metadados incompletos' });
        }
        
        // Atualizar status da assinatura no banco de dados
        try {
          // URL da API para atualizar assinatura do usuário
          const apiUrl = process.env.API_SERVICE_URL || 'https://backendapi-production-36b5.up.railway.app';
          
          // Determinar ID do pagamento com base no formato do evento
          const paymentId = subscription?.id || 
                          event.event?.transactionId || 
                          event.event?.id || 
                          '';
          
          // Dados da assinatura
          const subscriptionData = {
            userId,
            paymentId,
            status: 'cancelled'
          };
          
          console.log('Enviando atualização de status para API:', subscriptionData);
          
          // Chamar API para atualizar assinatura
          const response = await axios.post(
            `${apiUrl}/api/subscriptions/update-status`,
            subscriptionData,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_SECRET_KEY}`
              }
            }
          );
          
          console.log(`Assinatura cancelada com sucesso para o usuário ${userId}:`, response.data);
        } catch (dbError) {
          console.error('Erro ao cancelar assinatura:', dbError.message);
          if (dbError.response) {
            console.error('Detalhes da resposta:', {
              status: dbError.response.status,
              data: dbError.response.data
            });
          }
          // Continuar processamento mesmo com erro no banco de dados
        }
        
        break;
      }
      
      // Novo caso para tratar evento de Novo Usuário
      case 'NewUser': {
        // Obter dados do usuário do evento
        const userData = event.event || {};
        const userId = userData.userId;
        
        if (!userId) {
          console.error('Dados de usuário incompletos no evento:', { 
            userData, 
            eventType: event.type
          });
          return res.status(400).json({ error: 'Dados de usuário incompletos' });
        }
        
        console.log(`Novo usuário registrado na Hubla:`, {
          userId,
          nome: userData.userName,
          email: userData.userEmail,
          documento: userData.userDocument,
          produto: userData.groupName
        });
        
        try {
          // URL da API para registrar ou atualizar usuário
          const apiUrl = process.env.API_SERVICE_URL || 'https://backendapi-production-36b5.up.railway.app';
          
          // Preparar dados do usuário para sincronização
          const userDataToSync = {
            userId,
            externalId: userId,
            name: userData.userName,
            email: userData.userEmail,
            phoneNumber: userData.userPhone,
            documentNumber: userData.userDocument,
            metadata: {
              hublaGroupId: userData.groupId,
              hublaGroupName: userData.groupName,
              hublaSellerId: userData.sellerId,
              source: 'hubla_webhook'
            }
          };
          
          console.log('Sincronizando dados de usuário com API:', userDataToSync);
          
          // Chamar API para sincronizar usuário
          // Apenas loga a intenção mas não chama API até implementarmos o endpoint
          console.log(`Usuário ${userId} seria sincronizado com o sistema`);
          
          /* Código comentado - será implementado quando o endpoint existir
          const response = await axios.post(
            `${apiUrl}/api/users/sync`,
            userDataToSync,
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_SECRET_KEY}`
              }
            }
          );
          
          console.log(`Usuário sincronizado com sucesso: ${userId}`, response.data);
          */
        } catch (dbError) {
          console.error('Erro ao sincronizar usuário:', dbError.message);
          if (dbError.response) {
            console.error('Detalhes da resposta:', {
              status: dbError.response.status,
              data: dbError.response.data
            });
          }
          // Continuar processamento mesmo com erro no banco de dados
        }
        
        break;
      }
      
      // Tratar outros eventos relacionados a assinaturas
      case 'subscription.created':
      case 'subscription.activated': 
      case 'subscription.renewal_activated':
      case 'subscription.renewal_deactivated': {
        const { metadata, subscription } = event.data || {};
        const userId = metadata?.userId;
        
        console.log(`Evento de assinatura (${event.type}):`, {
          userId,
          subscriptionId: subscription?.id,
          metadata: metadata
        });
        break;
      }
      
      // Adicionar outros tipos de eventos conforme necessário
      default:
        console.log(`Evento não processado: ${event.type}`, {
          eventId: event.id,
          timestamp: event.created_at
        });
    }
    
    // Retornar sucesso
    return res.status(200).json({ 
      received: true,
      event_type: event.type,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook Hubla:', error.message);
    
    // Detalhes adicionais para ajudar no debugging
    console.error('Stack trace:', error.stack);
    
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 