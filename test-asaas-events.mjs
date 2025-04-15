// Script para testar eventos de webhook do Asaas
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para ler e parsear o arquivo .env
function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const env = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, value] = trimmedLine.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      }
    }

    return env;
  } catch (error) {
    console.error(`Erro ao ler o arquivo ${filePath}:`, error.message);
    return {};
  }
}

// Dados de teste
const TEST_CUSTOMER = {
  name: 'Cliente Teste Eventos',
  email: 'teste.eventos@exemplo.com.br',
  cpfCnpj: '59636876240', // CPF válido para testes
  mobilePhone: '11987654321'
};

// Função principal
async function testAsaasEvents() {
  // Caminho para o arquivo .env
  const envPath = path.resolve(__dirname, './backend/api/.env');
  console.log(`Buscando arquivo .env em: ${envPath}`);

  // Verificar se o arquivo existe
  if (!fs.existsSync(envPath)) {
    console.error('❌ Arquivo .env não encontrado no caminho especificado');
    return;
  }

  console.log('✅ Arquivo .env encontrado');
  
  // Ler as configurações
  const env = parseEnvFile(envPath);
  
  // Configurações do Asaas
  const apiKey = env.ASAAS_API_KEY;
  const environment = env.ASAAS_ENVIRONMENT || 'sandbox';
  
  // Verificar se a chave de API está configurada
  if (!apiKey) {
    console.error('❌ Erro: Chave de API do Asaas não configurada.');
    console.log('   Por favor, configure a variável ASAAS_API_KEY no arquivo .env');
    return;
  }
  
  // Verificar se está no ambiente sandbox
  if (environment !== 'sandbox') {
    console.error('❌ Erro: Este script deve ser executado no ambiente sandbox.');
    console.log('   Por favor, configure ASAAS_ENVIRONMENT=sandbox no arquivo .env');
    return;
  }
  
  // Determinar a URL base da API
  const apiBaseUrl = 'https://sandbox.asaas.com/api/v3';
  
  console.log('🔍 Iniciando teste de eventos do Asaas');
  console.log(`🔧 Ambiente: ${environment}`);
  console.log(`🔑 Chave de API: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`🔗 URL base da API: ${apiBaseUrl}`);
  
  try {
    // Etapa 1: Criar um cliente
    console.log('\n👤 Etapa 1: Criando cliente de teste...');
    let customerId;
    
    try {
      const customerResponse = await axios.post(
        `${apiBaseUrl}/customers`,
        TEST_CUSTOMER,
        { headers: { 'access_token': apiKey } }
      );
      
      customerId = customerResponse.data.id;
      console.log(`✅ Cliente criado com sucesso! ID: ${customerId}`);
    } catch (customerError) {
      // Verificar se o erro é porque o cliente já existe
      if (customerError.response?.data?.errors?.[0]?.code === 'invalid_cpfCnpj' && 
          customerError.response?.data?.errors?.[0]?.description?.includes('já utilizado')) {
        
        console.log('ℹ️ CPF já utilizado, buscando cliente existente...');
        
        // Buscar cliente pelo CPF
        const searchResponse = await axios.get(
          `${apiBaseUrl}/customers?cpfCnpj=${TEST_CUSTOMER.cpfCnpj}`,
          { headers: { 'access_token': apiKey } }
        );
        
        if (searchResponse.data.data && searchResponse.data.data.length > 0) {
          customerId = searchResponse.data.data[0].id;
          console.log(`✅ Cliente existente recuperado! ID: ${customerId}`);
        } else {
          throw new Error('Não foi possível encontrar o cliente existente.');
        }
      } else {
        // Outro erro
        throw customerError;
      }
    }
    
    // Etapa 2: Criar uma assinatura (SUBSCRIPTION_CREATED)
    if (customerId) {
      console.log('\n📝 Etapa 2: Criando assinatura de teste (SUBSCRIPTION_CREATED)...');
      
      // Data para vencimento (amanhã)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedDate = tomorrow.toISOString().split('T')[0];
      
      const subscriptionResponse = await axios.post(
        `${apiBaseUrl}/subscriptions`,
        {
          customer: customerId,
          billingType: 'PIX',
          value: 19.90,
          nextDueDate: formattedDate,
          cycle: 'MONTHLY',
          description: 'Plano Teste Eventos',
          maxPayments: 12,
          externalReference: 'eventos-123'
        },
        { headers: { 'access_token': apiKey } }
      );
      
      const subscriptionId = subscriptionResponse.data.id;
      console.log(`✅ Assinatura criada com sucesso! ID: ${subscriptionId}`);
      console.log(`👉 Evento SUBSCRIPTION_CREATED deve ter sido disparado`);
      
      // Etapa 3: Obter a primeira cobrança
      console.log('\n💲 Etapa 3: Obtendo a primeira cobrança...');
      const paymentsResponse = await axios.get(
        `${apiBaseUrl}/payments?subscription=${subscriptionId}`,
        { headers: { 'access_token': apiKey } }
      );
      
      if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
        const payment = paymentsResponse.data.data[0];
        console.log(`✅ Primeira cobrança obtida! ID: ${payment.id}`);
        console.log(`💵 Valor: R$${payment.value.toFixed(2)}`);
        const paymentId = payment.id;
        
        // Etapa 4: Testar PAYMENT_CONFIRMED (usando a API de sandbox)
        console.log('\n✅ Etapa 4: Simulando confirmação de pagamento (PAYMENT_CONFIRMED)...');
        try {
          await axios.post(
            `${apiBaseUrl}/payments/${paymentId}/confirmPayment`,
            {},  // corpo vazio
            { headers: { 'access_token': apiKey } }
          );
          console.log(`✅ Pagamento confirmado com sucesso!`);
          console.log(`👉 Evento PAYMENT_CONFIRMED deve ter sido disparado`);
        } catch (confirmError) {
          console.error('❌ Erro ao confirmar pagamento:', confirmError.message);
          if (confirmError.response?.data) {
            console.error('📄 Detalhes do erro:', JSON.stringify(confirmError.response.data, null, 2));
          }
        }
        
        // Etapa 5: Simular atraso de pagamento (apenas em sandbox)
        console.log('\n⏰ Etapa 5: Simulando atraso de pagamento (PAYMENT_OVERDUE)...');
        try {
          // Criar nova cobrança para testar
          const newPaymentResponse = await axios.post(
            `${apiBaseUrl}/payments`,
            {
              customer: customerId,
              billingType: 'PIX',
              value: 9.90,
              dueDate: formattedDate,
              description: 'Cobrança para teste de atraso',
              externalReference: 'atraso-123'
            },
            { headers: { 'access_token': apiKey } }
          );
          
          const overduePaymentId = newPaymentResponse.data.id;
          console.log(`✅ Cobrança para teste de atraso criada! ID: ${overduePaymentId}`);
          
          // Simular vencimento da cobrança (apenas em sandbox)
          await axios.post(
            `${apiBaseUrl}/payments/${overduePaymentId}/forceOverdue`,
            {},
            { headers: { 'access_token': apiKey } }
          );
          
          console.log(`✅ Pagamento marcado como atrasado com sucesso!`);
          console.log(`👉 Evento PAYMENT_OVERDUE deve ter sido disparado`);
        } catch (overdueError) {
          console.error('❌ Erro ao marcar pagamento como atrasado:', overdueError.message);
          if (overdueError.response?.data) {
            console.error('📄 Detalhes do erro:', JSON.stringify(overdueError.response.data, null, 2));
          }
        }
        
        // Etapa 6: Atualizar a assinatura (SUBSCRIPTION_UPDATED)
        console.log('\n🔄 Etapa 6: Atualizando assinatura (SUBSCRIPTION_UPDATED)...');
        try {
          await axios.put(
            `${apiBaseUrl}/subscriptions/${subscriptionId}`,
            {
              value: 29.90,
              description: 'Plano Teste Eventos Atualizado'
            },
            { headers: { 'access_token': apiKey } }
          );
          
          console.log(`✅ Assinatura atualizada com sucesso!`);
          console.log(`👉 Evento SUBSCRIPTION_UPDATED deve ter sido disparado`);
        } catch (updateError) {
          console.error('❌ Erro ao atualizar assinatura:', updateError.message);
          if (updateError.response?.data) {
            console.error('📄 Detalhes do erro:', JSON.stringify(updateError.response.data, null, 2));
          }
        }
        
        // Etapa 7: Estornar pagamento (PAYMENT_REFUNDED)
        console.log('\n↩️ Etapa 7: Estornando pagamento (PAYMENT_REFUNDED)...');
        try {
          await axios.post(
            `${apiBaseUrl}/payments/${paymentId}/refund`,
            {},
            { headers: { 'access_token': apiKey } }
          );
          
          console.log(`✅ Pagamento estornado com sucesso!`);
          console.log(`👉 Evento PAYMENT_REFUNDED deve ter sido disparado`);
        } catch (refundError) {
          console.error('❌ Erro ao estornar pagamento:', refundError.message);
          if (refundError.response?.data) {
            console.error('📄 Detalhes do erro:', JSON.stringify(refundError.response.data, null, 2));
          }
        }
        
        // Etapa 8: Cancelar a assinatura (SUBSCRIPTION_DELETED)
        console.log('\n🚫 Etapa 8: Cancelando assinatura (SUBSCRIPTION_DELETED)...');
        try {
          await axios.delete(
            `${apiBaseUrl}/subscriptions/${subscriptionId}`,
            { headers: { 'access_token': apiKey } }
          );
          
          console.log(`✅ Assinatura cancelada com sucesso!`);
          console.log(`👉 Evento SUBSCRIPTION_DELETED deve ter sido disparado`);
        } catch (deleteError) {
          console.error('❌ Erro ao cancelar assinatura:', deleteError.message);
          if (deleteError.response?.data) {
            console.error('📄 Detalhes do erro:', JSON.stringify(deleteError.response.data, null, 2));
          }
        }
      } else {
        console.log('❌ Nenhuma cobrança encontrada para a assinatura');
      }
    }
    
    console.log('\n🎉 Testes concluídos!');
    console.log('👉 Verifique os logs do seu servidor e/ou o banco de dados para confirmar se os webhooks foram recebidos e processados corretamente.');
    
  } catch (error) {
    console.error('❌ Erro durante o teste de eventos:');
    console.error(`📄 Mensagem: ${error.message}`);
    
    if (error.response) {
      console.error(`🔢 Status: ${error.response.status}`);
      console.error('📄 Dados da resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Executar o teste
testAsaasEvents(); 