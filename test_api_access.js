const https = require('https');

const options = {
  hostname: 'backendapi-production-36b5.up.railway.app',
  path: '/api/roulettes',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoic2l6ZXltYW5AZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTY4MjU5MjA0MCwiZXhwIjo0ODM2MjkyMDQwfQ.SzG2hiDcYa1lsHsa-pBv1YXnYZ3e5JKibPVYbiPfFOg'
  }
};

console.log('Testando acesso à API /api/roulettes...');

const req = https.request(options, (res) => {
  console.log('Status da resposta:', res.statusCode);
  console.log('Cabeçalhos da resposta:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Corpo da resposta:');
    try {
      const parsedData = JSON.parse(data);
      console.log(JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Erro na requisição:', error);
});

req.end(); 