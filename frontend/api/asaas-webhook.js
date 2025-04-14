/**
 * API para receber e processar webhooks do Asaas
 * 
 * Este endpoint recebe notificações do Asaas sobre pagamentos,
 * assinaturas, e outros eventos relacionados a transações.
 */

import { connectToDatabase } from '../src/utils/mongodb';
import { verifyAsaasRequest } from '../src/utils/asaas-helpers';

export default async function handler(req, res) {
  // Apenas aceitar método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido' 
    });
  }

  console.log('[Asaas Webhook] Recebendo notificação:', 
    JSON.stringify(req.body, null, 2)
  );

  try {
    // Validar a origem da solicitação usando uma chave secreta compartilhada
    // ou cabeçalhos especiais conforme documentação do Asaas
    const isValidRequest = await verifyAsaasRequest(req);
    
    if (!isValidRequest) {
      console.error('[Asaas Webhook] Assinatura inválida ou origem não confiável');
      return res.status(401).json({ 
        success: false, 
        message: 'Assinatura inválida ou origem não confiável' 
      });
    }

    // Extrair dados do evento
    const { 
      event,
      payment = {}, 
      subscription = {}
    } = req.body;

    // Obter o ID do usuário a partir dos metadados
    const userId = payment.externalReference || 
                   subscription.externalReference || 
                   req.body.externalReference;
    
    if (!userId) {
      console.error('[Asaas Webhook] ID do usuário não encontrado na notificação');
      return res.status(400).json({ 
        success: false, 
        message: 'ID do usuário não encontrado na notificação' 
      });
    }

    // Conectar ao banco de dados
    const { db } = await connectToDatabase();
    
    // Processar o evento com base no tipo
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        // Pagamento recebido ou confirmado
        console.log(`[Asaas Webhook] Pagamento ${payment.id} confirmado para usuário ${userId}`);
        
        // Obter o plano associado ao pagamento
        const planId = payment.description?.includes('Pro') ? 'pro' : 'basic';
        
        // Registrar a assinatura no banco de dados
        await registerSubscription(db, userId, planId, payment);
        
        break;
      }
      
      case 'PAYMENT_OVERDUE': {
        // Pagamento em atraso
        console.log(`[Asaas Webhook] Pagamento ${payment.id} em atraso para usuário ${userId}`);
        
        // Atualizar o status da assinatura para em atraso
        await updateSubscriptionStatus(db, userId, 'overdue');
        
        break;
      }
      
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK': {
        // Pagamento cancelado, reembolsado ou estornado
        console.log(`[Asaas Webhook] Pagamento ${payment.id} cancelado/reembolsado para usuário ${userId}`);
        
        // Cancelar a assinatura
        await updateSubscriptionStatus(db, userId, 'canceled');
        
        break;
      }
      
      case 'SUBSCRIPTION_ACTIVATED': {
        // Assinatura ativada
        console.log(`[Asaas Webhook] Assinatura ${subscription.id} ativada para usuário ${userId}`);
        
        // Obter o plano associado à assinatura
        const planId = subscription.description?.includes('Pro') ? 'pro' : 'basic';
        
        // Registrar ou atualizar a assinatura no banco de dados
        await registerSubscription(db, userId, planId, null, subscription);
        
        break;
      }
      
      case 'SUBSCRIPTION_RENEWED': {
        // Assinatura renovada
        console.log(`[Asaas Webhook] Assinatura ${subscription.id} renovada para usuário ${userId}`);
        
        // Atualizar a data de próxima cobrança
        await updateSubscriptionNextBilling(db, userId, subscription.nextDueDate);
        
        break;
      }
      
      case 'SUBSCRIPTION_CANCELED': {
        // Assinatura cancelada
        console.log(`[Asaas Webhook] Assinatura ${subscription.id} cancelada para usuário ${userId}`);
        
        // Cancelar a assinatura
        await updateSubscriptionStatus(db, userId, 'canceled');
        
        break;
      }
      
      case 'SUBSCRIPTION_EXPIRED': {
        // Assinatura expirada
        console.log(`[Asaas Webhook] Assinatura ${subscription.id} expirada para usuário ${userId}`);
        
        // Cancelar a assinatura
        await updateSubscriptionStatus(db, userId, 'expired');
        
        break;
      }
      
      default:
        // Evento desconhecido
        console.log(`[Asaas Webhook] Evento não tratado: ${event}`);
    }

    // Retornar sucesso
    return res.status(200).json({ 
      success: true, 
      message: 'Notificação processada com sucesso' 
    });
  } catch (error) {
    console.error('[Asaas Webhook] Erro ao processar webhook:', error);
    
    // Retornar erro interno do servidor
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar webhook', 
      error: error.message 
    });
  }
}

