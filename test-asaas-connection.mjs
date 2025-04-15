// Script para testar a conexão com a API do Asaas
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

// Função principal
async function testAsaasConnection() {
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
  
  // Determinar a URL base da API
  const apiBaseUrl = environment === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';
  
  console.log('🔍 Iniciando teste de conexão com Asaas');
  console.log(`🔧 Ambiente: ${environment}`);
  console.log(`🔑 Chave de API: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`🔗 URL base da API: ${apiBaseUrl}`);
  
  try {
    // Teste: Verificar a conexão com a API
    console.log('\n📡 Testando conexão com a API Asaas...');
    const response = await axios.get(`${apiBaseUrl}/finance/balance`, {
      headers: { 'access_token': apiKey }
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