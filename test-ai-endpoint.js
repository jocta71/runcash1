/**
 * Script para testar o endpoint de IA do RunCash
 * Este script testa o endpoint /api/ai/query em produção ou ambiente local
 * 
 * Executar com: node test-ai-endpoint.js [url]
 * Exemplo: node test-ai-endpoint.js https://runcashh11.vercel.app
 */

const axios = require('axios');

// Cores para log no console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Função para log colorido
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Dados simulados de roleta para teste
const mockRouletteData = {
  numbers: {
    recent: [12, 35, 0, 26, 3, 15, 4, 0, 32, 15, 7, 19, 23, 11, 5, 0, 14, 9, 32, 17],
    raw: [12, 35, 0, 26, 3, 15, 4, 0, 32, 15, 7, 19, 23, 11, 5, 0, 14, 9, 32, 17],
    redCount: 45,
    blackCount: 42,
    redPercentage: 46.88,
    blackPercentage: 43.75,
    evenCount: 38,
    oddCount: 49,
    evenPercentage: 39.58,
    oddPercentage: 51.04,
    dozenCounts: [35, 32, 25],
    dozenPercentages: [36.46, 33.33, 26.04],
    hotNumbers: [32, 15, 0, 26],
    coldNumbers: [6, 13, 33, 1]
  },
  trends: [
    { type: 'color', value: 'red', count: 3 },
    { type: 'parity', value: 'odd', count: 5 },
    { type: 'dozen', value: '2nd', count: 4 }
  ]
};

// Função para testar o endpoint
async function testEndpoint(baseUrl) {
  // URL padrão se não for fornecida
  const url = baseUrl 
    ? `${baseUrl}/api/ai/query`
    : 'http://localhost:3000/api/ai/query';
  
  log('\n🔍 TESTE DO ENDPOINT DE IA RUNCASH 🔍', colors.magenta);
  log('=======================================', colors.magenta);
  log(`🌐 URL: ${url}`, colors.blue);
  
  // Consulta de teste
  const testQuery = "Analisando esses dados, quais tendências você observa e quais números recomendaria apostar?";
  
  try {
    log('\n🚀 Enviando consulta ao endpoint...', colors.cyan);
    log(`📝 Consulta: "${testQuery}"`, colors.blue);
    
    const startTime = Date.now();
    
    // Enviar requisição para o endpoint
    const response = await axios.post(
      url,
      { 
        query: testQuery,
        rouletteData: mockRouletteData
      },
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000 // 60 segundos para permitir processamento completo
      }
    );
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    // Verificar resposta
    if (response.status === 200 && response.data.status === 'success') {
      log('\n✅ Teste concluído com sucesso!', colors.green);
      log(`⏱️ Tempo de processamento: ${processingTime.toFixed(2)} segundos`, colors.green);
      
      log('\n📝 Resposta da IA RunCash:', colors.magenta);
      log('------------------------', colors.magenta);
      log(response.data.response);
      log('------------------------', colors.magenta);
    } else {
      log('\n⚠️ Resposta recebida, mas com formato inesperado:', colors.yellow);
      log(JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    log('\n❌ Erro ao testar endpoint:', colors.red);
    
    if (error.response) {
      // Erro com resposta do servidor
      log(`Erro ${error.response.status}: ${error.response.statusText}`, colors.red);
      if (error.response.data) {
        log('Detalhes do erro:');
        log(JSON.stringify(error.response.data, null, 2), colors.yellow);
      }
    } else if (error.code === 'ECONNABORTED') {
      log('A conexão expirou. O servidor pode estar demorando muito para responder.', colors.yellow);
    } else if (error.code === 'ECONNREFUSED') {
      log('Conexão recusada. Verifique se o servidor está rodando no endereço especificado.', colors.yellow);
    } else {
      log(`Erro: ${error.message}`, colors.red);
    }
    
    log('\n💡 Dicas para resolução de problemas:', colors.cyan);
    log('1. Verifique se a URL do endpoint está correta', colors.cyan);
    log('2. Confirme se o servidor está online e acessível', colors.cyan);
    log('3. Verifique se a chave da API OpenAI está configurada no servidor', colors.cyan);
    log('4. Verifique os logs do servidor para mais detalhes', colors.cyan);
  }
}

// Obter URL base dos argumentos da linha de comando
const baseUrl = process.argv[2];
testEndpoint(baseUrl); 