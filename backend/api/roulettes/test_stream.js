/**
 * Teste de streaming SSE para roletas
 * Este script cria um servidor Express simples que implementa um endpoint de streaming
 * para testar se o problema está na implementação do SSE.
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const port = process.env.PORT || 3003;

// Chave mestra simulada para criptografia
const MASTER_KEY = 'wh4t3v3r-y0u-w4nt-th1s-t0-b3-32-ch4rs';

// Middleware para CORS
app.use(cors());

// Função para gerar um número aleatório de roleta (0-36)
function generateRandomNumber() {
  return Math.floor(Math.random() * 37);
}

// Função para determinar a cor com base no número
function getColor(number) {
  if (number === 0) return 'verde';
  if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number)) {
    return 'vermelho';
  }
  return 'preto';
}

// Função para simular a criptografia dos dados da roleta (Fe26.2 format)
function encryptRouletteData(data) {
  // Adicionar timestamp se não existir
  if (!data.timestamp) {
    data.timestamp = new Date().toISOString();
  }
  
  // Converter dados para string JSON
  const jsonData = JSON.stringify(data);
  
  // Simulação de criptografia Fe26.2 format
  // Em um sistema real, usaríamos @hapi/iron para selar os dados
  
  // Gerar partes aleatórias para simular o token Fe26.2
  const randomId = crypto.randomBytes(8).toString('hex');
  const randomMac = crypto.randomBytes(12).toString('hex');
  const randomIv = crypto.randomBytes(8).toString('hex');
  
  // Codificar dados em base64
  const encodedData = Buffer.from(jsonData).toString('base64');
  
  // Criar token Fe26.2 simulado
  return `fe26.2**${randomId}**${randomIv}**${encodedData}**${randomMac}`;
}

// Middleware para Server-Sent Events
function sseMiddleware(req, res, next) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Enviar um comentário como heartbeat a cada 15 segundos
  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 15000);
  
  // Limpar intervalo quando a conexão for fechada
  req.on('close', () => {
    console.log('Cliente desconectado');
    clearInterval(heartbeat);
  });
  
  next();
}

// Rota de status
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Roulette SSE Test Server (com criptografia)',
    endpoints: [
      '/stream/test',
      '/stream/rounds/ROULETTE/:tableId/v2/live'
    ]
  });
});

// Endpoint de teste para streaming de dados
app.get('/stream/test', sseMiddleware, (req, res) => {
  console.log('Cliente conectado ao endpoint de teste');
  
  // Intervalo para enviar eventos a cada 3 segundos
  const interval = setInterval(() => {
    const number = generateRandomNumber();
    const color = getColor(number);
    
    // Criar dados da roleta
    const data = {
      number,
      color,
      tableId: 'mesa-teste-001',
      tableName: 'Mesa de Teste 001',
      timestamp: new Date().toISOString()
    };
    
    console.log('Enviando dados (original):', data);
    
    // Criptografar os dados
    const encryptedData = encryptRouletteData(data);
    console.log('Enviando dados (criptografados):', encryptedData.substring(0, 40) + '...');
    
    // Enviar dados criptografados
    res.write(`data: ${encryptedData}\n\n`);
  }, 3000);
  
  // Limpar intervalo quando a conexão for fechada
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Endpoint para streaming de dados de roleta específica
app.get('/stream/rounds/ROULETTE/:tableId/v2/live', sseMiddleware, (req, res) => {
  const tableId = req.params.tableId;
  console.log(`Cliente conectado ao stream da roleta: ${tableId}`);
  
  // Enviar um evento inicial
  res.write(`event: connected\ndata: {"tableId":"${tableId}","status":"connected"}\n\n`);
  
  // Intervalo para enviar eventos de atualização a cada 5 segundos
  const interval = setInterval(() => {
    const number = generateRandomNumber();
    const color = getColor(number);
    
    // Criar dados da roleta
    const data = {
      number,
      color,
      tableId,
      tableName: `Mesa de Roleta ${tableId}`,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Enviando atualização para ${tableId} (original):`, data);
    
    // Criptografar os dados
    const encryptedData = encryptRouletteData(data);
    console.log(`Enviando atualização para ${tableId} (criptografada):`, encryptedData.substring(0, 40) + '...');
    
    // Enviar evento de atualização com dados criptografados
    res.write(`event: update\ndata: ${encryptedData}\n\n`);
  }, 5000);
  
  // Limpar intervalo quando a conexão for fechada
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Endpoint para documentação da API
app.get('/docs', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Documentação do Servidor de Teste SSE</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.5; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
          .endpoint { margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Documentação do Servidor de Teste SSE</h1>
        <p>Este servidor simula endpoints SSE para testes da API de roletas.</p>
        
        <div class="endpoint">
          <h2>GET /stream/test</h2>
          <p>Endpoint simples que envia dados aleatórios criptografados a cada 5 segundos.</p>
          <pre>curl -N http://localhost:${port}/stream/test</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /stream/rounds/ROULETTE/:tableId/v2/live</h2>
          <p>Simula o endpoint real da API de roletas, enviando resultados criptografados a cada 10 segundos.</p>
          <pre>curl -N http://localhost:${port}/stream/rounds/ROULETTE/mesa-teste-001/v2/live</pre>
        </div>
        
        <h2>Formato dos Dados</h2>
        <p>Os dados são transmitidos usando Server-Sent Events (SSE) e criptografados usando formato Fe26.2.</p>
        <p>Em um sistema real, o cliente usaria uma chave para descriptografar esses dados.</p>
      </body>
    </html>
  `);
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor de teste rodando em http://localhost:${port}`);
  console.log(`Endpoint de teste: http://localhost:${port}/stream/test`);
  console.log(`Endpoint de roleta: http://localhost:${port}/stream/rounds/ROULETTE/mesa-teste-001/v2/live`);
  console.log(`Documentação: http://localhost:${port}/docs`);
}); 