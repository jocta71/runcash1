/**
 * Script de Teste de Autenticação API RunCash
 * 
 * Este script testa o comportamento de autenticação dos endpoints da API RunCash.
 * Ele envia requisições com e sem token JWT para verificar se a autenticação está
 * funcionando corretamente.
 */

const axios = require('axios');
const colors = require('colors/safe');

// Configuração
const BASE_URL = 'https://backendapi-production-36b5.up.railway.app';
const ENDPOINTS = [
  '/api/roulettes',
  '/api/ROULETTES',
  '/api/roletas',
  '/api/numbers/XXXtreme%20Lightning%20Roulette',
  '/api/numbers/byid/lightning_roulette'
];

// Token JWT de teste (inválido para propósitos de teste)
const INVALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjE2MTQ4MjIwfQ.INVALID-SIGNATURE';

// Função para testar um endpoint sem token
async function testWithoutToken(endpoint) {
  try {
    console.log(colors.cyan(`\n🔍 Testando ${endpoint} SEM token de autenticação...`));
    
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      timeout: 5000
    });
    
    console.log(colors.red('❌ FALHA: O endpoint NÃO exigiu autenticação!'));
    console.log(colors.yellow('Status:'), response.status);
    console.log(colors.yellow('Headers:'), JSON.stringify(response.headers, null, 2));
    
    if (response.data && typeof response.data === 'object') {
      console.log(colors.yellow('Dados retornados (primeiros 100 caracteres):'), 
        JSON.stringify(response.data).substring(0, 100) + '...');
    }
    
    return false;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        console.log(colors.green('✓ SUCESSO: Autenticação exigida corretamente'));
        console.log(colors.gray('Status:'), status);
        console.log(colors.gray('Resposta:'), JSON.stringify(data, null, 2));
        return true;
      } else {
        console.log(colors.yellow('⚠️ ATENÇÃO: Resposta não esperada'));
        console.log(colors.yellow('Status:'), status);
        console.log(colors.yellow('Resposta:'), JSON.stringify(data, null, 2));
        return false;
      }
    } else {
      console.log(colors.red('❌ ERRO: Falha na conexão'));
      console.log(colors.red(error.message));
      return false;
    }
  }
}

// Função para testar um endpoint com token inválido
async function testWithInvalidToken(endpoint) {
  try {
    console.log(colors.cyan(`\n🔍 Testando ${endpoint} COM token inválido...`));
    
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${INVALID_TOKEN}`
      },
      timeout: 5000
    });
    
    console.log(colors.red('❌ FALHA: O endpoint aceitou um token inválido!'));
    console.log(colors.yellow('Status:'), response.status);
    console.log(colors.yellow('Headers:'), JSON.stringify(response.headers, null, 2));
    
    if (response.data && typeof response.data === 'object') {
      console.log(colors.yellow('Dados retornados (primeiros 100 caracteres):'), 
        JSON.stringify(response.data).substring(0, 100) + '...');
    }
    
    return false;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        console.log(colors.green('✓ SUCESSO: Token inválido rejeitado corretamente'));
        console.log(colors.gray('Status:'), status);
        console.log(colors.gray('Resposta:'), JSON.stringify(data, null, 2));
        return true;
      } else {
        console.log(colors.yellow('⚠️ ATENÇÃO: Resposta não esperada'));
        console.log(colors.yellow('Status:'), status);
        console.log(colors.yellow('Resposta:'), JSON.stringify(data, null, 2));
        return false;
      }
    } else {
      console.log(colors.red('❌ ERRO: Falha na conexão'));
      console.log(colors.red(error.message));
      return false;
    }
  }
}

// Execução principal
async function main() {
  console.log(colors.bold.blue('=== Teste de Autenticação de API RunCash ==='));
  console.log(colors.gray(`Servidor alvo: ${BASE_URL}`));
  console.log(colors.gray(`Timestamp: ${new Date().toISOString()}`));
  console.log(colors.gray('Este script verifica se os endpoints da API estão protegidos corretamente.'));
  
  let totalEndpoints = ENDPOINTS.length;
  let passedWithoutToken = 0;
  let passedWithInvalidToken = 0;
  
  for (const endpoint of ENDPOINTS) {
    const result1 = await testWithoutToken(endpoint);
    if (result1) passedWithoutToken++;
    
    const result2 = await testWithInvalidToken(endpoint);
    if (result2) passedWithInvalidToken++;
  }
  
  console.log(colors.bold.blue('\n=== Resumo dos Testes ==='));
  console.log(`Total de endpoints testados: ${totalEndpoints}`);
  console.log(`Teste sem token: ${passedWithoutToken}/${totalEndpoints} ${passedWithoutToken === totalEndpoints ? colors.green('✓') : colors.red('✗')}`);
  console.log(`Teste com token inválido: ${passedWithInvalidToken}/${totalEndpoints} ${passedWithInvalidToken === totalEndpoints ? colors.green('✓') : colors.red('✗')}`);
  
  if (passedWithoutToken === totalEndpoints && passedWithInvalidToken === totalEndpoints) {
    console.log(colors.bold.green('\n🎉 TODOS OS TESTES PASSARAM!'));
    console.log(colors.green('Autenticação implementada corretamente em todos os endpoints.'));
  } else {
    console.log(colors.bold.red('\n⚠️ ALGUNS TESTES FALHARAM!'));
    console.log(colors.red('A implementação de autenticação pode estar incompleta ou incorreta.'));
    console.log(colors.yellow('Verifique os logs acima para mais detalhes.'));
  }
}

// Executar testes
main().catch(error => {
  console.error(colors.red('Erro fatal na execução dos testes:'));
  console.error(error);
}); 