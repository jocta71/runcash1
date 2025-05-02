/**
 * Sistema de buffer para webhooks
 * Armazena webhooks recebidos até que possam ser processados
 * quando o MongoDB estiver disponível
 * 
 * Este sistema garante que pagamentos recebidos liberem acesso
 * ao serviço de roletas mesmo se o MongoDB estiver temporariamente
 * indisponível no momento do webhook.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoInitializer = require('./mongoInitializer');
const mongoose = require('mongoose');

// Configurações
const DATA_DIR = path.join(__dirname, '..', 'data');
const BUFFER_FILE = path.join(DATA_DIR, 'webhook_buffer.json');
const PROCESSED_FILE = path.join(DATA_DIR, 'processed_webhooks.json');
const MAX_BUFFER_SIZE = 1000;
const MAX_RETRY_COUNT = 5;
const MAX_AGE_HOURS = 48; // 48 horas

// Estado interno
let webhookBuffer = [];
let processedIds = new Set();
let isProcessing = false;

// Verificar se o diretório de dados existe, senão criar
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[WebhookBuffer] Diretório de dados criado: ${DATA_DIR}`);
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao criar diretório de dados: ${error.message}`);
  }
}

/**
 * Carrega o buffer de webhooks do disco
 */
function loadBuffer() {
  try {
    if (fs.existsSync(BUFFER_FILE)) {
      const data = fs.readFileSync(BUFFER_FILE, 'utf8');
      webhookBuffer = JSON.parse(data);
      console.log(`[WebhookBuffer] Buffer carregado com ${webhookBuffer.length} webhooks pendentes`);
    }
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao carregar buffer: ${error.message}`);
    webhookBuffer = [];
  }
}

/**
 * Salva o buffer de webhooks no disco
 */
function saveBuffer() {
  try {
    // Limitar o tamanho do buffer
    if (webhookBuffer.length > MAX_BUFFER_SIZE) {
      console.warn(`[WebhookBuffer] Buffer excedeu o tamanho máximo, removendo webhooks mais antigos`);
      webhookBuffer = webhookBuffer.slice(-MAX_BUFFER_SIZE);
    }
    
    // Remover webhooks antigos (mais de MAX_AGE_HOURS)
    const now = new Date();
    webhookBuffer = webhookBuffer.filter(webhook => {
      const webhookDate = new Date(webhook.receivedAt);
      const ageHours = (now - webhookDate) / (1000 * 60 * 60);
      return ageHours <= MAX_AGE_HOURS;
    });
    
    fs.writeFileSync(BUFFER_FILE, JSON.stringify(webhookBuffer, null, 2));
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao salvar buffer: ${error.message}`);
  }
}

/**
 * Carrega os IDs de webhooks processados
 */
function loadProcessedIds() {
  try {
    if (fs.existsSync(PROCESSED_FILE)) {
      const data = fs.readFileSync(PROCESSED_FILE, 'utf8');
      processedIds = new Set(JSON.parse(data));
      console.log(`[WebhookBuffer] ${processedIds.size} IDs de webhooks processados carregados`);
    }
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao carregar IDs processados: ${error.message}`);
    processedIds = new Set();
  }
}

/**
 * Salva os IDs de webhooks processados
 */
function saveProcessedIds() {
  try {
    // Limitar o tamanho da lista de processados (máximo 10000)
    if (processedIds.size > 10000) {
      console.warn(`[WebhookBuffer] Lista de IDs processados muito grande, removendo os mais antigos`);
      processedIds = new Set(Array.from(processedIds).slice(-10000));
    }
    
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify(Array.from(processedIds), null, 2));
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao salvar IDs processados: ${error.message}`);
  }
}

/**
 * Gera um ID único para um webhook baseado em seu conteúdo
 * @param {Object} data Dados do webhook
 * @returns {string} ID único para o webhook
 */
