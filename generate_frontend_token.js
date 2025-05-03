const jwt = require('jsonwebtoken');
const fs = require('fs');

// Chave secreta para assinatura do token
const JWT_SECRET = 'runcash_jwt_secret_key_2023';

// Payload do usuário - usar os mesmos dados do token do frontend
const payload = {
  id: "68158fb0d4c439794856fd8b",
  email: "joctasaopaulino@gmail.com",
  role: "user",
  customerId: "cus_000006648482", // Adicionando o customerId explicitamente
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 dias
};

// Gerar token
const token = jwt.sign(payload, JWT_SECRET);

console.log("=== Token Gerado ===");
console.log(token);
console.log("\n=== Instruções ===");
console.log("1. Copie este token");
console.log("2. Use-o no frontend definindo no localStorage:");
console.log(`   localStorage.setItem('token', '${token}')`);
console.log("3. Ou use-o diretamente nos testes:");
console.log(`   Authorization: Bearer ${token}`);

// Também salvar em um arquivo para uso futuro
fs.writeFileSync('frontend_compatible_token.txt', token);
console.log("\nToken também foi salvo no arquivo: frontend_compatible_token.txt");

// Verificando o token para garantir que está correto
try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log("\n=== Token Verificado ===");
  console.log(JSON.stringify(decoded, null, 2));
} catch (err) {
  console.error("\nErro ao verificar token:", err.message);
} 