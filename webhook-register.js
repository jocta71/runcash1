// Script para registrar o webhook no Asaas
const axios = require('axios');
require('dotenv').config({ path: './backend/api/.env' });

// Configurações do ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const BASE_URL = ASAAS_ENVIRONMENT === 'production'
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

// URL do seu webhook - SUBSTITUA pela URL correta do seu ambiente
const PUBLIC_WEBHOOK_URL = process.env.PUBLIC_WEBHOOK_URL || 'https://seudominio.com/api/asaas-webhook';

// Função principal
async function registerWebhook() {
  if (!ASAAS_API_KEY) {
    console.error('❌ ERRO: Chave de API do Asaas não configurada.');
    console.error('Por favor, configure a variável ASAAS_API_KEY no arquivo .env');
    return;
  }

  console.log(`🔹 Ambiente Asaas: ${ASAAS_ENVIRONMENT}`);
  console.log(`🔹 URL do webhook: ${PUBLIC_WEBHOOK_URL}`);

  try {
    // Primeiro, verificar se já existe um webhook configurado
    console.log('\n🔍 Verificando webhooks existentes...');
    
    const existingWebhooksResponse = await axios({
      method: 'get',
      url: `${BASE_URL}/webhook`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });

    const existingWebhooks = existingWebhooksResponse.data.data || [];
    
    if (existingWebhooks.length > 0) {
      console.log(`✅ ${existingWebhooks.length} webhook(s) encontrado(s):`);
      
      for (const webhook of existingWebhooks) {
        console.log(`   - URL: ${webhook.url}`);
        console.log(`   - Ativo: ${webhook.enabled ? 'Sim' : 'Não'}`);
        console.log(`   - ID: ${webhook.id}`);
        console.log('');
      }
      
      // Verificar se o webhook com a nossa URL já existe
      const ourWebhook = existingWebhooks.find(wh => wh.url === PUBLIC_WEBHOOK_URL);
      
      if (ourWebhook) {
        console.log('✅ O webhook com a URL especificada já está configurado.');
        
        // Verifica se está ativo e habilita se necessário
        if (!ourWebhook.enabled) {
          console.log('⚠️ O webhook está desativado. Ativando...');
          
          await axios({
            method: 'put',
            url: `${BASE_URL}/webhook/${ourWebhook.id}`,
            headers: {
              'access_token': ASAAS_API_KEY
            },
            data: {
              enabled: true
            }
          });
          
          console.log('✅ Webhook ativado com sucesso!');
        }
        
        return;
      }
    } else {
      console.log('ℹ️ Nenhum webhook configurado.');
    }
    
    // Criar um novo webhook
    console.log('\n🔧 Criando novo webhook...');
    
    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/webhook`,
      headers: {
        'access_token': ASAAS_API_KEY
      },
      data: {
        url: PUBLIC_WEBHOOK_URL,
        email: process.env.ADMIN_EMAIL || 'admin@exemplo.com',
        enabled: true,
        interrupted: false,
        apiVersion: 3
      }
    });
    
    console.log('✅ Webhook registrado com sucesso!');
    console.log(`🔹 ID: ${response.data.id}`);
    console.log(`🔹 URL: ${response.data.url}`);
    console.log(`🔹 E-mail: ${response.data.email}`);
    console.log(`🔹 Ativo: ${response.data.enabled ? 'Sim' : 'Não'}`);
  } catch (error) {
    console.error('❌ Erro ao registrar webhook:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error('   Detalhes:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Executar a função principal
registerWebhook(); 