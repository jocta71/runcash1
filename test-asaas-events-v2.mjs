// Script para testar eventos de webhook do Asaas (versão atualizada)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Função para ler e analisar o arquivo .env
 * @param {string} filePath - Caminho para o arquivo .env
 * @returns {Object} - Objeto com as variáveis de ambiente
 */
function parseEnvFile(filePath) {
  try {
    // Verifica se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Arquivo .env não encontrado em: ${filePath}`);
      return null;
    }

    console.log(`✅ Arquivo .env encontrado`);
    
    // Lê o arquivo
    const envContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse do conteúdo
    const envVars = {};
    envContent.split('\n').forEach(line => {
      // Ignora linhas vazias ou comentários
      if (!line || line.startsWith('#')) return;
      
      // Divide a linha em chave e valor
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim();
        // Remove aspas se existirem
        envVars[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    });
    
    return envVars;
  } catch (error) {
    console.error(`❌ Erro ao ler arquivo .env: ${error.message}`);
    return null;
  }
}

// Dados do cliente de teste
const TEST_CUSTOMER = {
  name: 'Cliente Teste Webhook',
  email: 'teste@webhook.com',
  mobilePhone: '11987654321',
  cpfCnpj: '24971563792',
  postalCode: '01310-000',
  address: 'Av. Paulista',
  addressNumber: '150',
  complement: 'Sala 10',
  province: 'Centro',
};

/**
 * Função principal para testar os eventos do Asaas
 */
