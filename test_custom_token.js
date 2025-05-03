const axios = require('axios');
const fs = require('fs');

// Ler o token do arquivo
const TOKEN = fs.readFileSync('frontend_compatible_token.txt', 'utf8').trim();

// Endpoints da API em produção
const PROD_API_URL = "https://backendapi-production-36b5.up.railway.app/api/roulettes";
const VERCEL_API_URL = "https://runcashh11.vercel.app/api/roulettes";

const parseJwt = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch (e) {
    return null;
  }
};

async function testApi() {
  console.log("=== Teste de Acesso à API com Token Personalizado ===");
  console.log("Token sendo utilizado (com customerId):");
  
  // Mostrar conteúdo do token
  const tokenData = parseJwt(TOKEN);
  console.log("Conteúdo do token:");
  console.log(JSON.stringify(tokenData, null, 2));
  
  try {
    console.log("\n1. Testando API em Railway...");
    try {
      const railwayResponse = await axios.get(PROD_API_URL, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      });
      
      console.log(`✅ SUCESSO! Status: ${railwayResponse.status}`);
      console.log(`Número de roletas: ${railwayResponse.data.length}`);
      console.log(`Nomes das primeiras 3 roletas:`);
      railwayResponse.data.slice(0, 3).forEach((roleta, index) => {
        console.log(`${index + 1}. ${roleta.nome}`);
      });
    } catch (railwayError) {
      console.log(`❌ ERRO! Status: ${railwayError.response?.status || 'N/A'}`);
      console.log("Mensagem:", railwayError.response?.data || railwayError.message);
    }
    
    console.log("\n2. Testando API em Vercel (frontend)...");
    try {
      const vercelResponse = await axios.get(VERCEL_API_URL, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      });
      
      console.log(`✅ SUCESSO! Status: ${vercelResponse.status}`);
      console.log(`Número de roletas: ${vercelResponse.data.length}`);
    } catch (vercelError) {
      console.log(`❌ ERRO! Status: ${vercelError.response?.status || 'N/A'}`);
      console.log("Mensagem:", vercelError.response?.data || vercelError.message);
    }
    
  } catch (error) {
    console.error("Erro ao executar teste:", error.message);
  }
}

// Executar teste
testApi(); 