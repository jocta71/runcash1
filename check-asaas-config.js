// Script para verificar as configurações do Asaas
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
  const webhookSecret = env.ASAAS_WEBHOOK_SECRET;
  
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
  
  if (webhookSecret) {
    console.log('✅ ASAAS_WEBHOOK_SECRET configurada');
  } else {
    console.error('❌ ASAAS_WEBHOOK_SECRET não está configurada!');
    console.error('   Esta chave é OBRIGATÓRIA para o processamento seguro de webhooks.');
    console.error('   1. Defina uma chave secreta forte (ex: string aleatória de 32+ caracteres)');
    console.error('   2. Configure esta mesma chave no painel do Asaas ao configurar o webhook');
    console.error('   3. Adicione a chave ao arquivo .env como ASAAS_WEBHOOK_SECRET');
    console.error('   AVISO: Os webhooks serão rejeitados se esta configuração não existir!');
  }
  
  console.log('\n💡 Para testar a integração com o Asaas, é necessário:');
  console.log('   1. Uma chave de API válida');
  console.log('   2. O ambiente corretamente configurado (sandbox/production)');
  console.log('   3. Uma conta ativa no Asaas');
} else {
  console.error('❌ Arquivo .env não encontrado no caminho especificado');
}

// Verifica a configuração mínima de webhooks
console.log('\nVerificando configuração de webhooks:');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
console.log(`ℹ️ URL de frontend: ${FRONTEND_URL}`);
console.log(`ℹ️ URL para configurar no webhook do Asaas: ${FRONTEND_URL}/api/asaas-webhook`);
console.log('ℹ️ Confira se esta URL está configurada no painel do Asaas para receber eventos.');
console.log('ℹ️ Certifique-se de marcar a opção "Enabled authentication with HMAC" no Asaas.');
console.log('ℹ️ Use o mesmo valor de ASAAS_WEBHOOK_SECRET ao configurar o webhook no painel do Asaas.');

// Resumo da verificação
let configOk = true;
if (!apiKey || !environment || !webhookSecret) {
  configOk = false;
}
if (configOk) {
  console.log('✅ Configuração do Asaas completa!');
} else {
  console.error('❌ Há problemas na configuração do Asaas. Verifique os erros acima.');
  console.error('   O sistema pode não funcionar corretamente até que todas as configurações sejam feitas.');
} 