async function testAsaasEvents() {
  console.log('🔍 Iniciando teste de eventos do Asaas');
  
  // Caminho para o arquivo .env
  const envPath = path.resolve(process.cwd(), 'backend', 'api', '.env');
  console.log(`Buscando arquivo .env em: ${envPath}`);
  
  // Lê as variáveis de ambiente
  const envVars = parseEnvFile(envPath);
  if (!envVars) {
    console.error('❌ Não foi possível ler as variáveis de ambiente. Verifique o arquivo .env');
    return;
  }
  
  // Obtém as chaves necessárias
  const apiKey = envVars.ASAAS_API_KEY;
  const environment = envVars.ASAAS_ENVIRONMENT || 'sandbox';
  
  if (!apiKey) {
    console.error('❌ Chave de API do Asaas não encontrada no arquivo .env');
    return;
  }
  
  // Configura a URL base da API com base no ambiente
  const baseURL = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
  
  // Exibe informações sobre a configuração
  console.log(`🔧 Ambiente: ${environment}`);
  console.log(`🔑 Chave de API: $${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`🔗 URL base da API: ${baseURL}`);
  console.log();
  
  // Configura o cliente HTTP
  const api = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey
    }
  });
  
  // Variáveis para armazenar IDs criados durante o teste
  let customerId = null;
  let subscriptionId = null;
  let paymentId = null;
  
  try {
    // Etapa 1: Criar cliente de teste
    console.log('👤 Etapa 1: Criando cliente de teste...');
    try {
      const customerResponse = await api.post('/customers', TEST_CUSTOMER);
      customerId = customerResponse.data.id;
      console.log(`✅ Cliente criado com sucesso! ID: ${customerId}`);
    } catch (error) {
      // Verifica se o erro é porque o cliente já existe
      if (error.response?.data?.errors?.[0]?.code === 'invalid_cpfCnpj' &&
          error.response?.data?.errors?.[0]?.description?.includes('já utilizado')) {
        // Busca o cliente pelo CPF/CNPJ
        const searchResponse = await api.get('/customers', {
          params: { cpfCnpj: TEST_CUSTOMER.cpfCnpj }
        });
        
        if (searchResponse.data.data.length > 0) {
          customerId = searchResponse.data.data[0].id;
          console.log(`✅ Cliente já existente encontrado! ID: ${customerId}`);
        } else {
          throw new Error('Cliente já existe, mas não foi possível encontrá-lo');
        }
      } else {
        throw error;
      }
    }
    console.log();
    
    // Etapa 2: Criar assinatura de teste
    console.log('📝 Etapa 2: Criando assinatura de teste (SUBSCRIPTION_CREATED)...');
    const subscriptionData = {
      customer: customerId,
      billingType: 'BOLETO',
      value: 19.90,
      nextDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 dias a partir de hoje
      description: 'Assinatura de teste para webhooks',
      cycle: 'MONTHLY'
    };
    
    const subscriptionResponse = await api.post('/subscriptions', subscriptionData);
    subscriptionId = subscriptionResponse.data.id;
    console.log(`✅ Assinatura criada com sucesso! ID: ${subscriptionId}`);
    console.log(`👉 Evento SUBSCRIPTION_CREATED deve ter sido disparado`);
    console.log();
    
    // Etapa 3: Obter a primeira cobrança gerada pela assinatura
    console.log('💲 Etapa 3: Obtendo a primeira cobrança...');
    const paymentsResponse = await api.get('/payments', {
      params: { subscription: subscriptionId }
    });
    
    if (paymentsResponse.data.data.length > 0) {
      paymentId = paymentsResponse.data.data[0].id;
      console.log(`✅ Primeira cobrança obtida! ID: ${paymentId}`);
      console.log(`💵 Valor: R$${paymentsResponse.data.data[0].value.toFixed(2)}`);
      console.log();
    } else {
      console.log('❌ Nenhuma cobrança encontrada para essa assinatura');
      console.log();
    }
    
    // Etapa 4: Simular recebimento de pagamento
    if (paymentId) {
      console.log('✅ Etapa 4: Simulando recebimento de pagamento (PAYMENT_RECEIVED)...');
      try {
        // Usando endpoint correto para confirmar pagamento no sandbox
        await api.post(`/sandbox/payment/${paymentId}/confirm`, {});
        console.log('✅ Pagamento confirmado com sucesso!');
        console.log('👉 Evento PAYMENT_RECEIVED deve ter sido disparado');
      } catch (error) {
        console.log(`❌ Erro ao confirmar pagamento: ${error.message}`);
        if (error.response?.data) {
          console.log(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
      console.log();
    }
    
    // Etapa 5: Criar uma cobrança com vencimento para amanhã e depois marcá-la como vencida
    console.log('⏰ Etapa 5: Criando cobrança com vencimento futuro para depois simular atraso (PAYMENT_OVERDUE)...');
    try {
      // Criar cobrança com vencimento para amanhã
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const overduePaymentData = {
        customer: customerId,
        billingType: 'BOLETO',
        value: 29.90,
        dueDate: tomorrow.toISOString().split('T')[0],
        description: 'Cobrança para teste de atraso'
      };
      
      const overduePaymentResponse = await api.post('/payments', overduePaymentData);
      const overduePaymentId = overduePaymentResponse.data.id;
      console.log(`✅ Cobrança criada com sucesso! ID: ${overduePaymentId}`);
      
      // No ambiente sandbox, podemos forçar o status para OVERDUE
      try {
        // Uma alternativa para simular pagamento atrasado é alterar a data de vencimento para o passado
        // já que o endpoint de simulação de status pode não estar disponível
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 10); // 10 dias no passado para garantir
        const pastDateStr = pastDate.toISOString().split('T')[0];
        
        console.log(`⏱️ Alterando data de vencimento para ${pastDateStr} (passado)...`);
        await api.post(`/payments/${overduePaymentId}`, {
          dueDate: pastDateStr
        });
        
        // Aguardamos alguns segundos para processar a alteração
        console.log('⏱️ Aguardando 3 segundos para processamento...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verificamos se o status mudou para OVERDUE
        const paymentInfo = await api.get(`/payments/${overduePaymentId}`);
        console.log(`🔍 Status atual do pagamento: ${paymentInfo.data.status}`);
        
        if (paymentInfo.data.status === 'OVERDUE') {
          console.log('✅ Cobrança marcada como atrasada com sucesso!');
          console.log('👉 Evento PAYMENT_OVERDUE deve ter sido disparado');
        } else {
          console.log('⚠️ Cobrança não foi marcada como atrasada automaticamente');
          console.log('👉 No ambiente de produção, isto aconteceria naturalmente após a data de vencimento');
        }
      } catch (error) {
        console.log(`❌ Erro ao simular atraso: ${error.message}`);
        if (error.response?.data) {
          console.log(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    } catch (error) {
      console.log(`❌ Erro ao criar cobrança para teste de atraso: ${error.message}`);
      if (error.response?.data) {
        console.log(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    
    // Etapa 6: Atualizar assinatura
    console.log('🔄 Etapa 6: Atualizando assinatura (SUBSCRIPTION_UPDATED)...');
    try {
      const updateData = {
        value: 24.90,
        description: 'Assinatura de teste atualizada para webhooks'
      };
      
      await api.post(`/subscriptions/${subscriptionId}`, updateData);
      console.log('✅ Assinatura atualizada com sucesso!');
      console.log('👉 Evento SUBSCRIPTION_UPDATED deve ter sido disparado');
    } catch (error) {
      console.log(`❌ Erro ao atualizar assinatura: ${error.message}`);
      if (error.response?.data) {
        console.log(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    console.log();
    
    // Etapa 7: Tentar estornar um pagamento (se estiver confirmado ou recebido)
    console.log('↩️ Etapa 7: Estornando pagamento (PAYMENT_REFUNDED)...');
    try {
      // Cria uma nova cobrança, confirma o pagamento e então estorna
      const refundPaymentData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',  // Mais fácil de confirmar
        value: 15.90,
        dueDate: new Date().toISOString().split('T')[0],
        description: 'Cobrança para teste de estorno',
        creditCard: {
          holderName: 'Teste Estorno',
          number: '5162306219378829',
          expiryMonth: '05',
          expiryYear: '2030',
          ccv: '318'
        },
        creditCardHolderInfo: {
          name: 'Teste Estorno',
          email: 'teste@estorno.com',
          cpfCnpj: '24971563792',
          postalCode: '89223-005',
          addressNumber: '277',
          phone: '4738010919'
        }
      };
      
      const newPaymentResponse = await api.post('/payments', refundPaymentData);
      const newPaymentId = newPaymentResponse.data.id;
      console.log(`✅ Nova cobrança criada para estorno! ID: ${newPaymentId}`);
      
      // Verificar o status atual do pagamento antes de tentar confirmar
      const paymentStatus = newPaymentResponse.data.status;
      
      // Só confirmamos se o status não for CONFIRMED ou RECEIVED
      if (paymentStatus !== 'CONFIRMED' && paymentStatus !== 'RECEIVED') {
        // Confirmando o pagamento no sandbox
        await api.post(`/sandbox/payment/${newPaymentId}/confirm`, {});
        console.log('✅ Pagamento confirmado com sucesso!');
      } else {
        console.log('✅ Pagamento já está confirmado (status: ' + paymentStatus + ')');
      }
      
      // Estornando o pagamento
      try {
        // Aguardar mais tempo para garantir que a confirmação foi processada
        console.log('⏱️ Aguardando 5 segundos antes de tentar o estorno...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Verificar se o pagamento está em um estado que permite estorno
        // (RECEIVED ou CONFIRMED)
        const checkPaymentResponse = await api.get(`/payments/${newPaymentId}`);
        const currentStatus = checkPaymentResponse.data.status;
        
        if (currentStatus !== 'RECEIVED' && currentStatus !== 'CONFIRMED') {
          // Se não estiver em um estado que permite estorno, simular o status RECEIVED
          await api.post(`/sandbox/payments/${newPaymentId}/situationSimulate`, {
            status: 'RECEIVED'
          });
          console.log('✅ Status do pagamento alterado para RECEIVED');
          
          // Aguardar mais um pouco após a mudança de status
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Agora tentamos o estorno
        const refundResponse = await api.post(`/payments/${newPaymentId}/refund`, {
          value: refundPaymentData.value // Valor a ser estornado
        });
        console.log('✅ Pagamento estornado com sucesso!');
        console.log('👉 Evento PAYMENT_REFUNDED deve ter sido disparado');
        console.log(refundResponse.data);
      } catch (error) {
        console.log(`❌ Erro ao estornar pagamento: ${error.message}`);
        if (error.response?.data) {
          console.log(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    } catch (error) {
      console.log(`❌ Erro ao estornar pagamento: ${error.message}`);
      if (error.response?.data) {
        console.log(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    console.log();
    
    // Etapa 8: Cancelar assinatura
    console.log('🚫 Etapa 8: Cancelando assinatura (SUBSCRIPTION_DELETED)...');
    try {
      await api.delete(`/subscriptions/${subscriptionId}`);
      console.log('✅ Assinatura cancelada com sucesso!');
      console.log('👉 Evento SUBSCRIPTION_DELETED deve ter sido disparado');
    } catch (error) {
      console.log(`❌ Erro ao cancelar assinatura: ${error.message}`);
      if (error.response?.data) {
        console.log(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    
    console.log();
    console.log('🎉 Testes concluídos!');
    console.log('👉 Verifique os logs do seu servidor e/ou o banco de dados para confirmar se os webhooks foram recebidos e processados corretamente.');
    
  } catch (error) {
    console.error(`❌ Erro não tratado: ${error.message}`);
    if (error.response?.data) {
      console.error(`📄 Detalhes do erro: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Executa a função principal
testAsaasEvents(); 