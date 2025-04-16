// Script de diagnóstico para verificar a configuração da API Asaas
const axios = require('axios');
require('dotenv').config();

async function diagnosticarAsaas() {
  console.log('=== FERRAMENTA DE DIAGNÓSTICO DA API ASAAS ===');
  console.log('Data e hora: ', new Date().toISOString());
  console.log('Ambiente: ', process.env.NODE_ENV || 'não definido');
  
  // Verificar variáveis de ambiente
  console.log('\n=== VERIFICANDO VARIÁVEIS DE AMBIENTE ===');
  const asaasApiKey = process.env.ASAAS_API_KEY;
  const apiKeyFormatada = asaasApiKey ? `${asaasApiKey.substring(0, 10)}...` : 'não definida';
  console.log('ASAAS_API_KEY: ', apiKeyFormatada);
  
  if (!asaasApiKey) {
    console.error('ERRO: Chave da API Asaas não está definida no ambiente.');
    console.log('Por favor, defina a variável ASAAS_API_KEY no seu arquivo .env ou nas variáveis de ambiente do Vercel.');
    process.exit(1);
  }
  
  if (asaasApiKey === '$api_key_aqui' || asaasApiKey.includes('$api_key')) {
    console.error('ERRO: Chave da API Asaas tem o valor padrão ou placeholder.');
    console.log('Por favor, substitua por uma chave válida do seu painel do Asaas.');
    process.exit(1);
  }
  
  // Forçar uso do sandbox para testes
  const ASAAS_ENVIRONMENT = 'sandbox';
  console.log('Ambiente Asaas: ', ASAAS_ENVIRONMENT);
  
  const asaasBaseUrl = ASAAS_ENVIRONMENT === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';
  
  console.log('URL base da API: ', asaasBaseUrl);
  
  // Testar conexão com API
  console.log('\n=== TESTANDO CONEXÃO COM API ASAAS ===');
  
  // Configurar headers corretos
  const headersValidos = {
    'Content-Type': 'application/json',
    'User-Agent': 'RunCash/1.0',
    'access_token': asaasApiKey
  };
  
  console.log('Headers da requisição:');
  console.log(JSON.stringify({
    ...headersValidos,
    'access_token': apiKeyFormatada
  }, null, 2));
  
  try {
    console.log('\nTestando endpoint /customers...');
    const response = await axios.get(`${asaasBaseUrl}/customers`, {
      headers: headersValidos,
      validateStatus: function (status) {
        return status >= 200 && status < 600; // Aceitar qualquer status para diagnóstico
      }
    });
    
    console.log('Status da resposta: ', response.status);
    console.log('Headers da resposta: ', JSON.stringify(response.headers, null, 2));
    
    if (response.status === 200) {
      console.log('✅ SUCESSO: Conexão com API Asaas estabelecida com sucesso!');
      console.log('Resposta contém: ', response.data.data ? `${response.data.data.length} clientes` : 'Dados não encontrados');
    } else if (response.status === 401) {
      console.error('❌ ERRO 401: Não autorizado. Verifique se a chave API está correta e ativa.');
      console.log('Detalhes: ', JSON.stringify(response.data, null, 2));
    } else {
      console.error(`❌ ERRO ${response.status}: Resposta inesperada da API.`);
      console.log('Detalhes: ', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('❌ ERRO: Falha ao se conectar com a API Asaas:');
    console.error('Mensagem: ', error.message);
    
    if (error.response) {
      console.error('Status: ', error.response.status);
      console.error('Dados: ', error.response.data);
      console.error('Headers: ', error.response.headers);
    } else if (error.request) {
      console.error('Sem resposta recebida do servidor');
      console.error('Requisição: ', error.request);
    } else {
      console.error('Erro na configuração da requisição');
    }
  }
  
  console.log('\n=== INSTRUÇÕES PARA RESOLVER PROBLEMAS COMUNS ===');
  console.log('1. Se recebeu erro 401, acesse https://sandbox.asaas.com/');
  console.log('2. Vá para Integrações > API Key');
  console.log('3. Gere uma nova chave API se necessário');
  console.log('4. Atualize a variável ASAAS_API_KEY no Vercel:');
  console.log('   a. Acesse https://vercel.com/');
  console.log('   b. Selecione seu projeto');
  console.log('   c. Vá para Settings > Environment Variables');
  console.log('   d. Atualize ou adicione a variável ASAAS_API_KEY com o valor correto');
  console.log('   e. Faça um novo deploy do projeto');
  console.log('\nLembre-se de que as chaves do sandbox e produção são diferentes.');
  console.log('Use a chave do ambiente adequado para o estágio atual do seu projeto.');
}

// Executar o diagnóstico
diagnosticarAsaas().catch(err => {
  console.error('Erro fatal durante o diagnóstico:', err);
  process.exit(1);
}); 