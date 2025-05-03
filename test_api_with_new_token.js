const https = require('https');

// Token gerado manualmente com JWT_SECRET correto
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoic2lpemV5bWFuQGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJjdXN0b21lcklkIjoiY3VzXzAwMDAwNjY0ODQ4MiIsImlhdCI6MTc0NjI0NTE4MiwiZXhwIjoxNzQ4ODM3MTgyfQ.Dia1xSB90yoA8_FmKlo4p0AdjkO4P7nc1KRqWGjw4iI';

// Função para fazer uma requisição HTTPS
function httpsRequest(options) {
  return new Promise((resolve, reject) => {
    console.log(`Fazendo requisição para: ${options.path}`);
    console.log(`Cabeçalhos: ${JSON.stringify(options.headers)}`);
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          console.log(`Status da resposta: ${res.statusCode}`);
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
      console.error(`Erro na requisição: ${error.message}`);
      reject(error);
    });
    
    req.end();
  });
}

// Função para testar um endpoint com autenticação
async function testEndpointWithAuth(path) {
  console.log(`\n========== Testando endpoint: ${path} ==========`);
  
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
    
    console.log('Cabeçalhos da resposta:');
    console.log(JSON.stringify(response.headers, null, 2));
    
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
  // Testar o endpoint roulettes com o novo token
  await testEndpointWithAuth('/api/roulettes');
  
  // Testar outros endpoints relacionados
  await testEndpointWithAuth('/api/user/me');
  await testEndpointWithAuth('/api/user/subscription');
}

main(); 