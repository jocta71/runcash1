const express = require('express');
const router = express.Router();
const { User } = require('../../models/User');
const { Subscription } = require('../../models/Subscription');
const { authenticateUser } = require('../../middleware/auth');
const { asaasApiInstance } = require('../../integrations/asaas/instance');
const logger = require('../../utils/logger');

/**
 * Reconstruir dados de assinatura a partir de IDs conhecidos
 * Este endpoint é útil quando temos os IDs mas o sistema está em estado inconsistente
 */
router.post('/rebuild', authenticateUser, async (req, res) => {
  try {
    const { userId, subscriptionId, paymentId, customerAsaasId, planType, forceActivation } = req.body;

    // Verificar permissões - usuário só pode reconstruir sua própria assinatura
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Permissão negada: Você só pode reconstruir sua própria assinatura'
      });
    }

    // Buscar o usuário no banco de dados
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se existe uma assinatura existente
    let subscription = await Subscription.findOne({ userId });
    let isNew = false;

    // Se não existir assinatura ainda, criar uma nova
    if (!subscription) {
      logger.info(`Criando nova assinatura para usuário ${userId} com IDs conhecidos`);
      subscription = new Subscription({
        userId,
        asaasSubscriptionId: subscriptionId,
        asaasCustomerId: customerAsaasId || user.asaasCustomerId,
        planType: planType || 'pro',
        status: forceActivation ? 'active' : 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      isNew = true;
    } else {
      logger.info(`Atualizando assinatura existente para usuário ${userId}`);
      // Atualizar a assinatura existente
      subscription.asaasSubscriptionId = subscriptionId || subscription.asaasSubscriptionId;
      subscription.asaasCustomerId = customerAsaasId || user.asaasCustomerId || subscription.asaasCustomerId;
      subscription.planType = planType || subscription.planType;
      subscription.lastPaymentId = paymentId || subscription.lastPaymentId;
      
      if (forceActivation) {
        subscription.status = 'active';
      }
      
      subscription.updatedAt = new Date();
    }

    // Tentar verificar no Asaas se a assinatura existe
    try {
      const asaasResponse = await asaasApiInstance.get(`/subscriptions/${subscriptionId}`);
      
      if (asaasResponse.data) {
        logger.info(`Assinatura ${subscriptionId} encontrada no Asaas`);
        // Preencher com dados do Asaas
        subscription.status = asaasResponse.data.status === 'ACTIVE' ? 'active' : 'inactive';
        subscription.nextDueDate = asaasResponse.data.nextDueDate || subscription.nextDueDate;
        subscription.value = asaasResponse.data.value || subscription.value;
      }
    } catch (asaasError) {
      logger.warn(`Erro ao verificar assinatura no Asaas: ${asaasError.message}`);
      // Se não conseguir verificar no Asaas e forceActivation estiver ativo, prosseguir mesmo assim
      if (!forceActivation) {
        return res.status(404).json({
          success: false,
          message: 'Assinatura não encontrada no Asaas ou erro na comunicação',
          error: asaasError.message
        });
      }
    }

    // Salvar a assinatura reconstruída
    await subscription.save();

    // Verificar se é necessário atualizar o usuário também
    if (user && customerAsaasId && !user.asaasCustomerId) {
      user.asaasCustomerId = customerAsaasId;
      await user.save();
      logger.info(`ID do cliente Asaas ${customerAsaasId} atualizado para o usuário ${userId}`);
    }

    return res.status(200).json({
      success: true,
      message: isNew ? 'Assinatura reconstruída com sucesso' : 'Assinatura atualizada com sucesso',
      subscription: {
        id: subscription._id,
        status: subscription.status,
        planType: subscription.planType,
        asaasSubscriptionId: subscription.asaasSubscriptionId,
        nextDueDate: subscription.nextDueDate
      }
    });
    
  } catch (error) {
    logger.error(`Erro ao reconstruir assinatura: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erro ao reconstruir assinatura',
      error: error.message
    });
  }
});

module.exports = router; 