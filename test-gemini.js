/**
 * Script de teste para verificar a API do Gemini
 * 
 * Este script testa diretamente o endpoint do Gemini para diagnosticar problemas
 */
require('dotenv').config();
const axios = require('axios');

// Configurações do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

async function testarGemini() {
  console.log('===== TESTE DA API GEMINI =====');
  console.log(`Chave API: ${GEMINI_API_KEY ? (GEMINI_API_KEY.substring(0, 3) + '...' + GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 3)) : 'Não configurada'}`);
  console.log(`Modelo: ${GEMINI_MODEL}`);
  console.log(`URL API: ${GEMINI_API_URL}`);
  
  if (!GEMINI_API_KEY) {
    console.error('❌ ERRO: Chave API do Gemini não configurada no arquivo .env');
    return;
  }
  
  try {
    console.log('\n🔄 Enviando requisição para o Gemini...');
    
        const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
        
    const requestBody = {
            contents: [
              {
                role: "user",
                parts: [
                  { 
              text: "Responda em português: Olá, você pode me fornecer uma análise estatística simples sobre roletas de cassino?"
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
              topP: 0.95,
              topK: 40
      }
    };
    
    console.log('\nCorpo da requisição:');
    console.log(JSON.stringify(requestBody, null, 2));
    
    const response = await axios.post(
      apiUrl,
      requestBody,
          { 
            headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    
    console.log('\n✅ Resposta recebida com sucesso!');
    console.log('Status:', response.status);
    console.log('Estrutura da resposta:');
    
    // Verificar a estrutura da resposta
    if (response.data && response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content &&
        response.data.candidates[0].content.parts &&
        response.data.candidates[0].content.parts[0]) {
      
      console.log('\nResposta do Gemini:');
      console.log(response.data.candidates[0].content.parts[0].text);
        } else {
      console.log('\n⚠️ Resposta recebida, mas com estrutura inesperada:');
      console.log(JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ ERRO ao chamar a API do Gemini:');
    console.error(error.message);
    
    if (error.response) {
      console.error('\nDetalhes do erro:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testarGemini(); 