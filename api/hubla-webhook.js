import mongoose from 'mongoose';
import { connectToDatabase } from '../_db.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { WebhookLog } from '../models/WebhookLog.js'; 

// Configurações da Hubla
const HUBLA_TOKEN = process.env.HUBLA_TOKEN || 'rEJhmsBOXTS0fDtH1Fs1q2r6uIVv83QKAR0MqVhjQusXCkAeYybTWfCSH3N7cI3O';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

// Função principal para processar a requisição de webhook
export default async function handler(req, res) {
  // Verificar se o método é POST
  if (req.method !== 'POST') {
    console.warn('Método não permitido:', req.method);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar a autenticação usando o token da Hubla no cabeçalho
    if (!validateHublaRequest(req)) {
      console.error('Falha na validação do token da Hubla');
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Obter os dados da requisição
    const data = req.body;
    
    // Registrar o webhook no log para debugging
    await logWebhook(req);

    // Verificar se os dados são válidos
    if (!data || !data.type) {
      console.error('Payload do webhook inválido:', data);
      return res.status(400).json({ error: 'Payload inválido' });
    }

    // Determinar a versão do webhook e processar de acordo
    const webhookVersion = data.version || '1.0.0';
    console.log(`Processando webhook versão ${webhookVersion}, tipo: ${data.type}`);

    let processResult;
    
    if (webhookVersion.startsWith('2.')) {
      // Processar webhook versão 2.x
      processResult = await processWebhookV2(data);
    } else {
      // Processar webhook versão 1.x (legado)
      processResult = await processWebhookV1(data);
    }

    // Retornar a resposta com o resultado do processamento
    return res.status(200).json({
      received: true,
      event_type: data.type,
      timestamp: new Date().toISOString(),
      ...processResult
    });
  } catch (error) {
    // Registrar erro detalhado
    console.error('Erro ao processar webhook:', error);
    
    // Retornar erro 500 com detalhes (apenas em modo de depuração)
    if (DEBUG_MODE) {
      return res.status(500).json({ 
        error: 'Erro interno do servidor', 
        details: error.message,
        stack: error.stack
      });
    } else {
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

// Função para validar a requisição da Hubla usando o token
function validateHublaRequest(req) {
  // Verificar o cabeçalho com o token da Hubla
  const hublaToken = req.headers['x-hubla-token'];
  
  // Verificar se o token é válido
  if (!hublaToken || hublaToken !== HUBLA_TOKEN) {
    console.warn('Token da Hubla inválido:', hublaToken);
    return false;
  }
  
  return true;
}

// Função para registrar o webhook no log
async function logWebhook(req) {
  try {
    // Conectar ao banco de dados
    await connectToDatabase();
    
    // Criar um novo log
    const webhookLog = new WebhookLog({
      event_type: req.body.type || 'unknown',
      headers: req.headers,
      body: req.body,
      timestamp: new Date()
    });
    
    // Salvar o log
    await webhookLog.save();
    console.log('Webhook registrado no log com sucesso');
  } catch (error) {
    console.error('Erro ao registrar webhook no log:', error);
    // Não lançar exceção para não interromper o processamento principal
  }
}

// Processar webhook da versão 2.x
async function processWebhookV2(data) {
  // Conectar ao banco de dados
  await connectToDatabase();
  
  // Extrair o evento com base no tipo
  switch (data.type) {
    case 'SubscriptionActivated':
    case 'SubscriptionCreated':
      return await processSubscriptionEvent(data);
    
    case 'SubscriptionExpired':
    case 'SubscriptionDeactivated':
      return await processCancellationEvent(data);
      
    case 'InvoicePaymentSucceeded':
    case 'InvoiceCreated':
      return await processInvoiceEvent(data);
      
    default:
      console.log(`Evento não processado: ${data.type} (v2)`);
      return { status: 'ignored', reason: 'event_type_not_handled' };
  }
}

// Processar webhook da versão 1.x (legado)
async function processWebhookV1(data) {
  // Conectar ao banco de dados
  await connectToDatabase();
  
  // Extrair o evento com base no tipo
  switch (data.type) {
    case 'NewSale':
      return await processNewSaleEvent(data.event);
    
    case 'CanceledSubscription':
      return await processCanceledSubscriptionEvent(data.event);
      
    default:
      console.log(`Evento não processado: ${data.type} (v1)`);
      return { status: 'ignored', reason: 'event_type_not_handled' };
  }
}

// Processar eventos de ativação de assinatura (v2)
async function processSubscriptionEvent(data) {
  console.log('Processando evento de assinatura:', data.type);
  
  try {
    // Extrair dados da assinatura
    const subscription = data.data?.subscription;
    if (!subscription) {
      throw new Error('Dados da assinatura não encontrados no payload');
    }
    
    // Extrair metadados 
    const metadata = subscription.metadata || {};
    
    // Obter o ID do usuário (priorizar metadados, depois tentar outros campos)
    let userId = metadata.userId;
    if (!userId) {
      userId = subscription.customer?.userId || subscription.customer?.id;
    }
    
    if (!userId) {
      throw new Error('ID do usuário não encontrado nos dados da assinatura');
    }
    
    console.log('ID do usuário encontrado:', userId);
    
    // Tentar encontrar o usuário por ID (qualquer formato possível)
    const user = await findUserByAnyId(userId);
    
    if (!user) {
      throw new Error(`Usuário não encontrado com ID: ${userId}`);
    }
    
    // Determinar o plano com base no nome ou metadados
    const planId = metadata.planId || determinePlanFromSubscription(subscription);
    
    if (!planId) {
      throw new Error('Não foi possível determinar o plano da assinatura');
    }
    
    console.log(`Atualizando assinatura para o usuário ${user._id}, plano ${planId}`);
    
    // Atualizar ou criar a assinatura no banco de dados
    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        planId: planId,
        status: 'active',
        provider: 'hubla',
        externalId: subscription.id,
        startDate: new Date(subscription.startedAt || subscription.createdAt || Date.now()),
        endDate: subscription.expiresAt ? new Date(subscription.expiresAt) : null,
        autoRenew: subscription.autoRenew || false,
        metadata: {
          subscriptionData: subscription,
          raw: data
        },
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log(`Assinatura atualizada com sucesso para o usuário ${user._id}`);
    
    return { 
      status: 'success', 
      userId: user._id,
      planId: planId
    };
  } catch (error) {
    console.error('Erro ao processar evento de assinatura:', error);
    throw error;
  }
}

// Processar eventos de cancelamento de assinatura (v2)
async function processCancellationEvent(data) {
  console.log('Processando evento de cancelamento:', data.type);
  
  try {
    // Extrair dados da assinatura
    const subscription = data.data?.subscription;
    if (!subscription) {
      throw new Error('Dados da assinatura não encontrados no payload');
    }
    
    // Extrair metadados 
    const metadata = subscription.metadata || {};
    
    // Obter o ID do usuário (priorizar metadados, depois tentar outros campos)
    let userId = metadata.userId;
    if (!userId) {
      userId = subscription.customer?.userId || subscription.customer?.id;
    }
    
    if (!userId) {
      throw new Error('ID do usuário não encontrado nos dados da assinatura');
    }
    
    // Tentar encontrar o usuário por ID (qualquer formato possível)
    const user = await findUserByAnyId(userId);
    
    if (!user) {
      throw new Error(`Usuário não encontrado com ID: ${userId}`);
    }
    
    console.log(`Cancelando assinatura para o usuário ${user._id}`);
    
    // Atualizar a assinatura no banco de dados
    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        status: 'canceled',
        endDate: new Date(),
        autoRenew: false,
        metadata: {
          ...subscription,
          canceledAt: new Date(),
          raw: data
        },
        updatedAt: new Date()
      }
    );
    
    console.log(`Assinatura cancelada com sucesso para o usuário ${user._id}`);
    
    return { 
      status: 'success', 
      userId: user._id
    };
  } catch (error) {
    console.error('Erro ao processar evento de cancelamento:', error);
    throw error;
  }
}

// Processar eventos de fatura (v2)
async function processInvoiceEvent(data) {
  console.log('Processando evento de fatura:', data.type);
  
  // Implementação a ser adicionada
  return { status: 'success', message: 'Evento de fatura registrado' };
}

// Processar evento de nova venda (v1)
async function processNewSaleEvent(event) {
  console.log('Processando evento de nova venda (v1):', event);
  
  try {
    // Extrair o ID do usuário do evento
    const userId = event.userId;
    
    if (!userId) {
      throw new Error('ID do usuário não encontrado no evento');
    }
    
    // Tentar encontrar o usuário por ID (qualquer formato possível)
    const user = await findUserByAnyId(userId);
    
    if (!user) {
      throw new Error(`Usuário não encontrado com ID: ${userId}`);
    }
    
    // Determinar o plano com base no nome ou outros dados
    const planId = determinePlanFromV1Event(event);
    
    if (!planId) {
      throw new Error('Não foi possível determinar o plano da assinatura');
    }
    
    console.log(`Atualizando assinatura para o usuário ${user._id}, plano ${planId}`);
    
    // Atualizar ou criar a assinatura no banco de dados
    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        planId: planId,
        status: 'active',
        provider: 'hubla',
        externalId: event.transactionId,
        startDate: new Date(event.paidAt || event.createdAt || Date.now()),
        endDate: event.expiresAt ? new Date(event.expiresAt) : null,
        autoRenew: event.recurring === 'subscription',
        metadata: {
          raw: event
        },
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log(`Assinatura atualizada com sucesso para o usuário ${user._id}`);
    
    return { 
      status: 'success', 
      userId: user._id,
      planId: planId
    };
  } catch (error) {
    console.error('Erro ao processar evento de nova venda:', error);
    throw error;
  }
}

// Processar evento de cancelamento de assinatura (v1)
async function processCanceledSubscriptionEvent(event) {
  console.log('Processando evento de cancelamento de assinatura (v1):', event);
  
  try {
    // Extrair o ID do usuário do evento
    const userId = event.userId;
    
    if (!userId) {
      throw new Error('ID do usuário não encontrado no evento');
    }
    
    // Tentar encontrar o usuário por ID (qualquer formato possível)
    const user = await findUserByAnyId(userId);
    
    if (!user) {
      throw new Error(`Usuário não encontrado com ID: ${userId}`);
    }
    
    console.log(`Cancelando assinatura para o usuário ${user._id}`);
    
    // Atualizar a assinatura no banco de dados
    await Subscription.findOneAndUpdate(
      { userId: user._id },
      {
        status: 'canceled',
        endDate: new Date(),
        autoRenew: false,
        metadata: {
          canceledAt: new Date(),
          raw: event
        },
        updatedAt: new Date()
      }
    );
    
    console.log(`Assinatura cancelada com sucesso para o usuário ${user._id}`);
    
    return { 
      status: 'success', 
      userId: user._id
    };
  } catch (error) {
    console.error('Erro ao processar evento de cancelamento de assinatura:', error);
    throw error;
  }
}

// Funções auxiliares

// Encontrar usuário por qualquer formato de ID possível
async function findUserByAnyId(userId) {
  // Tentar encontrar o usuário com o ID exato
  let user = await User.findOne({ 
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : null },
      { id: userId },
      { firebaseId: userId }
    ]
  });
  
  if (user) {
    return user;
  }
  
  // Tentar encontrar por string de ID em vários campos
  user = await User.findOne({
    $or: [
      { '_id': userId }, 
      { 'id': userId },
      { 'firebaseId': userId },
      { 'authProviderIds.firebase': userId }
    ]
  });
  
  return user;
}

