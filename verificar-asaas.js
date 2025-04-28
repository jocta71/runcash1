/**
 * Script para verificar a configuração do Asaas
 * Executa testes básicos para confirmar que a integração está funcionando corretamente
 */

require('dotenv').config();
const axios = require('axios');
const chalk = require('chalk') || { green: t => t, red: t => t, yellow: t => t, blue: t => t };

console.log(chalk.blue('🧪 Iniciando verificação da configuração do Asaas...'));

// Verificar variáveis de ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';

// Função para verificar a configuração
async function verificarConfiguracao() {
  console.log(chalk.blue('Verificando variáveis de ambiente...'));
  
  if (!ASAAS_API_KEY) {
    console.log(chalk.red('❌ ASAAS_API_KEY não encontrada no arquivo .env'));
    console.log(chalk.yellow(`
    SOLUÇÃO: 
    1. Adicione a seguinte linha ao seu arquivo .env:
       ASAAS_API_KEY=sua-chave-api-asaas-aqui
    
    2. Obtenha sua chave de API no Asaas acessando:
       https://www.asaas.com/ > Sua Conta > Integrações > API
    `));
    return false;
  }
  
  console.log(chalk.green('✅ ASAAS_API_KEY configurada'));
  
  if (!ASAAS_API_URL) {
    console.log(chalk.yellow('⚠️ ASAAS_API_URL não encontrada, usando URL padrão'));
  } else {
    console.log(chalk.green(`✅ ASAAS_API_URL configurada: ${ASAAS_API_URL}`));
  }
  
  console.log(chalk.blue('Testando conexão com o Asaas...'));
  
  try {
    // Testar conexão com a API do Asaas
    const response = await axios.get(`${ASAAS_API_URL}/customers`, {
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });
    
    if (response.status === 200) {
      console.log(chalk.green('✅ Conexão com o Asaas estabelecida com sucesso!'));
      return true;
    } else {
      console.log(chalk.red(`❌ Erro ao conectar com o Asaas. Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    console.log(chalk.red('❌ Erro ao conectar com o Asaas:'));
    
    if (error.response) {
      // Erro de autenticação
      if (error.response.status === 401) {
        console.log(chalk.red('   Chave de API inválida ou expirada.'));
        console.log(chalk.yellow(`
        SOLUÇÃO: 
        1. Verifique se a chave API está correta
        2. Gere uma nova chave no painel do Asaas se necessário
        `));
      } else {
        console.log(chalk.red(`   Status: ${error.response.status}`));
        console.log(chalk.red(`   Mensagem: ${JSON.stringify(error.response.data)}`));
      }
    } else if (error.request) {
      // Erro de conexão
      console.log(chalk.red('   Não foi possível se conectar ao servidor Asaas.'));
      console.log(chalk.yellow(`
      SOLUÇÃO: 
      1. Verifique sua conexão com a internet
      2. Confirme se ASAAS_API_URL está configurada corretamente
      3. Se estiver usando um ambiente sandbox, use: https://sandbox.asaas.com/api/v3
      `));
    } else {
      // Outro erro
      console.log(chalk.red(`   ${error.message}`));
    }
    
    return false;
  }
}

// Executar verificação
verificarConfiguracao()
  .then(resultado => {
    if (resultado) {
      console.log(chalk.green('🎉 Configuração do Asaas está correta!'));
      console.log(chalk.green('O componente SubscriptionBanner deve funcionar corretamente.'));
    } else {
      console.log(chalk.red('❌ Problemas encontrados na configuração do Asaas.'));
      console.log(chalk.yellow('Por favor, resolva os problemas indicados acima para que o SubscriptionBanner funcione corretamente.'));
    }
  })
  .catch(err => {
    console.error('Erro durante a verificação:', err);
  }); 