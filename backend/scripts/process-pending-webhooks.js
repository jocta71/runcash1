/**
 * Script para processar webhooks pendentes e liberar acesso às roletas
 * Execute este script quando o MongoDB estiver disponível para processar
 * webhooks que não foram processados devido a problemas de conexão.
 * 
 * Uso: node scripts/process-pending-webhooks.js
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Configurações
const CONNECTION_STRING = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const BUFFER_FILE = path.join(__dirname, '..', 'data', 'webhook_buffer.json');

// Carregar modelos
require('../models/User');
require('../models/Subscription');
require('../models/Payment');
require('../models/Checkout');
require('../models/WebhookEvent');

// Funções auxiliares
async function findUserByCustomerId(customerId) {
  try {
    const User = mongoose.model('User');
    return await User.findOne({ 'billingInfo.asaasId': customerId });
  } catch (error) {
    console.error(`Erro ao buscar usuário por customerId ${customerId}:`, error);
    return null;
  }
}

async function updateUserSubscription(userId, plan = 'BASIC') {
  try {
    const User = mongoose.model('User');
    const Subscription = mongoose.model('Subscription');
    
    // Atualizar planStatus do usuário
    await User.updateOne(
      { _id: userId },
      { $set: { planStatus: 'ACTIVE' } }
    );
    
    console.log(`Status do plano do usuário ${userId} atualizado para ACTIVE`);
    
    // Verificar se já existe uma assinatura
    const existingSubscription = await mongoose.connection.collection('subscriptions').findOne({
      user_id: userId.toString()
    });
    
    if (existingSubscription) {
      // Atualizar assinatura existente
      await mongoose.connection.collection('subscriptions').updateOne(
        { _id: existingSubscription._id },
        {
          $set: {
            status: 'active',
            plan_id: plan,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`Assinatura existente atualizada para usuário ${userId}`);
    } else {
      // Criar nova assinatura
      await mongoose.connection.collection('subscriptions').insertOne({
        user_id: userId.toString(),
        status: 'active',
        plan_id: plan,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Nova assinatura criada para usuário ${userId}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Erro ao atualizar assinatura do usuário ${userId}:`, error);
    return false;
  }
}

async function processWebhook(webhook) {
  try {
    const event = webhook.data.event;
    console.log(`Processando webhook ${webhook.webhookId} com evento ${event}`);
    
    // Extrair customerId
    const customerId = webhook.data.payment?.customer || 
                       webhook.data.subscription?.customer || 
                       webhook.data.checkout?.customer;
    
    if (!customerId) {
      console.warn(`Webhook ${webhook.webhookId} não contém customerId`);
      return false;
    }
    
    // Encontrar usuário
    const user = await findUserByCustomerId(customerId);
    
    if (!user) {
      console.warn(`Usuário não encontrado para customerId ${customerId}`);
      return false;
    }
    
    // Processar com base no evento
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        // Liberar acesso às roletas
        await updateUserSubscription(user._id, user.planType || 'BASIC');
        console.log(`Acesso às roletas liberado para usuário ${user._id} (${user.email})`);
        break;
        
      case 'SUBSCRIPTION_CREATED':
      case 'SUBSCRIPTION_RENEWED':
        // Liberar acesso às roletas
        await updateUserSubscription(user._id, user.planType || 'BASIC');
        console.log(`Acesso às roletas liberado para usuário ${user._id} (${user.email}) por assinatura`);
        break;
        
      case 'SUBSCRIPTION_UPDATED':
        // Verificar status da assinatura
        const subStatus = webhook.data.subscription?.status;
        if (subStatus === 'ACTIVE') {
          await updateUserSubscription(user._id, user.planType || 'BASIC');
          console.log(`Acesso às roletas liberado para usuário ${user._id} (${user.email}) por atualização de assinatura`);
        } else if (subStatus === 'INACTIVE' || subStatus === 'OVERDUE') {
          // Desativar plano
          await User.updateOne(
            { _id: user._id },
            { $set: { planStatus: 'INACTIVE' } }
          );
          console.log(`Acesso às roletas revogado para usuário ${user._id} (${user.email}) por inatividade de assinatura`);
        }
        break;
        
      default:
        console.log(`Evento ${event} não requer ação para liberação de roletas`);
    }
    
    return true;
  } catch (error) {
    console.error(`Erro ao processar webhook ${webhook.webhookId}:`, error);
    return false;
  }
}

// Carregar e processar buffer
async function processBuffer() {
  try {
    // Verificar se arquivo existe
    if (!fs.existsSync(BUFFER_FILE)) {
      console.warn('Arquivo de buffer não encontrado:', BUFFER_FILE);
      return { processed: 0, failed: 0, total: 0 };
    }
    
    // Carregar buffer
    const bufferData = fs.readFileSync(BUFFER_FILE, 'utf8');
    const webhooks = JSON.parse(bufferData);
    
    console.log(`Carregados ${webhooks.length} webhooks do buffer`);
    
    // Processar cada webhook
    let processed = 0;
    let failed = 0;
    
    for (const webhook of webhooks) {
      console.log(`Processando webhook ${webhook.webhookId}`);
      const success = await processWebhook(webhook);
      
      if (success) {
        processed++;
      } else {
        failed++;
      }
    }
    
    return { processed, failed, total: webhooks.length };
  } catch (error) {
    console.error('Erro ao processar buffer:', error);
    return { processed: 0, failed: 0, error: error.message };
  }
}

// Função principal
async function main() {
  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(CONNECTION_STRING);
    
    console.log('Conexão estabelecida. Processando webhooks pendentes...');
    const result = await processBuffer();
    
    console.log('=== RESULTADO DO PROCESSAMENTO ===');
    console.log(`Total de webhooks: ${result.total}`);
    console.log(`Processados com sucesso: ${result.processed}`);
    console.log(`Falhas: ${result.failed}`);
    
    // Fechar conexão
    await mongoose.disconnect();
    console.log('Processamento concluído.');
  } catch (error) {
    console.error('Erro fatal:', error);
    process.exit(1);
  }
}

// Executar
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Erro não tratado:', error);
    process.exit(1);
  }); 