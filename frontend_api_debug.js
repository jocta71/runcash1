const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configurações de usuário
const USER_ID = '68158fb0d4c439794856fd8b';
const USER_EMAIL = 'joctasaopaulino@gmail.com';
const ASAAS_CUSTOMER_ID = 'cus_000006648482';

// Token que parece funcionar no arquivo test_api_with_new_token.js
const WORKING_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoic2lpemV5bWFuQGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJjdXN0b21lcklkIjoiY3VzXzAwMDAwNjY0ODQ4MiIsImlhdCI6MTc0NjI0NTE4MiwiZXhwIjoxNzQ4ODM3MTgyfQ.Dia1xSB90yoA8_FmKlo4p0AdjkO4P7nc1KRqWGjw4iI';

// Token que criamos com chave JWT do Railway
const RAILWAY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoiam9jdGFzYW9wYXVsaW5vQGdtYWlsLmNvbSIsInJvbGUiOiJ1c2VyIiwiY3VzdG9tZXJJZCI6ImN1c18wMDAwMDY2NDg0ODIiLCJpYXQiOjE3NDYyNDczMjcsImV4cCI6MTc0ODgzOTMyN30.9pKENjwrXEhtN1Gpj8Ju7k2Q870H9sVNiUbyF0GiZl0';

// Configurações do MongoDB
const MONGODB_URI = 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const MONGODB_DB_NAME = 'runcash';

// Função para decodificar o token JWT (sem verificação)
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Função para testar endpoints da API
async function testApis() {
  console.log('\n=== Tokens Disponíveis ===');
  const decodedWorking = parseJwt(WORKING_TOKEN);
  const decodedRailway = parseJwt(RAILWAY_TOKEN);
  
  console.log('\nToken Working:');
  console.log(JSON.stringify(decodedWorking, null, 2));
  
  console.log('\nToken Railway:');
  console.log(JSON.stringify(decodedRailway, null, 2));
  
  // Testar API com ambos os tokens
  try {
    console.log('\n=== Testando API com Token 1 (Working) ===');
    const response1 = await axios.get(
      'https://backendapi-production-36b5.up.railway.app/api/roulettes',
      { 
        headers: { Authorization: `Bearer ${WORKING_TOKEN}` },
        validateStatus: () => true
      }
    );
    console.log(`Status: ${response1.status}`);
    console.log('Resposta:');
    console.log(JSON.stringify(response1.data, null, 2));
  } catch (error) {
    console.error('Erro com Token 1:', error.message);
  }
  
  try {
    console.log('\n=== Testando API com Token 2 (Railway) ===');
    const response2 = await axios.get(
      'https://backendapi-production-36b5.up.railway.app/api/roulettes',
      { 
        headers: { Authorization: `Bearer ${RAILWAY_TOKEN}` },
        validateStatus: () => true
      }
    );
    console.log(`Status: ${response2.status}`);
    console.log('Resposta:');
    console.log(JSON.stringify(response2.data, null, 2));
  } catch (error) {
    console.error('Erro com Token 2:', error.message);
  }
}

// Função para avaliar assinaturas no banco de dados
async function evaluateDbSubscriptions() {
  console.log('\n=== Avaliando Assinaturas no Banco de Dados ===');
  
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB com sucesso');
    const db = client.db(MONGODB_DB_NAME);
    
    // Verificar userId em formato String vs ObjectId
    console.log('\n1. Verificando formatos de userId na coleção userSubscriptions:');
    
    // Consulta com userId como string
    const asString = await db.collection('userSubscriptions').find({
      userId: USER_ID,
      status: "active"
    }).toArray();
    console.log(`Assinaturas com userId como string: ${asString.length}`);
    
    // Consulta com userId como ObjectId
    const asObjectId = await db.collection('userSubscriptions').find({
      userId: new ObjectId(USER_ID),
      status: "active"
    }).toArray();
    console.log(`Assinaturas com userId como ObjectId: ${asObjectId.length}`);
    
    // Consulta com comparação ObjectId
    const withObjectIdComparison = await db.collection('userSubscriptions').find({
      userId: { $in: [USER_ID, new ObjectId(USER_ID)] },
      status: "active"
    }).toArray();
    console.log(`Assinaturas com userId como string OU ObjectId: ${withObjectIdComparison.length}`);
    
    // 2. Verificar coleção de usuários e campos
    console.log('\n2. Verificando dados do usuário na coleção users:');
    const user = await db.collection('users').findOne({
      _id: new ObjectId(USER_ID)
    });
    
    if (user) {
      console.log('Campos disponíveis:');
      Object.keys(user).forEach(key => {
        const value = user[key];
        console.log(`${key}: ${value}`);
      });
    } else {
      console.log('Usuário não encontrado');
    }
    
    // 3. Verificar o formato do token salvo no banco 
    console.log('\n3. Verificando tokens na coleção de sessões:');
    const sessions = await db.collection('sessions').find({
      userId: USER_ID
    }).limit(3).toArray();
    
    if (sessions.length > 0) {
      console.log(`Encontradas ${sessions.length} sessões`);
      sessions.forEach((session, i) => {
        console.log(`\nSessão #${i+1}:`);
        console.log(`ID: ${session._id}`);
        console.log(`userId: ${session.userId}`);
        console.log(`criado em: ${session.createdAt}`);
        
        if (session.token) {
          const decoded = parseJwt(session.token);
          console.log('Token decodificado:');
          console.log(JSON.stringify(decoded, null, 2));
        }
      });
    } else {
      console.log('Nenhuma sessão encontrada');
    }
    
  } catch (error) {
    console.error('Erro durante avaliação:', error);
  } finally {
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

// Executar funções
async function main() {
  await testApis();
  await evaluateDbSubscriptions();
}

main().catch(err => {
  console.error('Erro durante execução:', err);
}); 