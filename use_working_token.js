const axios = require('axios');

// Token que sabemos que funciona (do arquivo test_api_with_new_token.js)
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoic2lpemV5bWFuQGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJjdXN0b21lcklkIjoiY3VzXzAwMDAwNjY0ODQ4MiIsImlhdCI6MTc0NjI0NTE4MiwiZXhwIjoxNzQ4ODM3MTgyfQ.Dia1xSB90yoA8_FmKlo4p0AdjkO4P7nc1KRqWGjw4iI';

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
  console.log('\n=== Informações do Token que Funciona ===');
  const decodedToken = parseJwt(TOKEN);
  console.log(JSON.stringify(decodedToken, null, 2));
  
  // Configuração do cabeçalho de autorização
  const headers = {
    Authorization: `Bearer ${TOKEN}`
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