// Determinar o plano com base nos dados da assinatura (v2)
function determinePlanFromSubscription(subscription) {
  // Priorizar metadados de plano
  if (subscription.metadata?.planId) {
    return subscription.metadata.planId;
  }
  
  // Tentar identificar com base no nome ou código do produto
  const productName = subscription.product?.name?.toLowerCase() || '';
  const productCode = subscription.product?.code?.toLowerCase() || '';
  
  if (productName.includes('basic') || productCode.includes('basic')) {
    return 'basic';
  } else if (productName.includes('pro') || productCode.includes('pro')) {
    return 'pro';
  } else if (subscription.amount === 3) {
    // Identificar pelo valor (apenas se não houver outras fontes)
    return 'basic';
  } else if (subscription.amount === 30) {
    return 'pro';
  }
  
  // Padrão para basic
  console.warn('Não foi possível determinar o plano, usando "basic" como padrão');
  return 'basic';
}

// Determinar o plano com base nos dados do evento (v1)
function determinePlanFromV1Event(event) {
  // Tentar identificar com base no valor total
  if (event.totalAmount === 3) {
    return 'basic';
  } else if (event.totalAmount === 30) {
    return 'pro';
  }
  
  // Verificar se há informação de oferta
  const offer = event.offer?.toLowerCase() || '';
  
  if (offer.includes('basic')) {
    return 'basic';
  } else if (offer.includes('pro')) {
    return 'pro';
  }
  
  // Padrão para basic
  console.warn('Não foi possível determinar o plano, usando "basic" como padrão');
  return 'basic';
} 