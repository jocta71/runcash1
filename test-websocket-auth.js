import { io } from 'socket.io-client';
import fetch from 'node-fetch';

// Configuração
const API_URL = 'https://backendapi-production-36b5.up.railway.app';
const AUTH_ENDPOINT = '/api/simple-auth/login';
const WEBSOCKET_URL = API_URL;

// Credenciais (substitua por credenciais válidas)
const USERNAME = 'usuario_teste';
const PASSWORD = 'senha_teste';

// Função para obter token JWT
async function obterToken() {
  console.log('Obtendo token de autenticação...');
  
  try {
    const response = await fetch(`${API_URL}${AUTH_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      console.log('✅ Token obtido com sucesso!');
      return data.token;
    } else {
      throw new Error(data.message || 'Falha na autenticação');
    }
  } catch (error) {
    console.error('❌ Erro ao obter token:', error.message);
    return null;
  }
}

// Testar conexão WebSocket com token
async function testarWebSocketComToken() {
  console.log('Iniciando teste de WebSocket com autenticação...');
  
  // Obter token
  const token = await obterToken();
  
  if (!token) {
    console.error('❌ Não foi possível obter token, teste cancelado.');
    return;
  }
  
  console.log('Conectando ao WebSocket com token...');
  console.log(`URL do WebSocket: ${WEBSOCKET_URL}`);
  
  // Método 1: Token como parâmetro de consulta
  const socket = io(WEBSOCKET_URL, {
    query: { token },
    transports: ['websocket'],
    forceNew: true
  });
  
  // Eventos de conexão
  socket.on('connect', () => {
    console.log('✅ Conectado ao WebSocket com sucesso!');
    console.log(`ID da conexão: ${socket.id}`);
    
    // Após conexão bem-sucedida, testar subscrição a uma roleta
    console.log('Subscribing to roleta_1...');
    socket.emit('subscribe', 'roleta_1');
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Erro de conexão:', error.message);
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`Desconectado: ${reason}`);
  });
  
  // Eventos específicos do servidor
  socket.on('error', (data) => {
    console.error('❌ Erro do servidor:', data);
  });
  
  socket.on('connection_success', (data) => {
    console.log('✅ Conexão bem-sucedida:', data);
  });
  
  socket.on('new_number', (data) => {
    console.log('📊 Novo número recebido:', data);
  });
  
  socket.on('global_new_number', (data) => {
    console.log('🌐 Novo número global:', data);
  });
  
  socket.on('strategy_update', (data) => {
    console.log('📈 Atualização de estratégia:', data);
  });
  
  // Manter a conexão aberta por um tempo
  setTimeout(() => {
    console.log('Desconectando...');
    socket.disconnect();
    process.exit(0);
  }, 30000); // 30 segundos
}

// Testar conexão WebSocket sem token (deve falhar)
function testarWebSocketSemToken() {
  console.log('Iniciando teste de WebSocket SEM autenticação (deve falhar)...');
  console.log(`URL do WebSocket: ${WEBSOCKET_URL}`);
  
  const socket = io(WEBSOCKET_URL, {
    transports: ['websocket'],
    forceNew: true
  });
  
  socket.on('connect', () => {
    console.log('⚠️ Conectado sem token! Isso indica um problema de segurança!');
    socket.disconnect();
  });
  
  socket.on('connect_error', (error) => {
    console.log('✅ Erro de conexão esperado (conexão sem token rejeitada):', error.message);
    setTimeout(() => {
      testarWebSocketComToken();
    }, 1000);
  });
}

// Iniciar testes
console.log('=== TESTE DE AUTENTICAÇÃO WEBSOCKET RUNCASH ===');
testarWebSocketSemToken(); 