/**
 * Registra uma nova assinatura no banco de dados
 */
async function registerSubscription(db, userId, planId, payment = null, subscription = null) {
  try {
    // Encontrar usuário por ID
    const user = await db.collection('users').findOne({ _id: userId });
    
    if (!user) {
      console.error(`[Asaas Webhook] Usuário ${userId} não encontrado no banco de dados`);
      return false;
    }
    
    // Dados da assinatura
    const subscriptionData = {
      planId,
      status: 'active',
      startDate: new Date(),
      nextBillingDate: subscription?.nextDueDate || payment?.dueDate || null,
      paymentId: payment?.id || null,
      subscriptionId: subscription?.id || null,
      updatedAt: new Date()
    };
    
    // Verificar se já existe uma assinatura
    const existingSubscription = await db.collection('subscriptions').findOne({ userId });
    
    if (existingSubscription) {
      // Atualizar assinatura existente
      await db.collection('subscriptions').updateOne(
        { userId },
        { $set: subscriptionData }
      );
      
      console.log(`[Asaas Webhook] Assinatura atualizada para usuário ${userId}`);
    } else {
      // Criar nova assinatura
      await db.collection('subscriptions').insertOne({
        userId,
        ...subscriptionData,
        createdAt: new Date()
      });
      
      console.log(`[Asaas Webhook] Nova assinatura criada para usuário ${userId}`);
    }
    
    // Atualizar o usuário com o planId
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          "subscription.planId": planId,
          "subscription.status": "active",
          "subscription.startDate": new Date(),
          "subscription.nextBillingDate": subscription?.nextDueDate || payment?.dueDate || null,
          updatedAt: new Date()
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('[Asaas Webhook] Erro ao registrar assinatura:', error);
    throw error;
  }
}

/**
 * Atualiza o status de uma assinatura existente
 */
async function updateSubscriptionStatus(db, userId, status) {
  try {
    // Atualizar a assinatura
    await db.collection('subscriptions').updateOne(
      { userId },
      { 
        $set: { 
          status,
          updatedAt: new Date()
        }
      }
    );
    
    // Atualizar o usuário
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          "subscription.status": status,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`[Asaas Webhook] Status da assinatura atualizado para ${status} - usuário ${userId}`);
    
    return true;
  } catch (error) {
    console.error('[Asaas Webhook] Erro ao atualizar status da assinatura:', error);
    throw error;
  }
}

/**
 * Atualiza a data da próxima cobrança
 */
async function updateSubscriptionNextBilling(db, userId, nextBillingDate) {
  try {
    // Converter string para data se necessário
    const nextBilling = typeof nextBillingDate === 'string'
      ? new Date(nextBillingDate)
      : nextBillingDate;
    
    // Atualizar a assinatura
    await db.collection('subscriptions').updateOne(
      { userId },
      { 
        $set: { 
          nextBillingDate: nextBilling,
          updatedAt: new Date()
        }
      }
    );
    
    // Atualizar o usuário
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          "subscription.nextBillingDate": nextBilling,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`[Asaas Webhook] Próxima cobrança atualizada para ${nextBillingDate} - usuário ${userId}`);
    
    return true;
  } catch (error) {
    console.error('[Asaas Webhook] Erro ao atualizar próxima cobrança:', error);
    throw error;
  }
} 