const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente do arquivo .env
dotenv.config({ path: path.resolve(__dirname, './backend/api/.env') });

// Configurações da API Asaas
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';
const API_KEY = process.env.ASAAS_API_KEY;

// Função para testar a conexão
async function testAsaasConnection() {
  console.log('🔍 Iniciando teste de conexão com Asaas');
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
    // Teste: Verificar a conexão com a API
    console.log('\n📡 Testando conexão com a API Asaas...');
    const response = await axios.get(`${API_BASE_URL}/finance/balance`, {
      headers: { 'access_token': API_KEY }
    });
    
    console.log('✅ Conexão bem-sucedida!');
    console.log(`💰 Saldo atual: R$${response.data.balance.toFixed(2)}`);
    console.log('\n🎉 Teste concluído!');
    console.log('✅ A conexão com o Asaas está funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro durante o teste de conexão:');
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
testAsaasConnection(); 