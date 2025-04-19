/**
 * Script de Teste para API do Gemini AI (Google) com Logs de Diagnóstico do MongoDB
 * 
 * Este script testa a conexão com a API do Gemini e a funcionalidade
 * de processamento de consultas relacionadas a dados de roleta.
 * Adicionado diagnóstico de conexão com MongoDB para verificar por que dados simulados são retornados.
 * 
 * Executar com: node test-gemini.js
 */

// Importar dependências
const axios = require('axios');
require('dotenv').config();
const { MongoClient } = require('mongodb');

// Adicionar módulo readline para entrada do usuário
const readline = require('readline');

// Verificar configuração da API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

// Configuração do MongoDB para diagnóstico
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

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

// Função para log estilizado
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Validar configuração
function validateConfig() {
  log('\n🔍 Verificando configuração da API Gemini...', colors.cyan);
  
  if (!GEMINI_API_KEY) {
    log('❌ ERRO: GEMINI_API_KEY não configurada no arquivo .env', colors.red);
    log('   Crie ou edite o arquivo .env na raiz do projeto e adicione uma linha com:', colors.yellow);
    log('   GEMINI_API_KEY=sua-chave-real-aqui', colors.yellow);
    return false;
  }
  
  if (GEMINI_API_KEY === 'sua-chave-api-gemini-aqui') {
    log('❌ ERRO: GEMINI_API_KEY está usando o valor padrão do exemplo', colors.red);
    log('   Edite o arquivo .env e substitua com sua chave real do Gemini', colors.yellow);
    return false;
  }
  
  log(`✅ GEMINI_API_KEY configurada corretamente`, colors.green);
  log(`✅ Usando modelo: ${GEMINI_MODEL}`, colors.green);
  
  // Validar configuração do MongoDB
  log('\n🔍 Verificando configuração do MongoDB...', colors.cyan);
  log(`🔶 URI do MongoDB: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')}`, colors.blue);
  log(`🔶 Banco de dados: ${MONGODB_DB_NAME}`, colors.blue);
  
  return true;
}

