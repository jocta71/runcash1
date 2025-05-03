const axios = require('axios');
const { MongoClient } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

// URL do webhook local ou de produção
const webhookUrl = 'http://localhost:5000/api/webhook/asaas';

// Dados do evento simulado 
const simulateEvent = async (eventType, subscriptionId, status) => {
  // Conectar ao MongoDB para buscar dados necessários
  const client = new MongoClient(url);
  
  try {
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    const db = client.db(dbName);
    
    // Buscar uma assinatura existente para obter os dados necessários
    const subscription = await db.collection('subscriptions').findOne({ payment_id: subscriptionId });
    
    if (!subscription) {
      console.error(`Assinatura com ID ${subscriptionId} não encontrada`);
      return;
    }
    
    // Buscar o usuário para completar as informações
    const user = await db.collection('users').findOne({ _id: subscription.user_id });
    
    if (!user) {
      console.error(`Usuário não encontrado para a assinatura ${subscriptionId}`);
      return;
    }
    
    // Montar o payload do webhook
    const webhookPayload = {
      event: eventType,
      payment: {
        id: `pmt_${Math.random().toString(36).substring(2, 10)}`,
        customer: user.asaasCustomerId || user.asaas?.customerId,
        subscription: subscriptionId,
        value: 29.90,
        netValue: 28.90,
        billingType: 'PIX',
        status: status,
        dueDate: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0],
        description: 'Pagamento da assinatura',
        invoiceUrl: 'https://www.asaas.com/i/123456',
        invoiceNumber: '12345'
      }
    };
    
    console.log('\nEnviando evento simulado para o webhook:');
    console.log(JSON.stringify(webhookPayload, null, 2));
    
    // Enviar para o webhook
    const response = await axios.post(webhookUrl, webhookPayload);
    
    console.log('\nResposta do webhook:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verificar se a coleção userSubscriptions foi atualizada
    console.log('\nVerificando se a coleção userSubscriptions foi atualizada:');
    
    const userSubscription = await db.collection('userSubscriptions').findOne({
      asaasSubscriptionId: subscriptionId
    });
    
    if (userSubscription) {
      console.log('Registro encontrado na coleção userSubscriptions:');
      console.log(JSON.stringify(userSubscription, null, 2));
    } else {
      console.log('Nenhum registro encontrado na coleção userSubscriptions para esta assinatura');
    }
    
  } catch (error) {
    console.error('Erro ao enviar evento simulado:', error.message);
    if (error.response) {
      console.error('Detalhes da resposta de erro:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
};

// Função para listar assinaturas ativas
const listActiveSubscriptions = async () => {
  const client = new MongoClient(url);
  
  try {
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    const db = client.db(dbName);
    
    console.log('\nAssinaturas ativas:');
    const subscriptions = await db.collection('subscriptions').find({
      status: 'active'
    }).limit(10).toArray();
    
    if (subscriptions.length === 0) {
      console.log('Nenhuma assinatura ativa encontrada');
    } else {
      subscriptions.forEach(sub => {
        console.log(`ID: ${sub.payment_id}, Usuário: ${sub.user_id}, Plano: ${sub.plan_id}`);
      });
    }
    
  } catch (error) {
    console.error('Erro ao listar assinaturas ativas:', error.message);
  } finally {
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
};

// Comando principal para executar o teste
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'list') {
    await listActiveSubscriptions();
    
  } else if (args[0] === 'simulate') {
    if (args.length < 2) {
      console.error('Forneça o ID da assinatura: node test-webhook-asaas.js simulate <subscription_id> [event_type]');
      return;
    }
    
    const subscriptionId = args[1];
    const eventType = args[2] || 'PAYMENT_CONFIRMED';
    const status = eventType === 'PAYMENT_CONFIRMED' ? 'CONFIRMED' : 
                  eventType === 'PAYMENT_OVERDUE' ? 'OVERDUE' : 'REFUNDED';
    
    await simulateEvent(eventType, subscriptionId, status);
    
  } else {
    console.log(`
Uso:
  node test-webhook-asaas.js list          - Lista assinaturas ativas
  node test-webhook-asaas.js simulate <id> - Simula um evento PAYMENT_CONFIRMED
  node test-webhook-asaas.js simulate <id> <tipo> - Simula um evento específico
  
Tipos de eventos disponíveis:
  PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED
    `);
  }
};

// Executar
main().catch(console.error); 