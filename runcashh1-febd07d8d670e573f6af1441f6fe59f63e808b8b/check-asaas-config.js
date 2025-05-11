// Script para verificar as configurações do Asaas
const fs = require('fs');
const path = require('path');

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

// Caminho para o arquivo .env
const envPath = path.resolve(__dirname, './backend/api/.env');
console.log(`Buscando arquivo .env em: ${envPath}`);

// Verificar se o arquivo existe
if (fs.existsSync(envPath)) {
  console.log('✅ Arquivo .env encontrado');
  
  // Ler as configurações
  const env = parseEnvFile(envPath);
  
  // Verificar configurações do Asaas
  console.log('\n🔍 Configurações do Asaas:');
  
  const apiKey = env.ASAAS_API_KEY;
  const environment = env.ASAAS_ENVIRONMENT;
  
  if (apiKey) {
    // Exibir apenas parte da chave por segurança
    const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
    console.log(`✅ Chave de API: ${maskedKey}`);
  } else {
    console.log('❌ Chave de API não encontrada');
  }
  
  if (environment) {
    console.log(`✅ Ambiente: ${environment}`);
    
    // Determinar a URL da API com base no ambiente
    const apiBaseUrl = environment === 'production' 
      ? 'https://www.asaas.com/api/v3'
      : 'https://sandbox.asaas.com/api/v3';
    console.log(`🔗 URL base da API: ${apiBaseUrl}`);
  } else {
    console.log('❌ Ambiente não configurado');
  }
  
  console.log('\n💡 Para testar a integração com o Asaas, é necessário:');
  console.log('   1. Uma chave de API válida');
  console.log('   2. O ambiente corretamente configurado (sandbox/production)');
  console.log('   3. Uma conta ativa no Asaas');
} else {
  console.error('❌ Arquivo .env não encontrado no caminho especificado');
} 