// Função para obter dados reais de roleta do MongoDB
async function getRouletteData() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    const roletaNumeros = db.collection('roleta_numeros');
    
    // Buscar os últimos números
    const latestNumbers = await roletaNumeros
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Extrair lista de roletas distintas
    const roletas = [...new Set(latestNumbers.map(entry => entry.roleta_nome))];
    
    // Separar números por roleta
    const numerosPorRoleta = {};
    roletas.forEach(roleta => {
      const numerosRoleta = latestNumbers
        .filter(entry => entry.roleta_nome === roleta)
        .map(entry => entry.numero);
      if (numerosRoleta.length > 0) {
        numerosPorRoleta[roleta] = numerosRoleta;
      }
    });
    
    // Formatar os dados da forma esperada pela API
    const recentNumbers = latestNumbers.map(entry => entry.numero);
    
    // Calcular estatísticas
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    
    let redCount = 0;
    let blackCount = 0;
    let evenCount = 0;
    let oddCount = 0;
    const dozenCounts = [0, 0, 0];
    
    recentNumbers.forEach(num => {
      if (num === 0) return;
      
      if (redNumbers.includes(num)) redCount++;
      if (blackNumbers.includes(num)) blackCount++;
      
      if (num % 2 === 0) evenCount++;
      else oddCount++;
      
      if (num >= 1 && num <= 12) dozenCounts[0]++;
      else if (num >= 13 && num <= 24) dozenCounts[1]++;
      else if (num >= 25 && num <= 36) dozenCounts[2]++;
    });
    
    // Calcular percentagens
    const total = recentNumbers.length;
    const redPercentage = parseFloat(((redCount / total) * 100).toFixed(2));
    const blackPercentage = parseFloat(((blackCount / total) * 100).toFixed(2));
    const evenPercentage = parseFloat(((evenCount / total) * 100).toFixed(2));
    const oddPercentage = parseFloat(((oddCount / total) * 100).toFixed(2));
    const dozenPercentages = dozenCounts.map(count => 
      parseFloat(((count / total) * 100).toFixed(2))
    );
    
    // Encontrar hot e cold numbers
    const numFrequency = {};
    recentNumbers.forEach(num => {
      numFrequency[num] = (numFrequency[num] || 0) + 1;
    });
    
    // Ordenar por frequência
    const sortedNumbers = Object.entries(numFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(entry => parseInt(entry[0]));
    
    const hotNumbers = sortedNumbers.slice(0, 4);
    const coldNumbers = sortedNumbers.slice(-4).reverse();
    
    // Identificar tendências
    const trends = [];
    
    // Tendência de cor
    let colorStreak = 1;
    let currentColor = null;
    
    for (let i = 0; i < Math.min(10, latestNumbers.length); i++) {
      const num = latestNumbers[i].numero;
      let color = 'green';
      if (redNumbers.includes(num)) color = 'red';
      else if (blackNumbers.includes(num)) color = 'black';
      
      if (i === 0) {
        currentColor = color;
      } else if (color === currentColor && color !== 'green') {
        colorStreak++;
      } else {
        break;
      }
    }
    
    if (colorStreak >= 3 && currentColor !== 'green') {
      trends.push({ type: 'color', value: currentColor, count: colorStreak });
    }
    
    // Tendência de paridade
    let parityStreak = 1;
    let currentParity = null;
    
    for (let i = 0; i < Math.min(10, latestNumbers.length); i++) {
      const num = latestNumbers[i].numero;
      if (num === 0) continue;
      
      const parity = num % 2 === 0 ? 'even' : 'odd';
      
      if (i === 0 || currentParity === null) {
        currentParity = parity;
      } else if (parity === currentParity) {
        parityStreak++;
      } else {
        break;
      }
    }
    
    if (parityStreak >= 3) {
      trends.push({ type: 'parity', value: currentParity, count: parityStreak });
    }
    
    // Tendência de dúzias
    let dozenStreak = 1;
    let currentDozen = null;
    
    for (let i = 0; i < Math.min(10, latestNumbers.length); i++) {
      const num = latestNumbers[i].numero;
      if (num === 0) continue;
      
      let dozen = null;
      if (num >= 1 && num <= 12) dozen = '1st';
      else if (num >= 13 && num <= 24) dozen = '2nd';
      else if (num >= 25 && num <= 36) dozen = '3rd';
      
      if (i === 0 || currentDozen === null) {
        currentDozen = dozen;
      } else if (dozen === currentDozen) {
        dozenStreak++;
      } else {
        break;
      }
    }
    
    if (dozenStreak >= 3) {
      trends.push({ type: 'dozen', value: currentDozen, count: dozenStreak });
    }
    
    return {
      numbers: {
        recent: recentNumbers,
        raw: recentNumbers,
        redCount,
        blackCount,
        redPercentage,
        blackPercentage,
        evenCount,
        oddCount,
        evenPercentage,
        oddPercentage,
        dozenCounts,
        dozenPercentages,
        hotNumbers,
        coldNumbers
      },
      trends,
      roletaInfo: {
        roletas: latestNumbers.map(entry => ({
          id: entry.roleta_id,
          nome: entry.roleta_nome
        })),
        numerosPorRoleta
      }
    };
  } catch (error) {
    log('❌ Erro ao obter dados reais de roleta:', colors.red);
    log(error.message, colors.red);
    // Em caso de erro, retorna null para que o código possa lidar com isso adequadamente
    return null;
  } finally {
    await client.close();
  }
}