function generateWebhookId(data) {
  try {
    // Tratamento mais robusto para diferentes tipos de dados
    let stringData;
    
    if (data === null || data === undefined) {
      // Se for null ou undefined, usar string fixa com timestamp
      stringData = `null_or_undefined_${Date.now()}`;
    } else if (typeof data === 'string') {
      // Se já for string, usar diretamente
      stringData = data;
    } else if (Number.isNaN(data)) {
      // Tratamento específico para NaN
      stringData = `NaN_${Date.now()}`;
    } else {
      // Para objetos, arrays ou outros tipos, tentar JSON.stringify
      try {
        stringData = JSON.stringify(data);
      } catch (jsonError) {
        // Se falhar na conversão para JSON, usar o tipo + timestamp
        stringData = `${typeof data}_${Date.now()}`;
      }
    }
    
    // Criar um hash do conteúdo + timestamp para ser o ID
    return crypto
      .createHash('sha256')
      .update(stringData + Date.now())
      .digest('hex');
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao gerar ID para webhook: ${error.message}`);
    // Fallback para caso ocorra algum erro - gerar um ID baseado apenas no timestamp
    return crypto
      .createHash('sha256')
      .update(`fallback_${Date.now()}`)
      .digest('hex');
  }
}

/**
 * Verifica se o MongoDB está pronto para processar webhooks
 * @returns {boolean} Verdadeiro se o MongoDB estiver pronto
 */
function isMongoDbReady() {
  try {
    // IMPORTANTE: Verificar detalhadamente o estado do MongoDB
    const readyState = mongoose.connection.readyState;
    const isInitializerReady = mongoInitializer.isReady();
    
    // Verificar modelos específicos necessários para processamento
    const essentialModels = ['User', 'Subscription', 'Payment', 'WebhookEvent'];
    const availableModels = mongoose.modelNames();
    const missingModels = essentialModels.filter(m => !availableModels.includes(m));
    
    // Logar informações detalhadas
    console.log(`[WebhookBuffer] Verificação do MongoDB - readyState: ${readyState}, mongoInitializer.isReady(): ${isInitializerReady}`);
    console.log(`[WebhookBuffer] Modelos disponíveis: ${availableModels.join(', ')}`);
    
    if (missingModels.length > 0) {
      console.log(`[WebhookBuffer] Modelos essenciais ausentes: ${missingModels.join(', ')}`);
    }
    
    // Considerar pronto se:
    // 1. A conexão está ativa (readyState === 1)
    // 2. E pelo menos um modelo essencial está registrado
    
    const esModelReady = availableModels.some(m => essentialModels.includes(m));
    const isReady = readyState === 1 && esModelReady;
    
    console.log(`[WebhookBuffer] MongoDB está pronto: ${isReady ? 'SIM' : 'NÃO'}`);
    return isReady;
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao verificar estado do MongoDB: ${error.message}`);
    return false;
  }
}

/**
 * Adiciona um webhook ao buffer para processamento posterior
 * @param {string} source Origem do webhook (asaas, stripe, etc)
 * @param {Object} data Dados do webhook
 * @param {Object} metadata Metadados adicionais (pode incluir token, usuario, etc)
 * @returns {Object} Resultado da operação
 */
