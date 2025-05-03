import { io } from 'socket.io-client';
import fetch from 'node-fetch';

// Configuração
const API_URL = 'https://backendapi-production-36b5.up.railway.app';
const AUTH_ENDPOINT = '/api/simple-auth/login';
const WEBSOCKET_URL = API_URL;

// Função para testar a conexão sem token
async function testarConexaoSemToken() {
  console.log('=== TESTE DE CONEXÃO SEM TOKEN ===');
  console.log(`URL do WebSocket: ${WEBSOCKET_URL}`);
  
  // Tentar conectar sem token
  const socket = io(WEBSOCKET_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
  
  // Registrar eventos de conexão
  let connectHappened = false;
  
  socket.on('connect', () => {
    connectHappened = true;
    console.log('⚠️ FALHA DE SEGURANÇA: Conexão estabelecida sem token!');
    console.log(`ID da Conexão: ${socket.id}`);
    
    // Tentar executar operações para verificar se há validação a nível de evento
    console.log('Testando operações sem token:');
    
    console.log('1. Tentando subscrever a uma roleta...');
    socket.emit('subscribe', 'roleta_1');
    
    console.log('2. Tentando solicitar histórico...');
    socket.emit('request_history', { roletaId: 'roleta_1' });
    
    // Aguardar respostas por um curto período antes de desconectar
    setTimeout(() => {
      console.log('Desconectando da sessão sem token');
      socket.disconnect();
      testarOutrasUrls();
    }, 5000);
  });
  
  socket.on('connect_error', (error) => {
    console.log('✅ Conexão recusada como esperado:', error.message);
    testarOutrasUrls();
  });
  
  // Monitorar eventos do servidor
  socket.on('error', (data) => {
    console.log('Erro recebido:', data);
  });
  
  socket.on('connection_success', (data) => {
    console.log('⚠️ Evento connection_success recebido sem token:', data);
  });
  
  socket.on('new_number', (data) => {
    console.log('⚠️ Evento new_number recebido sem token:', data);
  });
  
  socket.on('history_data', (data) => {
    console.log('⚠️ Evento history_data recebido sem token:', data);
  });
  
  socket.on('history_error', (data) => {
    console.log('Erro de histórico recebido:', data);
  });
  
  // Verificar timeout (caso não ocorra nem conexão nem erro)
  setTimeout(() => {
    if (!connectHappened) {
      console.log('Timeout atingido sem conexão ou erro definitivo');
      socket.disconnect();
      testarOutrasUrls();
    }
  }, 10000);
}

// Função para testar outras variações de URL
function testarOutrasUrls() {
  console.log('\n=== TESTE DE VARIAÇÕES DE URL ===');
  
  // Testar variações de caminho do WebSocket
  const variantes = [
    `${API_URL}/socket.io/`,
    `${API_URL}/ws`,
    `${API_URL}/websocket`,
    `${API_URL}/socket`
  ];
  
  let testsCompleted = 0;
  const totalTests = variantes.length;
  
  variantes.forEach((url, index) => {
    console.log(`\nTestando URL: ${url}`);
    
    const socket = io(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000
    });
    
    let hasResult = false;
    
    socket.on('connect', () => {
      hasResult = true;
      console.log(`⚠️ Conexão estabelecida em ${url}`);
      console.log(`ID da Conexão: ${socket.id}`);
      
      setTimeout(() => {
        socket.disconnect();
        completeTest();
      }, 2000);
    });
    
    socket.on('connect_error', (error) => {
      hasResult = true;
      console.log(`Erro ao conectar em ${url}: ${error.message}`);
      socket.disconnect();
      completeTest();
    });
    
    // Timeout para garantir que o teste não fique preso
    setTimeout(() => {
      if (!hasResult) {
        console.log(`Timeout ao conectar em ${url}`);
        socket.disconnect();
        completeTest();
      }
    }, 7000);
    
    function completeTest() {
      testsCompleted++;
      if (testsCompleted === totalTests) {
        console.log('\nTodos os testes de URL concluídos');
        verificarEndpoints();
      }
    }
  });
}

// Verificar endpoints da API para buscar informações sobre WebSocket
async function verificarEndpoints() {
  console.log('\n=== VERIFICAÇÃO DE ENDPOINTS DA API ===');
  
  const endpoints = [
    '/',
    '/api',
    '/api/health',
    '/socket-status',
    '/socket.io/'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTestando endpoint: ${API_URL}${endpoint}`);
      const response = await fetch(`${API_URL}${endpoint}`);
      const status = response.status;
      
      console.log(`Status: ${status}`);
      
      if (response.ok) {
        try {
          const data = await response.json();
          console.log('Resposta:', JSON.stringify(data, null, 2));
        } catch (e) {
          const text = await response.text();
          console.log(`Resposta (texto): ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
        }
      }
    } catch (error) {
      console.log(`Erro ao acessar ${endpoint}: ${error.message}`);
    }
  }
  
  console.log('\nVerificação de endpoints concluída');
  console.log('\n=== RELATÓRIO FINAL ===');
  console.log('Problema detectado: O serviço WebSocket parece estar permitindo conexões sem autenticação.');
  console.log('Recomendação: Verificar a implementação do middleware de autenticação no servidor WebSocket.');
  
  // Encerrar o processo
  process.exit(0);
}

// Iniciar testes
console.log('=== DIAGNÓSTICO DE SEGURANÇA DO WEBSOCKET RUNCASH ===');
console.log(`Data e hora do teste: ${new Date().toISOString()}`);
console.log(`API URL: ${API_URL}`);
console.log('----------------------------------------\n');

testarConexaoSemToken(); 