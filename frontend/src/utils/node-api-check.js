/**
 * Script para verificar o acesso à API de roletas (versão Node.js)
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configurações
const BASE_URL = 'https://backendapi-production-36b5.up.railway.app';
const CONFIG_FILE = path.join(__dirname, 'api-check-config.json');

// Função para carregar token da configuração
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return config;
    }
  } catch (error) {
    console.error('Erro ao carregar configuração:', error);
  }
  
  return { token: null };
}

// Função para salvar token na configuração
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('Configuração salva com sucesso');
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
  }
}

// Verificar status da assinatura
async function checkSubscriptionStatus(token) {
  if (!token) {
    console.log('Token não fornecido. Não é possível verificar assinatura.');
    return null;
  }
  
  try {
    console.log('Verificando status da assinatura...');
    
    const response = await axios.get(`${BASE_URL}/api/subscription/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Resposta da API:', JSON.stringify(response.data, null, 2));
    
    if (response.data.hasSubscription) {
      console.log(`✅ Assinatura ativa (${response.data.subscription?.status})`);
    } else {
      console.log('❌ Assinatura inativa ou inexistente');
    }
    
    return response.data;
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    }
    return null;
  }
}

// Verificar acesso às roletas
async function checkRoulettesAccess(token) {
  if (!token) {
    console.log('Token não fornecido. Não é possível verificar acesso às roletas.');
    return null;
  }
  
  console.log('Verificando acesso à API de roletas...');
  
  // Endpoints a serem verificados
  const endpoints = [
    '/api/ROULETTES',
    '/api/roulettes',
    '/api/roletas'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Tentando endpoint: ${endpoint}`);
      
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 200 && Array.isArray(response.data)) {
        console.log(`✅ Endpoint ${endpoint} funcionando: ${response.data.length} roletas`);
        
        if (response.data.length > 0) {
          const firstRoulette = response.data[0];
          console.log('Primeira roleta:', {
            id: firstRoulette.id,
            nome: firstRoulette.nome || firstRoulette.name,
            numeroCount: firstRoulette.numero?.length || 0
          });
        }
        
        return {
          success: true,
          endpoint,
          data: response.data
        };
      } else {
        console.log(`⚠️ Endpoint ${endpoint} respondeu, mas formato inválido`);
      }
    } catch (error) {
      console.error(`❌ Erro no endpoint ${endpoint}:`, error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
      }
    }
  }
  
  console.log('❌ Nenhum endpoint de roletas funcionou');
  return { success: false };
}

// Executar verificações
async function runApiCheck() {
  console.log('==========================================');
  console.log('  VERIFICAÇÃO DE ACESSO À API DE ROLETAS  ');
  console.log('==========================================');
  
  // Carregar configuração
  const config = loadConfig();
  
  // Verificar se há token
  if (!config.token) {
    console.log('❌ Nenhum token configurado. Use:');
    console.log('node api-check.js --token=seu_token_aqui');
    return;
  }
  
  console.log(`✅ Token configurado: ${config.token.substring(0, 10)}...`);
  
  // Verificar status da assinatura
  const subscriptionData = await checkSubscriptionStatus(config.token);
  
  // Verificar acesso às roletas
  const roulettesAccess = await checkRoulettesAccess(config.token);
  
  // Resumo
  console.log('==========================================');
  console.log('  RESUMO DA VERIFICAÇÃO  ');
  console.log('==========================================');
  
  console.log(`Autenticação: ${config.token ? '✅' : '❌'}`);
  console.log(`Assinatura: ${subscriptionData?.hasSubscription ? '✅' : '❌'}`);
  console.log(`API de Roletas: ${roulettesAccess?.success ? '✅' : '❌'}`);
  
  console.log('==========================================');
}

// Processar argumentos de linha de comando
function processArgs() {
  const args = process.argv.slice(2);
  const config = loadConfig();
  
  for (const arg of args) {
    if (arg.startsWith('--token=')) {
      config.token = arg.substring('--token='.length);
      saveConfig(config);
      console.log(`Token configurado: ${config.token.substring(0, 10)}...`);
    }
  }
  
  return runApiCheck();
}

// Executar
processArgs().catch(console.error); 