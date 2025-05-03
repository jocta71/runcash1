const jwt = require('jsonwebtoken');

// Configurações para gerar o token
const JWT_SECRET = 'runcash_auth_secret_key_xP9v2J7mL8sK3tD5qF6hG1zW4cY0bN';
const userId = '68158fb0d4c439794856fd8b'; // ID do usuário que teve a assinatura atualizada

// Payload do token
const payload = {
  id: userId,
  email: 'siizeyman@example.com',
  role: 'user',
  customerId: 'cus_000006648482' // Importante incluir o customerId para verificação da assinatura
};

// Opções para o token
const options = {
  expiresIn: '30d' // Token válido por 30 dias
};

// Gerar o token
const token = jwt.sign(payload, JWT_SECRET, options);

// Exibir o token gerado
console.log('Token JWT gerado com sucesso:');
console.log(token);

// Decodificar token para verificar o conteúdo
const decoded = jwt.verify(token, JWT_SECRET);
console.log('\nConteúdo decodificado do token:');
console.log(JSON.stringify(decoded, null, 2)); 