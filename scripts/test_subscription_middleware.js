/**
 * Script para testar o middleware de verificação de assinatura
 * Simula uma requisição HTTP para verificar se o middleware funciona corretamente
 */

import { MongoClient, ObjectId } from 'mongodb';

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = process.env.DB_NAME || "runcash";

// Implementação manual do middleware para fins de teste
async function checkActiveSubscription(req) {
  console.log('🔍 Executando middleware de verificação de assinatura...');
  
  try {
    // Verificar se o usuário está autenticado
    if (!req.user || !req.user.id) {
      console.log('❌ Usuário não autenticado');
      return {
        success: false,
        status: 401,
        message: 'Usuário não autenticado',
        code: 'AUTH_REQUIRED'
      };
    }
    
    const userId = req.user.id;
    console.log(`👤 Usuário autenticado: ${userId}`);
    
    // Conectar ao MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    // Buscar assinatura ativa do usuário
    const subscription = await db.collection('userSubscriptions').findOne({
      userId,
      status: 'ACTIVE' // Apenas assinaturas ativas
    });
    
    await client.close();
    
    if (!subscription) {
      // Usuário sem assinatura ativa
      console.log('❌ Usuário sem assinatura ativa');
      return {
        success: false,
        status: 403,
        message: 'Este recurso requer uma assinatura ativa',
        code: 'SUBSCRIPTION_REQUIRED'
      };
    }
    
    // Adicionar informações da assinatura à requisição
    req.userPlan = {
      type: subscription.planType,
      isActive: true,
      nextDueDate: subscription.nextDueDate,
      asaasSubscriptionId: subscription.asaasSubscriptionId
    };
    
    console.log(`✅ Assinatura ativa encontrada: ${subscription.planType}`);
    return {
      success: true,
      message: 'Assinatura válida'
    };
  } catch (error) {
    console.error('❌ Erro ao verificar assinatura:', error);
    return {
      success: false,
      status: 500,
      message: 'Erro ao verificar status da assinatura',
      error: error.message
    };
  }
}

async function testMiddleware() {
  console.log('=== TESTE DE MIDDLEWARE DE ASSINATURA ===\n');
  
  // Caso 1: Usuário não autenticado
  console.log('Caso 1: Usuário não autenticado');
  const req1 = {};
  const result1 = await checkActiveSubscription(req1);
  console.log('Resultado:', result1);
  console.log('');
  
  // Obter uma assinatura de teste existente
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  
  const testSubscription = await db.collection('userSubscriptions').findOne({
    asaasSubscriptionId: 'test_subscription_001'
  });
  
  // Caso 2: Usuário com assinatura ativa
  console.log('Caso 2: Usuário com assinatura ativa');
  const req2 = {
    user: {
      id: testSubscription ? testSubscription.userId : 'user_id_inexistente'
    }
  };
  const result2 = await checkActiveSubscription(req2);
  console.log('Resultado:', result2);
  console.log('Detalhes do plano adicionados à requisição:', req2.userPlan);
  console.log('');
  
  // Caso 3: Usuário sem assinatura ativa
  console.log('Caso 3: Usuário sem assinatura ativa');
  const randomUserId = new ObjectId().toString();
  const req3 = {
    user: {
      id: randomUserId
    }
  };
  const result3 = await checkActiveSubscription(req3);
  console.log('Resultado:', result3);
  console.log('');
  
  await client.close();
  console.log('=== TESTES CONCLUÍDOS ===');
}

// Executar testes
testMiddleware()
  .then(() => console.log('Script finalizado'))
  .catch(err => console.error('Erro ao executar testes:', err)); 