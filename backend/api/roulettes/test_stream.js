/**
 * Teste de streaming SSE para roletas
 * Este script cria um servidor Express simples que implementa um endpoint de streaming
 * para testar se o problema está na implementação do SSE.
 */

const express = require('express');
const app = express();
const port = process.env.PORT || 3003;

// Middleware para CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Rota de status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Roulette SSE Test Server',
    endpoints: [
      '/stream/test',
      '/stream/rounds/ROULETTE/:tableId/v2/live'
    ]
  });
});

// Endpoint de teste básico
app.get('/stream/test', (req, res) => {
  // Configurar cabeçalhos SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Enviar comentário inicial para confirmar conexão
  res.write(': connected to test stream\n\n');
  
  // Função para enviar dados
  const sendData = () => {
    const data = {
      number: Math.floor(Math.random() * 37), // 0-36
      color: ['vermelho', 'preto', 'verde'][Math.floor(Math.random() * 3)],
      timestamp: new Date().toISOString()
    };
    
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Enviar dados iniciais
  sendData();
  
  // Continuar enviando dados a cada 5 segundos
  const interval = setInterval(sendData, 5000);
  
  // Limpar o intervalo quando a conexão for fechada
  req.on('close', () => {
    clearInterval(interval);
    console.log('Conexão fechada');
  });
});

// Endpoint que simula o endpoint de roleta
app.get('/stream/rounds/ROULETTE/:tableId/v2/live', (req, res) => {
  const tableId = req.params.tableId;
  console.log(`Nova conexão para mesa: ${tableId}`);
  
  // Configurar cabeçalhos SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Enviar comentário inicial para confirmar conexão
  res.write(`: connected to roulette stream for table ${tableId}\n\n`);
  
  // Função para simular resultados de roleta
  const sendRouletteData = () => {
    const number = Math.floor(Math.random() * 37); // 0-36
    let color = 'verde';
    
    if (number > 0) {
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      color = redNumbers.includes(number) ? 'vermelho' : 'preto';
    }
    
    const data = {
      number,
      color,
      tableId,
      tableName: `Mesa de Roleta ${tableId}`,
      timestamp: new Date().toISOString(),
      // Simula dados criptografados
      encrypted: `fe26.2**${Math.random().toString(36).substring(2)}**${Math.random().toString(36).substring(2)}`
    };
    
    // Formatação para evento SSE
    res.write(`event: update\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Enviar dados iniciais
  sendRouletteData();
  
  // Continuar enviando dados a cada 10 segundos
  const interval = setInterval(sendRouletteData, 10000);
  
  // Enviar heartbeat a cada 30 segundos para manter a conexão viva
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);
  
  // Limpar os intervalos quando a conexão for fechada
  req.on('close', () => {
    clearInterval(interval);
    clearInterval(heartbeatInterval);
    console.log(`Conexão fechada para mesa: ${tableId}`);
  });
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor de teste rodando em http://localhost:${port}`);
  console.log(`Endpoint de teste: http://localhost:${port}/stream/test`);
  console.log(`Endpoint de roleta: http://localhost:${port}/stream/rounds/ROULETTE/mesa-teste-001/v2/live`);
}); 