function addToBuffer(source, data, metadata = {}) {
  try {
    // Validação básica dos dados de entrada
    if (!source) {
      console.warn(`[WebhookBuffer] Tentativa de adicionar webhook sem especificar a fonte`);
      return { 
        added: false, 
        reason: 'invalid_source',
        message: 'A fonte do webhook é obrigatória'
      };
    }
    
    // Verificar se os dados do webhook são válidos (não null, não undefined)
    if (data === null || data === undefined) {
      console.warn(`[WebhookBuffer] Tentativa de adicionar webhook com dados nulos ou indefinidos`);
      return { 
        added: false, 
        reason: 'invalid_data',
        message: 'Os dados do webhook são obrigatórios'
      };
    }
    
    // Logar informações sobre o tipo de dados
    console.log(`[WebhookBuffer] Adicionando webhook da fonte '${source}', tipo de dados: ${typeof data}`);
    
    // Gerar ID único para este webhook
    const webhookId = generateWebhookId(data);
    
    // Verificar se este webhook já foi processado
    if (processedIds.has(webhookId)) {
      console.log(`[WebhookBuffer] Webhook já processado, ignorando: ${webhookId}`);
      return { 
        added: false, 
        reason: 'duplicate',
        message: 'Webhook já processado anteriormente'
      };
    }
    
    // Verificar se este webhook já está no buffer
    const isDuplicate = webhookBuffer.some(item => item.id === webhookId);
    if (isDuplicate) {
      console.log(`[WebhookBuffer] Webhook duplicado no buffer, ignorando: ${webhookId}`);
      return { 
        added: false, 
        reason: 'duplicate',
        message: 'Webhook já está no buffer aguardando processamento'
      };
    }
    
    // Adicionar ao buffer
    webhookBuffer.push({
      id: webhookId,
      source,
      data,
      metadata,
      receivedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending'
    });
    
    // Salvar buffer no disco
    saveBuffer();
    
    console.log(`[WebhookBuffer] Webhook ${webhookId} (${source}) adicionado ao buffer para processamento posterior`);
    
    // Tentar processar o buffer imediatamente se o MongoDB estiver pronto
    if (isMongoDbReady()) {
      console.log(`[WebhookBuffer] MongoDB está pronto, tentando processar buffer imediatamente`);
      setTimeout(() => processBuffer(), 500); // Pequeno delay para garantir que a resposta HTTP já foi enviada
    } else {
      console.log(`[WebhookBuffer] MongoDB não está pronto, verificando novamente mais tarde`);
    }
    
    return { 
      added: true, 
      id: webhookId,
      message: 'Webhook adicionado ao buffer para processamento posterior'
    };
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao adicionar webhook ao buffer: ${error.message}`);
    console.error(`[WebhookBuffer] Detalhes do erro:`, error);
    console.error(`[WebhookBuffer] Tipo de dados: ${typeof data}, Fonte: ${source}`);
    
    return { 
      added: false, 
      reason: 'error',
      message: `Erro ao adicionar webhook ao buffer: ${error.message}`
    };
  }
}

/**
 * Marca um webhook como processado
 * @param {string} webhookId ID do webhook
 */
function markAsProcessed(webhookId) {
  try {
    // Adicionar à lista de processados
    processedIds.add(webhookId);
    
    // Atualizar status no buffer
    webhookBuffer = webhookBuffer.filter(webhook => webhook.id !== webhookId);
    
    // Salvar alterações
    saveProcessedIds();
    saveBuffer();
    
    console.log(`[WebhookBuffer] Webhook marcado como processado: ${webhookId}`);
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao marcar webhook como processado: ${error.message}`);
  }
}

/**
 * Marca um webhook como falha (incrementa contagem de tentativas)
 * @param {string} webhookId ID do webhook
 * @param {string} errorMessage Mensagem de erro
 */
