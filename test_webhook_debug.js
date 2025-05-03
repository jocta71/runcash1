const https = require('https');

// Três URLs para testar (todas as variantes configuradas)
const urls = [
  { path: '/api/asaas-webhook', description: 'Rota padrão' },
  { path: '/asaas-webhook', description: 'Rota alternativa sem /api' },
  { path: '/webhook/asaas', description: 'Rota alternativa com /webhook' }
];

// Dados para simular um evento de webhook do Asaas
const webhookData = {
  id: "evt_test_debug_123456789",
  event: "SUBSCRIPTION_CREATED",
  dateCreated: "2025-05-03 20:50:00",
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

// Hostname do servidor de API
const hostname = 'backendapi-production-36b5.up.railway.app';

// Testar cada URL
async function testUrls() {
  for (const urlInfo of urls) {
    console.log(`\n===== Testando ${urlInfo.description}: ${urlInfo.path} =====`);
    
    // Configuração da requisição
    const options = {
      hostname: hostname,
      path: urlInfo.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Asaas-Webhook-Test/1.0',
        'X-Debug': 'true'
      }
    };
    
    // Fazer a requisição
    await new Promise((resolve, reject) => {
      console.log(`Enviando requisição para: https://${options.hostname}${options.path}`);
      
      // Primeiro, vamos verificar se a rota existe com uma requisição OPTIONS
      const optionsReq = https.request({
        ...options,
        method: 'OPTIONS'
      }, (res) => {
        console.log(`OPTIONS - Status: ${res.statusCode}`);
        console.log(`OPTIONS - Headers: ${JSON.stringify(res.headers)}`);
        
        let optionsData = '';
        res.on('data', (chunk) => { optionsData += chunk; });
        res.on('end', () => {
          console.log('OPTIONS - Resposta:', optionsData);
          
          // Agora fazer a requisição POST principal
          const req = https.request(options, (res) => {
            console.log(`POST - Status: ${res.statusCode}`);
            console.log(`POST - Headers: ${JSON.stringify(res.headers)}`);
            
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              console.log('POST - Corpo da resposta:');
              try {
                const responseData = JSON.parse(data);
                console.log(JSON.stringify(responseData, null, 2));
              } catch (e) {
                console.log(data);
              }
              resolve();
            });
          });
          
          req.on('error', (error) => {
            console.error('Erro na requisição POST:', error);
            resolve();
          });
          
          // Enviar os dados do webhook
          req.write(JSON.stringify(webhookData));
          req.end();
        });
      });
      
      optionsReq.on('error', (error) => {
        console.error('Erro na requisição OPTIONS:', error);
        resolve();
      });
      
      optionsReq.end();
    });
  }
}

// Verificar a disponibilidade geral do servidor
console.log("Verificando disponibilidade do servidor...");
https.get(`https://${hostname}/`, (res) => {
  console.log(`Disponibilidade - Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log("Resposta do servidor:");
    try {
      const responseData = JSON.parse(data);
      console.log(JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.log(data);
    }
    
    // Iniciar os testes de webhook
    testUrls();
  });
}).on('error', (error) => {
  console.error("Erro ao verificar disponibilidade:", error);
}); 