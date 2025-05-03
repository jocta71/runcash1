/**
 * Script para testar a rota de webhook do Asaas
 * Simula o envio de um evento webhook para o endpoint local
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// URL do webhook (em produção seria a URL pública do seu servidor)
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/asaas';

// Simulação de evento do tipo SUBSCRIPTION_PAYMENT_RECEIVED
const mockSubscriptionEvent = {
  event: 'SUBSCRIPTION_PAYMENT_RECEIVED',
  subscription: {
    id: `sub_${uuidv4().substring(0, 8)}`,
    billingType: 'CREDIT_CARD',
    value: 49.90,
    status: 'ACTIVE',
    nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  payment: {
    id: `pay_${uuidv4().substring(0, 8)}`,
    status: 'CONFIRMED',
    value: 49.90,
    dueDate: new Date().toISOString()
  },
  customer: {
    id: process.env.CUSTOMER_ID || 'cus_000005113968'
  }
};

/**
 * Envia o webhook simulado para o endpoint
 */
async function sendWebhook() {
  try {
    console.log('Enviando webhook simulado para:', WEBHOOK_URL);
    console.log('Payload:', JSON.stringify(mockSubscriptionEvent, null, 2));
    
    const response = await axios.post(WEBHOOK_URL, mockSubscriptionEvent, {
      headers: {
        'Content-Type': 'application/json',
        // Em produção, o Asaas enviaria um cabeçalho de assinatura
        'Asaas-Signature': 'mock-signature-for-testing'
      }
    });
    
    console.log('Resposta do servidor:', response.status);
    console.log('Dados da resposta:', response.data);
    
  } catch (error) {
    console.error('Erro ao enviar webhook:', error.message);
    
    if (error.response) {
      console.error('Detalhes do erro:');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Executar o teste
sendWebhook(); 