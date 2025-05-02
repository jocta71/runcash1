/**
 * Controlador para processar webhooks do Asaas
 * Lida com eventos de pagamento e assinatura
 */

const getDb = require('../services/database');

/**
 * Processa um webhook do Asaas
 * Verifica idempotência e atualiza o status da assinatura conforme o evento
 */
const processWebhook = async (req, res) => {
  try {
    const { body } = req;
    
    // Validar payload mínimo necessário
    if (!body || !body.event || !body.id) {
      return res.status(400).json({
        success: false,
        message: 'Payload inválido'
      });
    }
    
    console.log(`[Asaas Webhook] Evento recebido: ${body.event}, ID: ${body.id}`);
    
    const eventId = body.id;
    const db = await getDb();
    
    // Verificar idempotência: se o evento já foi processado
    try {
      await db.collection('processedWebhooks').insertOne({
        eventId,
        event: body.event,
        receivedAt: new Date(),
        processedAt: new Date()
      });
    } catch (error) {
      // Se o documento já existe (erro de chave duplicada)
      if (error.code === 11000) {
        console.log(`[Asaas Webhook] Evento ${eventId} já foi processado anteriormente.`);
        return res.status(200).json({ 
          received: true, 
          processed: false,
          message: 'Evento já processado anteriormente'
        });
      }
      throw error;
    }
    
    // Processar o evento com base no tipo
    let processed = false;
    let subscriptionId = null;
    let userId = null;
    
    switch (body.event) {
      // Eventos de pagamento
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED_IN_CASH':
        // Verificar se o pagamento é de uma assinatura
        if (body.payment && body.payment.subscription) {
          subscriptionId = body.payment.subscription;
          
          // Buscar a assinatura no banco
          const subscription = await db.collection('userSubscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            userId = subscription.userId;
            
            // Atualizar status da assinatura para ativo
            await db.collection('userSubscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: { 
                  status: 'ACTIVE',
                  nextDueDate: new Date(body.payment.dueDate),
                  updatedAt: new Date() 
                } 
              }
            );
            
            console.log(`[Asaas Webhook] Assinatura ${subscriptionId} ativada para o usuário ${userId}`);
            processed = true;
          }
        }
        break;
        
      case 'PAYMENT_OVERDUE':
        // Pagamento atrasado
        if (body.payment && body.payment.subscription) {
          subscriptionId = body.payment.subscription;
          
          const subscription = await db.collection('userSubscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            userId = subscription.userId;
            
            // Atualizar status da assinatura para atrasado
            await db.collection('userSubscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: { 
                  status: 'OVERDUE',
                  updatedAt: new Date() 
                } 
              }
            );
            
            console.log(`[Asaas Webhook] Assinatura ${subscriptionId} marcada como atrasada para o usuário ${userId}`);
            processed = true;
          }
        }
        break;
        
      // Eventos específicos de assinatura
      case 'SUBSCRIPTION_CANCELLED':
      case 'SUBSCRIPTION_ENDED':
        if (body.subscription && body.subscription.id) {
          subscriptionId = body.subscription.id;
          
          const subscription = await db.collection('userSubscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (subscription) {
            userId = subscription.userId;
            
            // Atualizar status da assinatura para cancelado
            await db.collection('userSubscriptions').updateOne(
              { asaasSubscriptionId: subscriptionId },
              { 
                $set: { 
                  status: 'CANCELLED',
                  updatedAt: new Date() 
                } 
              }
            );
            
            console.log(`[Asaas Webhook] Assinatura ${subscriptionId} cancelada para o usuário ${userId}`);
            processed = true;
          }
        }
        break;
        
      // Criação de assinatura
      case 'SUBSCRIPTION_CREATED':
        if (body.subscription && body.subscription.id) {
          subscriptionId = body.subscription.id;
          
          // Verificar se esta assinatura já existe no sistema
          const existingSubscription = await db.collection('userSubscriptions').findOne({
            asaasSubscriptionId: subscriptionId
          });
          
          if (!existingSubscription && body.subscription.customer) {
            // Buscar usuário pelo ID do cliente no Asaas
            const user = await db.collection('users').findOne({
              asaasCustomerId: body.subscription.customer
            });
            
            if (user) {
              // Criar nova entrada de assinatura
              await db.collection('userSubscriptions').insertOne({
                userId: user._id.toString(),
                asaasCustomerId: body.subscription.customer,
                asaasSubscriptionId: subscriptionId,
                status: 'PENDING', // Começa como pendente até o primeiro pagamento
                planType: mapPlanFromValue(body.subscription.value),
                createdAt: new Date(),
                updatedAt: new Date()
              });
              
              console.log(`[Asaas Webhook] Nova assinatura ${subscriptionId} criada para o usuário ${user._id}`);
              processed = true;
            }
          }
        }
        break;
        
      default:
        console.log(`[Asaas Webhook] Evento ${body.event} não processado (não implementado)`);
    }
    
    // Atualizar o documento de webhook com as informações de processamento
    await db.collection('processedWebhooks').updateOne(
      { eventId },
      { 
        $set: { 
          processed,
          subscriptionId,
          userId,
          processedAt: new Date() 
        } 
      }
    );
    
    return res.status(200).json({ 
      received: true, 
      processed,
      message: processed ? 'Evento processado com sucesso' : 'Evento recebido, mas não processado'
    });
    
  } catch (error) {
    console.error('[Asaas Webhook] Erro ao processar webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar webhook',
      error: error.message
    });
  }
};

/**
 * Mapeia o valor da assinatura para o tipo de plano
 * @param {number} value - Valor da assinatura
 * @returns {string} - Tipo do plano
 */
function mapPlanFromValue(value) {
  // Valores são exemplos, ajuste conforme sua estrutura de preços
  if (!value) return 'BASIC';
  
  if (value <= 19.90) return 'BASIC';
  if (value <= 39.90) return 'PRO';
  return 'PREMIUM';
}

module.exports = {
  processWebhook
}; 