/**
 * Script para testar o acesso às roletas com diferentes status de assinatura
 * 
 * Testa se um usuário com assinatura RECEIVED ou CONFIRMED consegue acessar a API
 */

const axios = require('axios');

// Token JWT válido de um usuário com assinatura
const TOKEN = 'SEU_TOKEN_JWT_AQUI'; // <-- Substitua por um token válido

// URL base da API (ajuste conforme necessário)
const API_URL = 'https://runcashh11.vercel.app';

// Função principal
async function testRouletteAccess() {
  console.log('==== Teste de Acesso à API de Roletas ====');
  console.log('Verificando se a API está aceitando status RECEIVED e CONFIRMED');
  console.log('===========================================');

  try {
    // 1. Testar acesso à API de roletas
    console.log('\n1. Testando acesso à API de roletas...');
    const rouletteResponse = await axios.get(`${API_URL}/api/ROULETTES`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    console.log('Resposta da API de roletas:');
    console.log(`Status: ${rouletteResponse.status}`);
    console.log(`Quantidade de dados: ${rouletteResponse.data?.length || 0} itens`);
    
    if (rouletteResponse.data?.length > 0) {
      console.log('Amostra de dados:');
      console.log(JSON.stringify(rouletteResponse.data[0], null, 2));
    }

    // 2. Verificar o status da assinatura
    console.log('\n2. Verificando status da assinatura...');
    const subscriptionResponse = await axios.get(`${API_URL}/api/subscription/status`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    console.log('Resposta do status da assinatura:');
    console.log(`Status: ${subscriptionResponse.status}`);
    console.log('Dados da assinatura:');
    console.log(JSON.stringify(subscriptionResponse.data, null, 2));

    // 3. Resumo do teste
    console.log('\n==== Resumo do Teste ====');
    
    const hasSubscription = subscriptionResponse.data?.hasSubscription || false;
    const subscriptionStatus = subscriptionResponse.data?.subscription?.status || 'Desconhecido';
    const accessGranted = rouletteResponse.status === 200 && rouletteResponse.data?.length > 0;
    
    console.log(`Status da assinatura: ${subscriptionStatus}`);
    console.log(`Assinatura ativa: ${hasSubscription ? 'Sim' : 'Não'}`);
    console.log(`Acesso à API concedido: ${accessGranted ? 'Sim' : 'Não'}`);
    
    if (accessGranted) {
      if (['RECEIVED', 'CONFIRMED'].includes(subscriptionStatus)) {
        console.log('\n✅ SUCESSO: Usuário com status de assinatura ' + subscriptionStatus + ' conseguiu acessar a API!');
      } else if (subscriptionStatus === 'ACTIVE') {
        console.log('\n✅ SUCESSO: Usuário com assinatura ACTIVE conseguiu acessar a API (comportamento padrão)');
      } else {
        console.log('\n⚠️ ATENÇÃO: Acesso concedido com status incomum: ' + subscriptionStatus);
      }
    } else {
      console.log('\n❌ FALHA: Acesso negado mesmo com assinatura ' + subscriptionStatus);
    }

  } catch (error) {
    console.error('\n❌ ERRO durante o teste:');
    
    if (error.response) {
      console.error(`Status do erro: ${error.response.status}`);
      console.error('Dados do erro:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// Executa o teste
testRouletteAccess(); 