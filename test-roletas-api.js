/**
 * Script para testar a API protegida de roletas
 * com autenticação JWT e verificação de assinatura Asaas
 */

import axios from 'axios';
import { createInterface } from 'readline';

// URL base da API - ajustada para apontar para o Railway
const API_URL = process.env.API_URL || 'https://runcashh1-production.up.railway.app/api';

// Interface para leitura de entrada do usuário
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Token JWT (deve ser obtido após login)
let token = '';

// Função para fazer requisições com o token JWT
async function fazerRequisicao(endpoint, metodo = 'get', dados = null) {
  try {
    const config = {
      method: metodo,
      url: `${API_URL}${endpoint}`,
      headers: token ? { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    };
    
    if (dados) {
      config.data = dados;
    }
    
    const resposta = await axios(config);
    return resposta.data;
  } catch (erro) {
    if (erro.response) {
      console.error(`\nErro ${erro.response.status}:`, erro.response.data);
      return erro.response.data;
    } else {
      console.error('\nErro na requisição:', erro.message);
      throw erro;
    }
  }
}

// Funções para testar diferentes endpoints

// Teste de rota pública - listar roletas
async function testarListagemRoletas() {
  console.log('\n--- Testando listagem pública de roletas ---');
  const resposta = await fazerRequisicao('/roletas');
  console.log('Resposta:', JSON.stringify(resposta, null, 2));
  return resposta;
}

// Teste de rota protegida - números da roleta
async function testarNumerosRoleta(roletaId) {
  console.log(`\n--- Testando obtenção de números da roleta ${roletaId} (protegido) ---`);
  const resposta = await fazerRequisicao(`/premium/roletas/${roletaId}/numeros`);
  console.log('Resposta:', JSON.stringify(resposta, null, 2));
  return resposta;
}

// Teste de rota protegida - estatísticas da roleta
async function testarEstatisticasRoleta(roletaId) {
  console.log(`\n--- Testando obtenção de estatísticas da roleta ${roletaId} (protegido) ---`);
  const resposta = await fazerRequisicao(`/premium/roletas/${roletaId}/estatisticas`);
  console.log('Resposta:', JSON.stringify(resposta, null, 2));
  return resposta;
}

// Teste de rota protegida - estratégias da roleta
async function testarEstrategiasRoleta(roletaId) {
  console.log(`\n--- Testando obtenção de estratégias da roleta ${roletaId} (protegido) ---`);
  const resposta = await fazerRequisicao(`/premium/roletas/${roletaId}/estrategias`);
  console.log('Resposta:', JSON.stringify(resposta, null, 2));
  return resposta;
}

// Função principal de execução de testes
async function executarTestes() {
  try {
    console.log('=== Teste da API de Roletas com Autenticação JWT e Asaas ===');
    console.log(`Usando API URL: ${API_URL}`);
    
    // Solicitar token JWT
    token = await new Promise((resolve) => {
      rl.question('\nDigite o token JWT: ', (answer) => {
        resolve(answer.trim());
      });
    });
    
    if (!token) {
      console.log('Token não fornecido. Apenas rotas públicas serão testadas.');
    }
    
    // Testar rota pública
    const roletasListadas = await testarListagemRoletas();
    
    // Se não tem token, encerrar aqui
    if (!token) {
      console.log('\nTestes de rotas públicas concluídos. Forneça um token JWT para testar rotas protegidas.');
      rl.close();
      return;
    }
    
    // Selecionar uma roleta para testes
    let roletaId;
    if (roletasListadas && roletasListadas.data && roletasListadas.data.length > 0) {
      roletaId = roletasListadas.data[0].id;
      console.log(`\nSelecionada roleta "${roletasListadas.data[0].nome}" (ID: ${roletaId}) para testes`);
    } else {
      roletaId = await new Promise((resolve) => {
        rl.question('\nDigite o ID da roleta para testes: ', (answer) => {
          resolve(answer.trim());
        });
      });
    }
    
    // Executar testes nas rotas protegidas
    await testarNumerosRoleta(roletaId);
    await testarEstatisticasRoleta(roletaId);
    await testarEstrategiasRoleta(roletaId);
    
    console.log('\n=== Testes concluídos ===');
  } catch (erro) {
    console.error('\nErro durante a execução dos testes:', erro);
  } finally {
    rl.close();
  }
}

// Iniciar testes
executarTestes(); 