function markAsFailed(webhookId, errorMessage) {
  try {
    // Encontrar o webhook no buffer
    const webhookIndex = webhookBuffer.findIndex(webhook => webhook.id === webhookId);
    if (webhookIndex === -1) {
      console.warn(`[WebhookBuffer] Webhook não encontrado no buffer: ${webhookId}`);
      return;
    }
    
    // Incrementar contagem de tentativas
    webhookBuffer[webhookIndex].retryCount++;
    webhookBuffer[webhookIndex].lastError = errorMessage;
    webhookBuffer[webhookIndex].lastAttempt = new Date().toISOString();
    
    // Verificar se excedeu o número máximo de tentativas
    if (webhookBuffer[webhookIndex].retryCount >= MAX_RETRY_COUNT) {
      console.error(`[WebhookBuffer] Webhook excedeu número máximo de tentativas, removendo: ${webhookId}`);
      webhookBuffer[webhookIndex].status = 'failed';
      
      // Opcional: mover para uma lista de falhas permanentes
      // failedWebhooks.push(webhookBuffer[webhookIndex]);
    }
    
    // Salvar buffer
    saveBuffer();
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao marcar webhook como falha: ${error.message}`);
  }
}

/**
 * Processa o buffer de webhooks
 * @returns {Promise<Object>} Resultado do processamento
 */
async function processBuffer() {
  // Evitar processamento simultâneo
  if (isProcessing) {
    console.log(`[WebhookBuffer] Processamento já em andamento, ignorando solicitação`);
    return { processed: false, reason: 'already_processing' };
  }
  
  // Verificar se o MongoDB está pronto
  if (!isMongoDbReady()) {
    console.log(`[WebhookBuffer] MongoDB não está pronto, verificando novamente mais tarde`);
    return { processed: false, reason: 'mongodb_not_ready' };
  }
  
  try {
    isProcessing = true;
    console.log(`[WebhookBuffer] Iniciando processamento de ${webhookBuffer.length} webhooks pendentes`);
    
    // Filtrar webhooks pendentes
    const pendingWebhooks = webhookBuffer.filter(webhook => 
      webhook.status !== 'failed' && webhook.retryCount < MAX_RETRY_COUNT
    );
    
    if (pendingWebhooks.length === 0) {
      console.log(`[WebhookBuffer] Nenhum webhook pendente para processar`);
      isProcessing = false;
      return { processed: true, count: 0 };
    }
    
    let processed = 0;
    let failed = 0;
    
    // Processar cada webhook
    for (const webhook of pendingWebhooks) {
      try {
        console.log(`[WebhookBuffer] Processando webhook ${webhook.id} (fonte: ${webhook.source})`);
        
        // Verificar se ainda está no estado conectado
        if (!isMongoDbReady()) {
          console.warn(`[WebhookBuffer] MongoDB perdeu conexão durante processamento, pausando`);
          break;
        }
        
        // Processar webhook com base na fonte
        switch (webhook.source) {
          case 'asaas':
            await processAsaasWebhook(webhook);
            break;
          // Adicionar outras fontes conforme necessário
          default:
            throw new Error(`Fonte de webhook desconhecida: ${webhook.source}`);
        }
        
        // Marcar como processado
        markAsProcessed(webhook.id);
        processed++;
      } catch (error) {
        console.error(`[WebhookBuffer] Erro ao processar webhook ${webhook.id}: ${error.message}`);
        markAsFailed(webhook.id, error.message);
        failed++;
      }
    }
    
    console.log(`[WebhookBuffer] Processamento concluído: ${processed} processados, ${failed} falhas`);
    return { processed: true, count: processed, failed };
  } catch (error) {
    console.error(`[WebhookBuffer] Erro geral no processamento do buffer: ${error.message}`);
    return { processed: false, reason: 'error', message: error.message };
  } finally {
    isProcessing = false;
  }
}

/**
 * Processa um webhook do Asaas
 * @param {Object} webhook Dados do webhook
 */
async function processAsaasWebhook(webhook) {
  try {
    // Verificar modelos necessários
    const WebhookEvent = mongoose.model('WebhookEvent');
    const Payment = mongoose.model('Payment');
    const Subscription = mongoose.model('Subscription');
    const User = mongoose.model('User');
    
    // Registrar evento do webhook
    const event = new WebhookEvent({
      source: 'asaas',
      event: webhook.data.event || 'unknown',
      data: webhook.data,
      processedAt: new Date(),
      metadata: webhook.metadata
    });
    
    await event.save();
    console.log(`[WebhookBuffer] Evento registrado no banco: ${event._id}`);
    
    // Processar com base no tipo de evento
    const eventType = webhook.data.event;
    
    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
      // Processar pagamento recebido
      const paymentId = webhook.data.payment?.id;
      if (!paymentId) {
        throw new Error('ID do pagamento não encontrado no webhook');
      }
      
      // Verificar se já existe um pagamento com este ID
      const existingPayment = await Payment.findOne({ asaasId: paymentId });
      if (existingPayment) {
        console.log(`[WebhookBuffer] Pagamento já registrado: ${paymentId}`);
        return;
      }
      
      // Encontrar assinatura relacionada a este pagamento
      const subscription = await Subscription.findOne({ 
        'asaas.paymentId': paymentId
      });
      
      if (!subscription) {
        throw new Error(`Assinatura não encontrada para o pagamento: ${paymentId}`);
      }
      
      // Registrar pagamento
      const payment = new Payment({
        user: subscription.user,
        subscription: subscription._id,
        asaasId: paymentId,
        value: webhook.data.payment.value || 0,
        netValue: webhook.data.payment.netValue || 0,
        status: 'confirmed',
        paymentDate: new Date(webhook.data.payment.paymentDate || Date.now()),
        confirmedDate: new Date(),
        billingType: webhook.data.payment.billingType || 'UNDEFINED',
        invoiceUrl: webhook.data.payment.invoiceUrl,
        metadata: {
          raw: webhook.data
        }
      });
      
      await payment.save();
      console.log(`[WebhookBuffer] Pagamento registrado: ${payment._id}`);
      
      // Atualizar assinatura como ativa
      await Subscription.updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            status: 'active',
            lastPaymentDate: new Date(),
            lastPayment: payment._id
          },
          $push: { payments: payment._id }
        }
      );
      
      // Atualizar usuário com acesso
      await User.updateOne(
        { _id: subscription.user },
        { 
          $set: { 
            hasActiveSubscription: true,
            subscriptionStatus: 'active',
            lastPaymentDate: new Date()
          }
        }
      );
      
      console.log(`[WebhookBuffer] Usuário ${subscription.user} atualizado com assinatura ativa`);
    } else {
      console.log(`[WebhookBuffer] Evento não processado: ${eventType}`);
    }
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao processar webhook Asaas: ${error.message}`);
    throw error; // Propagar erro para ser tratado pelo caller
  }
}

