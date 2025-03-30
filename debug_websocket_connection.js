/**
 * Script para diagnosticar problemas de conexão WebSocket
 * 
 * Este script tenta estabelecer uma conexão WebSocket com o servidor
 * e imprime informações detalhadas sobre o processo de conexão.
 */

const { io } = require("socket.io-client");
const readline = require('readline');
require('dotenv').config();

// Obter o URL do WebSocket do ambiente ou usar um padrão
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || "wss://runcash1-production.up.railway.app";

// Criar interface de linha de comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Imprimir cabeçalho
console.log("===== Diagnóstico de Conexão WebSocket =====");
console.log(`URL do servidor: ${WEBSOCKET_URL}`);
console.log("-------------------------------------------");

// Configuração de debug para o socket.io-client
process.env.DEBUG = "socket.io-client:*";

// Pergunta ao usuário qual URL usar
rl.question(`Usar o URL padrão (${WEBSOCKET_URL})? (S/n): `, (answer) => {
  let url = WEBSOCKET_URL;
  
  if (answer.toLowerCase() === 'n') {
    rl.question("Digite o URL do WebSocket: ", (customUrl) => {
      url = customUrl;
      connectToWebSocket(url);
    });
  } else {
    connectToWebSocket(url);
  }
});

function connectToWebSocket(url) {
  console.log(`\nIniciando conexão com ${url}...`);
  
  // Criar socket com opções avançadas
  const socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
    forceNew: true,
    extraHeaders: {
      "User-Agent": "WebSocketDiagnosticTool/1.0"
    }
  });
  
  // Eventos do ciclo de vida da conexão
  socket.on("connect_error", (err) => {
    console.error(`\n❌ Erro de conexão: ${err.message}`);
    console.error(`Detalhes: ${JSON.stringify(err)}`);
    
    if (err.message.includes("xhr poll error")) {
      console.log("\n🔍 Diagnóstico: Erro de XHR Poll - Pode ser um problema de CORS ou proxy");
      console.log("Sugestões:");
      console.log("1. Verifique se o servidor está permitindo conexões de sua origem");
      console.log("2. Verifique se há um proxy/firewall bloqueando a conexão");
      console.log("3. Tente acessar o endpoint HTTP do servidor para verificar se está respondendo");
    } else if (err.message.includes("timeout")) {
      console.log("\n🔍 Diagnóstico: Timeout de conexão");
      console.log("Sugestões:");
      console.log("1. Verifique se o servidor está online");
      console.log("2. Verifique se há problemas de rede que podem estar causando latência");
      console.log("3. Aumente o valor do timeout na configuração do cliente");
    }
  });
  
  socket.on("connect", () => {
    console.log("\n✅ Conexão estabelecida com sucesso!");
    console.log(`ID do socket: ${socket.id}`);
    console.log("Protocolo de transporte: " + socket.io.engine.transport.name);
    
    // Emitir evento de teste
    console.log("\nEnviando evento de teste...");
    socket.emit("test", { message: "Hello from diagnostic tool" });
    
    // Solicitar status do servidor
    console.log("Solicitando status do servidor...");
    socket.emit("get_status");
  });
  
  socket.on("disconnect", (reason) => {
    console.log(`\n⚠️ Desconectado: ${reason}`);
    if (reason === "io server disconnect") {
      console.log("O servidor forçou a desconexão");
    } else if (reason === "transport close") {
      console.log("🔍 Diagnóstico: A conexão de transporte foi fechada");
      console.log("Isso pode acontecer se o servidor estiver usando um proxy sem suporte adequado a WebSockets");
    } else if (reason === "ping timeout") {
      console.log("🔍 Diagnóstico: Timeout de ping");
      console.log("O servidor não está respondendo aos pings do cliente");
    }
  });
  
  socket.on("error", (error) => {
    console.error(`\n❌ Erro geral: ${error.message}`);
  });
  
  // Evento para upgrade de transporte
  socket.io.engine.on("upgrade", (transport) => {
    console.log(`\n🔄 Upgrade de transporte: ${transport.name}`);
  });
  
  // Eventos específicos da aplicação
  socket.on("connection_status", (data) => {
    console.log("\n🔄 Status de conexão recebido:");
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on("global_update", (data) => {
    console.log("\n📊 Atualização global recebida:");
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on("strategy_update", (data) => {
    console.log("\n📊 Atualização de estratégia recebida:");
    console.log(JSON.stringify(data, null, 2));
  });
  
  // Aguardar eventos por 30 segundos e depois fechar
  console.log("\nAguardando eventos por 30 segundos...");
  setTimeout(() => {
    console.log("\n⏱️ Tempo esgotado. Encerrando conexão...");
    socket.disconnect();
    
    console.log("\n===== Resumo do Diagnóstico =====");
    console.log(`URL: ${url}`);
    console.log(`Estado da conexão: ${socket.connected ? "Conectado" : "Desconectado"}`);
    if (socket.connected) {
      console.log(`ID do Socket: ${socket.id}`);
      console.log(`Transporte: ${socket.io.engine.transport.name}`);
    }
    console.log("===============================");
    
    rl.close();
  }, 30000);
}

// Evento quando o usuário encerra o programa
rl.on('close', () => {
  console.log('Diagnóstico de WebSocket encerrado.');
  process.exit(0);
}); 