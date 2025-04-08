/**
 * Script para testar o sistema de polling inserindo números aleatórios
 * em uma roleta de teste em intervalos regulares.
 */

const axios = require('axios');

// Configurações
const config = {
  apiBaseUrl: process.env.API_URL || 'http://localhost:3002',
  roletaId: process.env.ROLETA_ID || 'test-roleta-1',
  intervalo: parseInt(process.env.INTERVALO || '15000'), // 15 segundos
  numerosTotais: parseInt(process.env.NUMEROS_TOTAIS || '100')
};

let numeroInseridos = 0;

/**
 * Gera um número aleatório de roleta (0-36)
 */
function gerarNumeroAleatorio() {
  return Math.floor(Math.random() * 37);
}

/**
 * Insere um novo número na roleta de teste
 */
async function inserirNovoNumero() {
  try {
    // Gerar um número aleatório
    const numero = gerarNumeroAleatorio();
    
    // Enviar para a API
    const response = await axios.post(
      `${config.apiBaseUrl}/api/roletas/${config.roletaId}/numeros`, 
      { numero }
    );
    
    if (response.status === 201) {
      numeroInseridos++;
      console.log(`[${new Date().toISOString()}] Número ${numero} inserido com sucesso (${numeroInseridos}/${config.numerosTotais})`);
      return true;
    } else {
      console.error('Erro ao inserir número:', response.data);
      return false;
    }
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return false;
  }
}

/**
 * Inicia o processo de inserção de números
 */
async function iniciarTeste() {
  console.log(`
===============================================
  Teste de Polling - Simulador de Roleta
===============================================
URL da API: ${config.apiBaseUrl}
ID da Roleta: ${config.roletaId}
Intervalo: ${config.intervalo}ms
Números a inserir: ${config.numerosTotais}
===============================================
`);
  
  // Inserir primeiro número imediatamente
  await inserirNovoNumero();
  
  // Configurar intervalo para os próximos números
  const interval = setInterval(async () => {
    await inserirNovoNumero();
    
    // Verificar se atingimos o número total
    if (numeroInseridos >= config.numerosTotais) {
      clearInterval(interval);
      console.log('\nTeste concluído! Todos os números foram inseridos.');
      process.exit(0);
    }
  }, config.intervalo);
  
  // Permitir interrupção com Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\nTeste interrompido manualmente.');
    process.exit(0);
  });
}

// Iniciar o teste
iniciarTeste(); 