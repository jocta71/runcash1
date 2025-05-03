const https = require('https');

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

// Função para testar diferentes endpoints
async function testEndpoint(path) {
  console.log(`\nTestando endpoint: ${path}`);
  
  const options = {
    hostname: 'backendapi-production-36b5.up.railway.app',
    path: path,
    method: 'GET'
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
  // Testar múltiplos endpoints
  await testEndpoint('/health');
  await testEndpoint('/api/health');
  await testEndpoint('/api/roletas');
  await testEndpoint('/api/auth/google/status');
}

main(); 