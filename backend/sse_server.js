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
  let lastTimestamp = new Date(0); // Iniciar com data mínima

  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }
  console.log(`[Polling] Iniciando busca de dados a cada ${POLL_INTERVAL}ms`);

  const runPoll = async () => {
    if (!collection) {
      console.warn('[Polling] Coleção MongoDB não disponível');
      return;
    }

    try {
      const query = { timestamp: { $gt: lastTimestamp } };
      console.log(`[Polling] Buscando dados com timestamp > ${lastTimestamp.toISOString()}`)
      const newDocuments = await collection.find(query)
                                    .sort({ timestamp: 1 }) // Processar em ordem cronológica
                                    .toArray();

      if (newDocuments.length > 0) {
        console.log(`[Polling] Encontrados ${newDocuments.length} novos documentos`);
        let latestDocTimestamp = lastTimestamp;

        newDocuments.forEach(doc => {
          // Formatar o evento no padrão esperado pelo frontend
          const eventData = {
            type: 'update', // Ou 'new_number', 'numero' - verificar o que o frontend realmente usa
            data: {
              roleta_id: doc.roleta_id,
              roleta_nome: doc.roleta_nome,
              numero: doc.numero,
              cor: doc.cor,
              timestamp: doc.timestamp.toISOString() // Enviar como ISO string
              // Adicionar outros campos se necessário (ex: provider, status, sequencia)
            }
          };
          sendEventToClients(eventData);

          // Atualizar o timestamp do último documento processado
          if (doc.timestamp > latestDocTimestamp) {
            latestDocTimestamp = doc.timestamp;
          }
        });

        // Atualizar o timestamp global para a próxima busca
        lastTimestamp = latestDocTimestamp;
        console.log(`[Polling] Último timestamp processado: ${lastTimestamp.toISOString()}`);
      } else {
        console.log('[Polling] Nenhum novo documento encontrado');
      }

    } catch (error) {
      console.error('[Polling] Erro ao buscar dados:', error);
    }
  };

  // Executar o polling imediatamente uma vez e depois no intervalo
  runPoll();
  pollingIntervalId = setInterval(runPoll, POLL_INTERVAL);
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor SSE rodando na porta ${PORT}`);
  connectToMongoDB(); // Conectar ao MongoDB ao iniciar
});

// Lidar com finalização graciosa
process.on('SIGINT', async () => { // Adicionado async
  console.log('\n[Servidor] Desligando servidor SSE...');
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }
  // Fechar conexão MongoDB
  if (db && db.client) {
    try {
      await db.client.close();
      console.log('[MongoDB] Conexão fechada com sucesso.');
    } catch (err) {
      console.error('[MongoDB] Erro ao fechar conexão:', err);
    }
  }
  process.exit(0);
}); 