const axios = require('axios');

// Token do frontend (sem customerId)
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MTU4ZmIwZDRjNDM5Nzk0ODU2ZmQ4YiIsImVtYWlsIjoiam9jdGFzYW9wYXVsaW5vQGdtYWlsLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzQ2MjQ1NTc4LCJleHAiOjE3NDg4Mzc1Nzh9.WxgIK7ikNOmCFxdTnIYjEsxa0DxBNIQabOVIXUW7Brs";

// Endpoint da API local
const API_URL = "http://localhost:5000/api/roulettes";

// Endpoint da API em produção (Railway)
const PROD_API_URL = "https://backendapi-production-36b5.up.railway.app/api/roulettes";

async function testApi() {
  console.log("=== Teste de Acesso à API com Token do Frontend ===");
  console.log("Token sendo utilizado (sem customerId):");
  console.log(TOKEN);
  
  try {
    console.log("\n1. Testando API local...");
    try {
      const localResponse = await axios.get(API_URL, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      });
      
      console.log(`✅ SUCESSO! Status: ${localResponse.status}`);
      console.log(`Número de roletas: ${localResponse.data.length}`);
    } catch (localError) {
      console.log(`❌ ERRO! Status: ${localError.response?.status || 'N/A'}`);
      console.log("Mensagem:", localError.response?.data || localError.message);
    }
    
    console.log("\n2. Testando API em produção...");
    try {
      const prodResponse = await axios.get(PROD_API_URL, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      });
      
      console.log(`✅ SUCESSO! Status: ${prodResponse.status}`);
      console.log(`Número de roletas: ${prodResponse.data.length}`);
    } catch (prodError) {
      console.log(`❌ ERRO! Status: ${prodError.response?.status || 'N/A'}`);
      console.log("Mensagem:", prodError.response?.data || prodError.message);
    }
    
  } catch (error) {
    console.error("Erro ao executar teste:", error.message);
  }
}

// Executar teste
testApi(); 