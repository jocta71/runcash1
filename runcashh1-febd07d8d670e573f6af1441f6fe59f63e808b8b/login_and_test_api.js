const https = require('https');

// Função para fazer uma requisição HTTPS
function httpsRequest(options, data = null) {
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
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Login para obter o token
async function login() {
  console.log('Fazendo login para obter um novo token...');
  
  const loginOptions = {
    hostname: 'backendapi-production-36b5.up.railway.app',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const loginData = {
    email: 'siizeyman@example.com',
    password: 'senha123' // Substitua pela senha correta
  };
  
  try {
    const loginResponse = await httpsRequest(loginOptions, loginData);
    
    console.log('Status da resposta de login:', loginResponse.statusCode);
    
    if (loginResponse.statusCode === 200 && loginResponse.data.token) {
      console.log('Login bem-sucedido, token obtido!');
      return loginResponse.data.token;
    } else {
      console.error('Falha no login:', loginResponse.data);
      return null;
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return null;
  }
}

// Testar o acesso à API com o token
async function testApiAccess(token) {
  console.log('Testando acesso à API /api/roulettes com o novo token...');
  
  const options = {
    hostname: 'backendapi-production-36b5.up.railway.app',
    path: '/api/roulettes',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  
  try {
    const apiResponse = await httpsRequest(options);
    
    console.log('Status da resposta:', apiResponse.statusCode);
    console.log('Cabeçalhos da resposta:', apiResponse.headers);
    console.log('Corpo da resposta:');
    console.log(JSON.stringify(apiResponse.data, null, 2));
    
    return apiResponse;
  } catch (error) {
    console.error('Erro na requisição à API:', error);
    return null;
  }
}

// Função principal
async function main() {
  // Primeiro, testar com o token atual (que está falhando)
  console.log('Testando o token atual que está falhando...');
  const oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoic2l6ZXltYW5AZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTY4MjU5MjA0MCwiZXhwIjo0ODM2MjkyMDQwfQ.SzG2hiDcYa1lsHsa-pBv1YXnYZ3e5JKibPVYbiPfFOg';
  await testApiAccess(oldToken);
  
  console.log('\n==================================================\n');
  
  // Agora tentar com um novo token de login
  const newToken = await login();
  if (newToken) {
    await testApiAccess(newToken);
  } else {
    console.log('Não foi possível obter um novo token, impossível testar a API.');
  }
}

main(); 