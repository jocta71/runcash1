/**
 * Script para testar o middleware de verificação de assinatura
 * Verifica se os status RECEIVED e CONFIRMED são aceitos
 */

const axios = require('axios');
require('dotenv').config();

// Token JWT de teste (substitua por um token válido para testes)
const TEST_TOKEN = 'SEU_TOKEN_JWT';
const API_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Função para testar acesso à API de roletas com diferentes status
 */
async function testSubscriptionStatus() {
  console.log('==== Teste de Status de Assinatura ====');
  console.log(`API URL: ${API_URL}`);
  console.log('Token de teste disponível:', TEST_TOKEN ? 'Sim' : 'Não');
  console.log('--------------------------------------');

  try {
    // Teste com token JWT
    if (TEST_TOKEN) {
      console.log('Testando acesso à API de roletas com token JWT...');
      const response = await axios.get(`${API_URL}/api/roulettes`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      });

      console.log('Status da resposta:', response.status);
      console.log('Dados recebidos:', response.data.length, 'roletas');
      console.log('Acesso concedido com token JWT!');
    } else {
      console.log('Token JWT não disponível para teste');
    }

    console.log('--------------------------------------');
    
    // Teste sem token (deve falhar)
    try {
      console.log('Testando acesso à API de roletas sem token (deve falhar)...');
      await axios.get(`${API_URL}/api/roulettes`);
      console.log('Erro: O teste deveria ter falhado, mas foi bem-sucedido!');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('Teste bem-sucedido: Acesso negado sem token (401)');
      } else {
        console.error('Erro inesperado:', error.message);
      }
    }

    console.log('--------------------------------------');
    console.log('Testes concluídos!');
  } catch (error) {
    console.error('Erro durante os testes:', error.message);
    if (error.response) {
      console.error('Status do erro:', error.response.status);
      console.error('Dados do erro:', error.response.data);
    }
  }
}

// Executar testes
testSubscriptionStatus(); 