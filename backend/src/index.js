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

// Cria o app Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Importa o servidor de webhook
require('./webhook-server');

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
                                                                         
Servidor de Webhook Asaas - Versão ${require('../../package.json').version}
`);