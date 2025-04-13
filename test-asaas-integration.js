/**
 * Script para testar a integração com o Asaas
 * 
 * Este script verifica se a configuração do Asaas está funcionando corretamente,
 * testando a conexão com a API e as operações básicas de criação de cliente e assinatura.
 * 
 * Uso: node test-asaas-integration.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Configurar dotenv para carregar o arquivo .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, './backend/api/.env') });

// Configurações da API Asaas
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';
const API_KEY = process.env.ASAAS_API_KEY;

// Dados de teste
const TEST_CUSTOMER = {
  name: 'Cliente Teste',
  email: 'teste@exemplo.com.br',
  cpfCnpj: '12345678909', // CPF fictício para testes
  mobilePhone: '11987654321'
};

// Função principal
async function testAsaasIntegration() {
  console.log('🔍 Iniciando teste de integração com Asaas');
  console.log(`🔧 Ambiente: ${ASAAS_ENVIRONMENT}`);
  
  // Verificar se a chave de API está configurada
  if (!API_KEY) {
    console.error('❌ Erro: Chave de API do Asaas não configurada.');
    console.log('   Por favor, configure a variável ASAAS_API_KEY no arquivo .env');
    return;
  }
  
  console.log('✅ Chave de API configurada');
  console.log(`🔗 URL base da API: ${API_BASE_URL}`);
  
  try {
    // Teste 1: Verificar a conexão com a API
    console.log('\n📡 Teste 1: Verificando conexão com a API Asaas...');
    const connectionResponse = await axios.get(`${API_BASE_URL}/finance/balance`, {
      headers: { 'access_token': API_KEY }
    });
    
    console.log('✅ Conexão bem-sucedida!');
    console.log(`💰 Saldo atual: R$${connectionResponse.data.balance.toFixed(2)}`);
    
    // Teste 2: Criar um cliente de teste
    console.log('\n👤 Teste 2: Criando cliente de teste...');
    let customerId;
    
    try {
      const customerResponse = await axios.post(
        `${API_BASE_URL}/customers`,
        TEST_CUSTOMER,
        { headers: { 'access_token': API_KEY } }
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
          `${API_BASE_URL}/customers?cpfCnpj=${TEST_CUSTOMER.cpfCnpj}`,
          { headers: { 'access_token': API_KEY } }
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
    
    // Teste 3: Criar uma assinatura de teste
    if (customerId) {
      console.log('\n📝 Teste 3: Criando assinatura de teste...');
      
      // Data para vencimento (amanhã)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedDate = tomorrow.toISOString().split('T')[0];
      
      try {
        const subscriptionResponse = await axios.post(
          `${API_BASE_URL}/subscriptions`,
          {
            customer: customerId,
            billingType: 'PIX',
            value: 19.90,
            nextDueDate: formattedDate,
            cycle: 'MONTHLY',
            description: 'Plano Teste RunCash',
            maxPayments: 2, // Apenas 2 pagamentos para teste
            externalReference: 'teste-123'
          },
          { headers: { 'access_token': API_KEY } }
        );
        
        const subscriptionId = subscriptionResponse.data.id;
        console.log(`✅ Assinatura criada com sucesso! ID: ${subscriptionId}`);
        
        // Obter primeira cobrança para verificar o link de pagamento
        const paymentsResponse = await axios.get(
          `${API_BASE_URL}/payments?subscription=${subscriptionId}`,
          { headers: { 'access_token': API_KEY } }
        );
        
        if (paymentsResponse.data.data && paymentsResponse.data.data.length > 0) {
          const payment = paymentsResponse.data.data[0];
          console.log(`✅ Primeira cobrança gerada! ID: ${payment.id}`);
          console.log(`💵 Valor: R$${payment.value.toFixed(2)}`);
          console.log(`🔗 Link para pagamento: ${payment.invoiceUrl}`);
        }
        
        // Cancelar a assinatura de teste para não deixar lixo no sistema
        console.log('\n🧹 Limpando: Cancelando assinatura de teste...');
        await axios.delete(
          `${API_BASE_URL}/subscriptions/${subscriptionId}`,
          { headers: { 'access_token': API_KEY } }
        );
        console.log('✅ Assinatura cancelada com sucesso!');
      } catch (subscriptionError) {
        console.error('❌ Erro ao criar/gerenciar assinatura:', subscriptionError.message);
        if (subscriptionError.response?.data) {
          console.error('📄 Detalhes do erro:', JSON.stringify(subscriptionError.response.data, null, 2));
        }
      }
    }
    
    console.log('\n🎉 Testes concluídos!');
    console.log('✅ A integração com o Asaas está funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro durante o teste de integração:');
    console.error(`📄 Mensagem: ${error.message}`);
    
    if (error.response) {
      console.error(`🔢 Status: ${error.response.status}`);
      console.error('📄 Dados da resposta:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\n🔧 Sugestões para solução:');
    console.log('1. Verifique se a chave de API está correta');
    console.log('2. Confirme se o ambiente está configurado corretamente (sandbox/production)');
    console.log('3. Certifique-se de que sua conta no Asaas está ativa');
  }
}

// Executar o teste
testAsaasIntegration(); 