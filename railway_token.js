const jwt = require('jsonwebtoken');

// Chave JWT exata usada pelo servidor Railway
const JWT_SECRET = "runcash_jwt_secret_key_2023";
const userId = '68158fb0d4c439794856fd8b'; // ID do usuário que teve a assinatura atualizada

// Payload do token
const payload = {
  id: userId,
  email: 'joctasaopaulino@gmail.com',
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
console.log('Token JWT gerado com sucesso para Railway:');
console.log(token);

// Decodificar token para verificar o conteúdo
const decoded = jwt.verify(token, JWT_SECRET);
console.log('\nConteúdo decodificado do token:');
console.log(JSON.stringify(decoded, null, 2));

// Salvar o token em um arquivo para uso posterior
const fs = require('fs');
fs.writeFileSync('railway_token.txt', token);
console.log('\nToken salvo no arquivo railway_token.txt');

// Instruções para usar o token
console.log('\n=== Como usar este token ===');
console.log('1. Use o token em requisições HTTP com o cabeçalho:');
console.log(`   Authorization: Bearer ${token}`);
console.log('2. Para testes, use o arquivo test_railway_token.js'); 