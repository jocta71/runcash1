const https = require('https');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoic2l6ZXltYW5AZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTY4MjU5MjA0MCwiZXhwIjo0ODM2MjkyMDQwfQ.SzG2hiDcYa1lsHsa-pBv1YXnYZ3e5JKibPVYbiPfFOg';

// Função para fazer uma requisição HTTPS
function httpsRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Função para testar diferentes endpoints com o token de autenticação
async function testEndpointWithAuth(path) {
  console.log(`\nTestando endpoint com autenticação: ${path}`);
  
  const options = {
    hostname: 'backendapi-production-36b5.up.railway.app',
    path: path,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  };
  
  try {
    const response = await httpsRequest(options);
    
    console.log('Status da resposta:', response.statusCode);
    console.log('Corpo da resposta:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response;
  } catch (error) {
    console.error('Erro na requisição:', error);
    return null;
  }
}

// Função principal
async function main() {
  console.log('Testando rotas protegidas com o token atual...');
  
  // Tentar verificar o status do usuário
  await testEndpointWithAuth('/api/user/me');
  
  // Tentar novamente a rota de roulettes (para confirmação)
  await testEndpointWithAuth('/api/roulettes');

  // Testando mais algumas rotas
  await testEndpointWithAuth('/api/user/profile');
  await testEndpointWithAuth('/api/user/subscription');
}

main(); 