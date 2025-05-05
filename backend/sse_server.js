const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5001; // Usar uma porta diferente do antigo WebSocket, se necessário
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = process.env.SSE_POLL_INTERVAL || 2000; // Intervalo para buscar dados do MongoDB
const JWT_SECRET = process.env.JWT_SECRET || 'runcashh_secret_key'; // Chave para validar tokens (se aplicável ao SSE)

console.log('==== Configuração do Servidor SSE ====');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log(`COLLECTION_NAME: ${COLLECTION_NAME}`);
console.log(`POLL_INTERVAL: ${POLL_INTERVAL}ms`);
console.log(`JWT_SECRET: ${JWT_SECRET ? '******' : 'Não definido'}`);

const app = express();

// Middlewares básicos
app.use(cors()); // Habilitar CORS para todas as origens
app.use(express.json());

// Armazenar clientes SSE conectados
let clients = [];

// Função para enviar dados para todos os clientes conectados
function sendEventToClients(data) {
  const formattedData = `data: ${JSON.stringify(data)}\n\n`;
  console.log(`[SSE] Enviando ${data.type || 'evento'} para ${clients.length} clientes`);
  clients.forEach(client => client.res.write(formattedData));
}

// Endpoint SSE principal para roletas
app.get('/api/stream/roulettes', (req, res) => {
  const clientId = Date.now();
  console.log(`[SSE] Cliente conectado: ${clientId}`);

  // Configurar headers para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permitir todas as origens
  res.flushHeaders(); // Enviar headers imediatamente

  // Adicionar cliente à lista
  const newClient = { id: clientId, res };
  clients.push(newClient);

  // Enviar mensagem de conexão inicial (opcional)
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Lidar com desconexão do cliente
  req.on('close', () => {
    console.log(`[SSE] Cliente desconectado: ${clientId}`);
    clients = clients.filter(client => client.id !== clientId);
    res.end(); // Finalizar a resposta no servidor
  });

  // Lidar com erros na conexão
  req.on('error', (err) => {
    console.error(`[SSE] Erro na conexão do cliente ${clientId}:`, err);
    clients = clients.filter(client => client.id !== clientId);
    res.end();
  });

  // TODO: Enviar dados históricos iniciais ou estado atual aqui, se necessário
  // Exemplo: sendInitialData(newClient);
});

// Endpoint de health check
app.get('/api/sse/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash SSE Server',
    connectedClients: clients.length,
    timestamp: new Date().toISOString()
  });
});

// Conexão com MongoDB e lógica de polling
let db, collection;
let pollingIntervalId = null;

async function connectToMongoDB() {
  try {
    console.log('[MongoDB] Tentando conectar...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('runcash'); // Usar banco de dados explícito
    collection = db.collection(COLLECTION_NAME);
    console.log('[MongoDB] Conectado com sucesso!');
    startPolling(); // Iniciar polling após conectar
  } catch (error) {
    console.error('[MongoDB] Erro ao conectar:', error);
    // Tentar reconectar após um tempo
    setTimeout(connectToMongoDB, 5000);
  }
}

function startPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }
  console.log(`[Polling] Iniciando busca de dados a cada ${POLL_INTERVAL}ms`);
  pollingIntervalId = setInterval(async () => {
    if (!collection) return;

    try {
      // TODO: Implementar lógica para buscar apenas dados *novos* desde a última busca
      // Exemplo: Buscar documentos com timestamp maior que o último enviado

      // Exemplo simples: Buscar os últimos dados (precisa melhorar para eficiência)
      const latestData = await collection.find()
                           .sort({ timestamp: -1 })
                           .limit(10) // Limitar para exemplo
                           .toArray();

      if (latestData.length > 0) {
         // TODO: Processar e formatar os dados antes de enviar
         // Exemplo: Enviar o número mais recente
         const latestNumberEvent = {
             type: 'update', // Ou 'numero', 'new_number' - alinhar com frontend
             data: latestData[0] // Exemplo: envia apenas o mais recente
         };
         sendEventToClients(latestNumberEvent);
      }

    } catch (error) {
      console.error('[Polling] Erro ao buscar dados:', error);
    }
  }, POLL_INTERVAL);
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor SSE rodando na porta ${PORT}`);
  connectToMongoDB(); // Conectar ao MongoDB ao iniciar
});

// Lidar com finalização graciosa
process.on('SIGINT', () => {
  console.log('\n[Servidor] Desligando servidor SSE...');
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }
  // TODO: Fechar conexão MongoDB se necessário
  process.exit(0);
}); 