/**
 * Inicia o processador periódico de webhooks
 * @param {number} intervalMinutes Intervalo em minutos entre verificações
 */
function startPeriodicProcessor(intervalMinutes = 5) {
  // Carregar dados existentes
  loadBuffer();
  loadProcessedIds();
  
  // Processar imediatamente se houver webhooks pendentes
  if (webhookBuffer.length > 0) {
    setTimeout(() => {
      console.log(`[WebhookBuffer] Verificando buffer inicial de ${webhookBuffer.length} webhooks`);
      processBuffer().catch(error => {
        console.error(`[WebhookBuffer] Erro no processamento inicial: ${error.message}`);
      });
    }, 10000); // Aguardar 10 segundos para o servidor terminar de inicializar
  }
  
  // Configurar verificação periódica
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(() => {
    if (webhookBuffer.length > 0) {
      console.log(`[WebhookBuffer] Verificação periódica: ${webhookBuffer.length} webhooks no buffer`);
      processBuffer().catch(error => {
        console.error(`[WebhookBuffer] Erro no processamento periódico: ${error.message}`);
      });
    }
  }, intervalMs);
  
  console.log(`[WebhookBuffer] Processador periódico iniciado (intervalo: ${intervalMinutes} minutos)`);
}

/**
 * Obtém estatísticas do buffer
 * @returns {Object} Estatísticas do buffer
 */
function getStats() {
  try {
    const totalBuffered = webhookBuffer.length;
    const totalProcessed = processedIds.size;
    
    // Classificar por status
    const pending = webhookBuffer.filter(webhook => webhook.status !== 'failed' && webhook.retryCount < MAX_RETRY_COUNT).length;
    const failed = webhookBuffer.filter(webhook => webhook.status === 'failed' || webhook.retryCount >= MAX_RETRY_COUNT).length;
    
    // Classificar por fonte
    const bySource = {};
    webhookBuffer.forEach(webhook => {
      bySource[webhook.source] = (bySource[webhook.source] || 0) + 1;
    });
    
    return {
      totalBuffered,
      totalProcessed,
      pending,
      failed,
      isProcessing,
      bySource,
      mongoReady: isMongoDbReady(),
      mongoStatus: mongoose.connection.readyState
    };
  } catch (error) {
    console.error(`[WebhookBuffer] Erro ao obter estatísticas: ${error.message}`);
    return { error: error.message };
  }
}

// Carregar dados ao inicializar o módulo
loadBuffer();
loadProcessedIds();

// Exportar funções
module.exports = {
  addToBuffer,
  processBuffer,
  markAsProcessed,
  getStats,
  startPeriodicProcessor,
  isMongoDbReady
}; 