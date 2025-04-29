/**
 * Ponto de entrada da aplicação
 * Carrega variáveis de ambiente e inicializa o servidor
 */

// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

// Suporte para socket.io
const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Cria o app Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Tenta carregar o servidor de webhook diretamente
try {
  console.log('Verificando se o webhook-server existe...');
  const webhookServerPath = path.join(__dirname, 'webhook-server.js');
  
  if (fs.existsSync(webhookServerPath)) {
    console.log('Servidor de webhook encontrado. Iniciando...');
    // Inicia o webhook em um processo separado para evitar conflitos
    const { fork } = require('child_process');
    const webhookProcess = fork(webhookServerPath);
    
    webhookProcess.on('message', (message) => {
      console.log('Mensagem do webhook server:', message);
    });
    
    webhookProcess.on('error', (err) => {
      console.error('Erro no webhook server:', err);
    });
    
    console.log('Webhook server iniciado como um processo separado');
  } else {
    console.log('Arquivo webhook-server.js não encontrado');
  }
} catch (error) {
  console.error('Erro ao carregar webhook-server:', error.message);
}

// Configuração do Socket.IO
io.on('connection', (socket) => {
  console.log('Novo cliente conectado');
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
  
  // Exemplo de evento personalizado
  socket.on('message', (message) => {
    console.log('Mensagem recebida:', message);
    
    // Envia a mensagem para todos os clientes conectados
    io.emit('message', message);
  });
});

// Define a porta para o socket.io
const PORT = process.env.SOCKET_PORT || 3031;
server.listen(PORT, () => {
  console.log(`Servidor Socket.IO iniciado na porta ${PORT}`);
});

// Log da inicialização
console.log(`
 _____               _    _           _     _____                          
|  _  |___ ___ ___ _| |  | |_ ___ ___| |_  |   __|___ ___ _ _ ___ ___ ___ 
|     |_ -| .'| .'| . |  |   | -_| . | '_| |__   | -_|  _| | | -_|  _|_ -|
|__|__|___|__,|__,|___|  |_|_|___|___|_,_| |_____|___|_|  \\_/|___|_| |___|
                                                                         
Servidor de Socket.IO - Versão ${require('../../package.json').version}
`);