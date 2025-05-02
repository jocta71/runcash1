/**
 * Script para testar o processamento de webhooks com status RECEIVED
 * Simula o envio de um webhook do Asaas com status de pagamento RECEIVED
 */

const axios = require('axios');
require('dotenv').config();

// URL do webhook
const WEBHOOK_URL = process.env.FRONTEND_URL 
  ? `${process.env.FRONTEND_URL}/api/asaas-webhook` 
  : 'http://localhost:3000/api/asaas-webhook';

// ID da assinatura e cliente para teste (substitua por IDs válidos)
const TEST_SUBSCRIPTION_ID = 'sub_abc123';
const TEST_CUSTOMER_ID = 'cus_abc123';
const TEST_PAYMENT_ID = 'pay_abc123';

/**
 * Função para enviar um webhook simulado
 * @param {string} status - Status do pagamento (RECEIVED, CONFIRMED, etc.)
 */
async function sendMockWebhook(status = 'RECEIVED') {
  console.log(`==== Enviando Webhook Simulado (${status}) ====`);
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log('--------------------------------------');

  // Dados do webhook simulado
  const webhookData = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: TEST_PAYMENT_ID,
      customer: TEST_CUSTOMER_ID,
      subscription: TEST_SUBSCRIPTION_ID,
      value: 49.90,
      netValue: 48.90,
      originalValue: 49.90,
      paymentDate: new Date().toISOString(),
      description: 'Assinatura RunCash - Plano Mensal',
      billingType: 'PIX',
      status: status,
      confirmed: status === 'CONFIRMED',
      invoiceUrl: 'https://sandbox.asaas.com/i/123456789',
      invoiceNumber: '12345',
      externalReference: null,
      deleted: false,
      postalService: false
    }
  };

  try {
    console.log('Enviando dados do webhook:', JSON.stringify(webhookData, null, 2));
    
    const response = await axios.post(WEBHOOK_URL, webhookData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Status da resposta:', response.status);
    console.log('Resposta:', response.data);
    console.log('Webhook enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar webhook:', error.message);
    if (error.response) {
      console.error('Status do erro:', error.response.status);
      console.error('Dados do erro:', error.response.data);
    }
  }
}

// Solicitar status ao usuário ou usar o padrão
const status = process.argv[2] || 'RECEIVED';
console.log(`Usando status: ${status}`);

// Executar teste
sendMockWebhook(status); 