// Testar consulta à API
async function testGeminiQuery() {
  if (!validateConfig()) {
    return;
  }
  
  // Iniciar teste
  log('\n🚀 Iniciando teste de consulta à API Gemini...', colors.cyan);
  
  try {
    // Obter dados reais do MongoDB
    log('🔄 Buscando dados reais do MongoDB...', colors.blue);
    const realRouletteData = await getRouletteData();
    
    if (!realRouletteData) {
      log('❌ Não foi possível obter dados reais do MongoDB. Abortando teste.', colors.red);
      return;
    }
    
    log('✅ Dados reais obtidos com sucesso!', colors.green);
    log('💡 Digite "sair" ou "exit" a qualquer momento para encerrar o programa.', colors.yellow);
    
    // Criar interface readline para entrada do usuário
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Função para fazer perguntas em loop
    const askQuestion = async () => {
      const testQuery = await new Promise(resolve => {
        rl.question('\n💬 Digite sua pergunta sobre roletas: ', answer => {
          resolve(answer);
        });
      });
      
      // Verificar se o usuário quer sair
      if (!testQuery.trim() || testQuery.toLowerCase() === 'sair' || testQuery.toLowerCase() === 'exit') {
        log('👋 Encerrando o programa. Até mais!', colors.yellow);
        rl.close();
        return;
      }
      
      log(`📝 Enviando consulta: "${testQuery}"`, colors.blue);
      log('🔄 Aguardando resposta da API...', colors.blue);
      
      try {
        // A API do Gemini tem um formato diferente das outras
        const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
        
        // Chamada para a API do Gemini
        const geminiResponse = await axios.post(
          apiUrl,
          {
            contents: [
              {
                role: "user",
                parts: [
                  { 
                    text: `Instruções do sistema:
                    Você é um assistente especializado em análise de dados de roletas de cassino.
                    
                    DIRETRIZES PARA SUAS RESPOSTAS:
                    1. Seja EXTREMAMENTE DIRETO E OBJETIVO - vá direto ao ponto.
                    2. Use frases curtas e precisas.
                    3. Organize visualmente suas respostas com:
                       - Marcadores (•) para listas
                       - Texto em **negrito** para destacar números e informações importantes
                       - Tabelas simples quando necessário comparar dados
                       - Espaçamento adequado para melhor legibilidade
                    4. Forneça APENAS as informações solicitadas, sem explicações desnecessárias.
                    5. Se a resposta tiver estatísticas, apresente-as de forma estruturada e visualmente clara.
                    6. Sempre responda em português brasileiro.
                    7. Nunca mencione marcas de IA ou similar nas suas respostas.
                    8. Você é a IA RunCash, especializada em análise de roletas.
                    
                    Dados da roleta: ${JSON.stringify(realRouletteData)}
                    
                    Consulta do usuário: ${testQuery}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
              topP: 0.95,
              topK: 40
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              }
            ]
          },
          { 
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000 // Timeout de 30 segundos
          }
        );
        
        // Processar resposta
        const responseText = geminiResponse.data.candidates[0].content.parts[0].text;
        
        log('\n📝 Resposta da IA RunCash:', colors.magenta);
        log('------------------------', colors.magenta);
        log(responseText);
        log('------------------------', colors.magenta);
        
        // Mostrar detalhes da resposta
        const promptFeedback = geminiResponse.data.promptFeedback || {};
        if (promptFeedback.blockReason) {
          log(`⚠️ Aviso: ${promptFeedback.blockReason}`, colors.yellow);
        }
      } catch (error) {
        log('\n❌ Erro ao processar a consulta:', colors.red);
        if (error.response) {
          log(`Erro ${error.response.status}: ${error.response.statusText}`, colors.red);
        } else {
          log(`Erro: ${error.message}`, colors.red);
        }
      }
      
      // Continuar o loop para mais perguntas
      await askQuestion();
    };
    
    // Iniciar o loop de perguntas
    await askQuestion();
    
  } catch (error) {
    log('\n❌ Erro ao testar API Gemini:', colors.red);
    
    if (error.response) {
      log(`Erro ${error.response.status}: ${error.response.statusText}`, colors.red);
      console.error('Detalhes completos do erro:', JSON.stringify(error.response.data, null, 2));
      
      switch (error.response.status) {
        case 400:
          log('Requisição inválida. Verifique o formato dos dados.', colors.yellow);
          if (error.response.data) {
            log('Detalhes:', JSON.stringify(error.response.data), colors.yellow);
          }
          break;
        case 401:
          log('A chave de API fornecida é inválida ou expirou.', colors.yellow);
          break;
        case 403:
          log('Você não tem permissão para acessar este recurso ou modelo.', colors.yellow);
          break;
        case 404:
          log(`Modelo "${GEMINI_MODEL}" não encontrado ou não disponível na API v1. Verifique o nome do modelo.`, colors.yellow);
          break;
        case 429:
          log('Você excedeu sua cota de requisições ou limites de taxa.', colors.yellow);
          break;
        case 500:
        case 503:
          log('Os servidores do Google estão enfrentando problemas. Tente novamente mais tarde.', colors.yellow);
          break;
        default:
          if (error.response.data) {
            log(`Detalhes: ${JSON.stringify(error.response.data)}`, colors.yellow);
          }
      }
    } else if (error.code === 'ECONNABORTED') {
      log('A conexão expirou. Verifique sua conexão de internet.', colors.yellow);
    } else {
      log(`Erro: ${error.message}`, colors.red);
    }
    
    log('\n💡 Dicas para resolução de problemas:', colors.cyan);
    log('1. Verifique se sua chave de API está correta e não expirou', colors.cyan);
    log('2. Confirme se você habilitou a API Gemini no console do Google Cloud', colors.cyan);
    log('3. Verifique se o modelo selecionado está disponível para sua conta', colors.cyan);
    log('4. Teste com uma conexão de internet estável', colors.cyan);
    log('5. Obtenha uma nova chave em: https://aistudio.google.com/app/apikey', colors.cyan);
  }
}

// Função principal
async function runTests() {
  log('\n🧪 TESTE DE INTEGRAÇÃO COM GEMINI AI 🧪', colors.magenta);
  log('=====================================', colors.magenta);
  
  // Testar a API do Gemini que agora utiliza dados reais do MongoDB
  await testGeminiQuery();
  
  log('\n✅ Testes concluídos!', colors.green);
}

// Executar testes
runTests(); 