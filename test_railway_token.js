const axios = require('axios');
const fs = require('fs');

// Ler o token do arquivo
let token;
try {
  token = fs.readFileSync('railway_token.txt', 'utf8').trim();
  console.log('Token lido do arquivo railway_token.txt com sucesso');
} catch (err) {
  console.error('Erro ao ler token do arquivo:', err.message);
  console.log('Por favor, execute primeiro o script railway_token.js');
  process.exit(1);
}

// Função para decodificar o token JWT (sem verificação)
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(jsonPayload);
}

// Função para testar endpoints da API
async function testApi() {
  // Exibir informações do token
  console.log('\n=== Informações do Token ===');
  const decodedToken = parseJwt(token);
  console.log(JSON.stringify(decodedToken, null, 2));
  
  // Configuração do cabeçalho de autorização
  const headers = {
    Authorization: `Bearer ${token}`
  };
  
  // Testar endpoint de roletas (Railway)
  console.log('\n=== Testando API de Roletas (Railway) ===');
  try {
    const railwayResponse = await axios.get(
      'https://backendapi-production-36b5.up.railway.app/api/roulettes',
      { headers }
    );
    
    console.log('Status:', railwayResponse.status);
    console.log('Resposta:');
    console.log(JSON.stringify(railwayResponse.data, null, 2));
  } catch (error) {
    console.error('Erro ao acessar API de Railway:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Resposta:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
  
  // Testar endpoint de usuário (Railway)
  console.log('\n=== Testando API de Usuário (Railway) ===');
  try {
    const userResponse = await axios.get(
      'https://backendapi-production-36b5.up.railway.app/api/user/me',
      { headers }
    );
    
    console.log('Status:', userResponse.status);
    console.log('Resposta:');
    console.log(JSON.stringify(userResponse.data, null, 2));
  } catch (error) {
    console.error('Erro ao acessar API de usuário:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Resposta:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
  
  // Testar endpoint de assinatura (Railway)
  console.log('\n=== Testando API de Assinatura (Railway) ===');
  try {
    const subscriptionResponse = await axios.get(
      'https://backendapi-production-36b5.up.railway.app/api/user/subscription',
      { headers }
    );
    
    console.log('Status:', subscriptionResponse.status);
    console.log('Resposta:');
    console.log(JSON.stringify(subscriptionResponse.data, null, 2));
  } catch (error) {
    console.error('Erro ao acessar API de assinatura:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Resposta:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Executar testes
testApi().catch(err => {
  console.error('Erro durante a execução dos testes:', err.message);
}); 