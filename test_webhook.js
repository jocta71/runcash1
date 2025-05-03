const https = require('https');

// Dados para simular um evento de webhook do Asaas
const webhookData = {
  id: "evt_test_123456789",
  event: "SUBSCRIPTION_CREATED",
  dateCreated: "2025-05-03 20:35:17",
  subscription: {
    object: "subscription",
    id: "sub_test_webhook123",
    dateCreated: "03/05/2025",
    customer: "cus_000006678275",
    paymentLink: null,
    value: 99.9,
    nextDueDate: "04/06/2025",
    cycle: "MONTHLY",
    description: "Assinatura RunCash - Plano premium",
    billingType: "PIX",
    deleted: false,
    status: "ACTIVE",
    externalReference: null,
    checkoutSession: null,
    sendPaymentByPostalService: false,
    fine: {
      value: 0,
      type: "FIXED"
    },
    interest: {
      value: 0,
      type: "PERCENTAGE"
    },
    split: null
  }
};

// Configuração da requisição
const options = {
  hostname: 'backendapi-production-36b5.up.railway.app',
  path: '/api/asaas-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Asaas-Webhook-Test/1.0'
  }
};

console.log('Enviando teste de webhook para:', `https://${options.hostname}${options.path}`);
console.log('Payload:', JSON.stringify(webhookData, null, 2));

// Fazer a requisição
const req = https.request(options, (res) => {
  console.log(`Status da resposta: ${res.statusCode}`);
  console.log(`Cabeçalhos da resposta:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Corpo da resposta:');
    try {
      const responseData = JSON.parse(data);
      console.log(JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Erro na requisição:', error);
});

// Enviar os dados do webhook
req.write(JSON.stringify(webhookData));
req.end(); 