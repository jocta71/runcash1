/**
 * Script para testar o endpoint de IA da aplicação
 * 
 * Este script testa o endpoint da API de IA da aplicação diretamente
 */
const fetch = require('node-fetch');

async function testarEndpointAI() {
  try {
    console.log('Testando API de consulta da IA...');
    
    // Substitua pela URL do seu endpoint
    const apiUrl = 'http://localhost:3000/api/ai/query';
    
    // Parâmetros da requisição
    const requestData = {
      query: 'Quais são os números mais quentes da roleta?',
      roletaId: '1' // Substitua pelo ID válido de uma roleta
    };
    
    console.log('Enviando requisição:', JSON.stringify(requestData));
    
    // Fazer a requisição ao endpoint
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    // Verificar status da resposta
    console.log('Status da resposta:', response.status);
    
    // Obter corpo da resposta
    const responseData = await response.json();
    console.log('Resposta recebida:');
    console.log(JSON.stringify(responseData, null, 2));
    
  } catch (error) {
    console.error('Erro ao testar endpoint:', error);
    if (error.response) {
      try {
        const errorBody = await error.response.json();
        console.error('Detalhes do erro:', errorBody);
      } catch {
        console.error('Status:', error.response.status);
      }
    }
  }
}

// Executar o teste
testarEndpointAI(); 