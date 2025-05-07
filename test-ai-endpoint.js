/**
 * Script para testar o endpoint de IA da aplicação
 * 
 * Este script testa o endpoint da API de IA da aplicação diretamente
 */
require('dotenv').config();
const axios = require('axios');

// URL da aplicação - ajuste conforme necessário
const BASE_URL = 'https://runcashh111.vercel.app';
// URL local para desenvolvimento
// const BASE_URL = 'http://localhost:3000';

async function testarEndpointAI() {
  console.log('===== TESTE DO ENDPOINT DA API DE IA =====');
  console.log(`URL Base: ${BASE_URL}`);
  console.log('Endpoint: /api/ai/query');
  
  try {
    console.log('\n🔄 Enviando consulta para o endpoint da API...');
    
    const requestBody = {
      query: 'Analise os últimos números da roleta',
      roletaId: null,
      roletaNome: null
    };
    
    console.log('\nCorpo da requisição:');
    console.log(JSON.stringify(requestBody, null, 2));
    
    const response = await axios.post(
      `${BASE_URL}/api/ai/query`,
      requestBody,
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000 // 60 segundos para permitir tempo de processamento
      }
    );
    
    console.log('\n✅ Resposta recebida com sucesso!');
    console.log('Status:', response.status);
    console.log('\nResposta da API:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ ERRO ao chamar o endpoint da API:');
    console.error(error.message);
    
    if (error.response) {
      console.error('\nDetalhes do erro:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testarEndpointAI(); 