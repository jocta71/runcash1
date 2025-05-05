/**
 * Script para iniciar a API unificada de roletas
 * Este é um script simplificado para iniciar apenas a parte da API relacionada às roletas
 * sem depender de todas as outras partes do sistema.
 */

const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Importar roteadores
const rouletteRoutes = require('./api/roulettes/routes');

// Configuração
const PORT = process.env.UNIFIED_API_PORT || 3005;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME;

// Criar aplicação Express
const app = express();

// Configuração CORS
app.use(cors({
  origin: '*', // Para teste, permite qualquer origem
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 
                 'ngrok-skip-browser-warning', 'bypass-tunnel-reminder', 'cache-control', 'pragma'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    console.log(`[API Unificada] Conectando ao MongoDB: ${MONGODB_URI.replace(/:.*@/, ':****@')}`);
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('[API Unificada] Conectado ao MongoDB com sucesso');
    const db = client.db(DB_NAME);
    console.log(`[API Unificada] Usando banco de dados: ${DB_NAME}`);
    return db;
  } catch (error) {
    console.error('[API Unificada] Erro ao conectar ao MongoDB:', error);
    return null;
  }
}

// Iniciar o servidor
async function startServer() {
  // Conectar ao MongoDB
  const db = await connectToMongoDB();
  
  // Disponibilizar o banco de dados para os roteadores
  app.locals.db = db;
  
  // Middleware para bypassar a autenticação para testes
  app.use((req, res, next) => {
    // Simular um usuário autenticado para testes
    req.user = {
      id: 'teste-user-id',
      username: 'teste-user',
      role: 'admin'
    };
    next();
  });
  
  // Configurar rotas
  app.use('/api/roulettes', rouletteRoutes);
  
  // Rota de boas-vindas
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <head>
          <title>API Unificada de Roletas</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.5; }
            pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
            .endpoint { margin-bottom: 20px; }
            code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>API Unificada de Roletas</h1>
          <p>Esta API implementa o modelo unificado de acesso aos dados de roletas com criptografia.</p>
          
          <div class="endpoint">
            <h2>POST /api/roulettes/keys/generate</h2>
            <p>Gera uma chave de cliente para descriptografar os dados.</p>
            <pre>curl -X POST http://localhost:${PORT}/api/roulettes/keys/generate</pre>
          </div>
          
          <div class="endpoint">
            <h2>GET /api/roulettes/all</h2>
            <p>Retorna todas as roletas com seus históricos de números.</p>
            <pre>curl http://localhost:${PORT}/api/roulettes/all</pre>
            <pre>curl "http://localhost:${PORT}/api/roulettes/all?k=SUA_CHAVE_AQUI"</pre>
          </div>
          
          <div class="endpoint">
            <h2>GET /api/roulettes/compact</h2>
            <p>Retorna todas as roletas em formato condensado.</p>
            <pre>curl http://localhost:${PORT}/api/roulettes/compact</pre>
            <pre>curl "http://localhost:${PORT}/api/roulettes/compact?k=SUA_CHAVE_AQUI"</pre>
          </div>
          
          <div class="endpoint">
            <h2>GET /api/roulettes/consolidated</h2>
            <p>Retorna um formato consolidado dos dados das roletas.</p>
            <pre>curl http://localhost:${PORT}/api/roulettes/consolidated</pre>
            <pre>curl "http://localhost:${PORT}/api/roulettes/consolidated?k=SUA_CHAVE_AQUI"</pre>
          </div>
          
          <div class="endpoint">
            <h2>GET /api/roulettes/events</h2>
            <p>Retorna dados no formato de eventos (sem streaming).</p>
            <pre>curl http://localhost:${PORT}/api/roulettes/events</pre>
          </div>
          
          <div class="endpoint">
            <h2>GET /api/roulettes/events/all-in-one</h2>
            <p>Retorna todas as roletas em um único evento.</p>
            <pre>curl http://localhost:${PORT}/api/roulettes/events/all-in-one</pre>
            <pre>curl "http://localhost:${PORT}/api/roulettes/events/all-in-one?max_roletas=5&max_numeros=10"</pre>
          </div>
        </body>
      </html>
    `);
  });
  
  // Iniciar o servidor
  app.listen(PORT, () => {
    console.log(`[API Unificada] Servidor rodando em http://localhost:${PORT}`);
    console.log('[API Unificada] Endpoints disponíveis:');
    console.log('- POST /api/roulettes/keys/generate');
    console.log('- GET /api/roulettes/all');
    console.log('- GET /api/roulettes/compact');
    console.log('- GET /api/roulettes/consolidated');
    console.log('- GET /api/roulettes/events');
    console.log('- GET /api/roulettes/events/all-in-one');
  });
}

// Iniciar o servidor
startServer().catch(error => {
  console.error('[API Unificada] Erro fatal ao iniciar o servidor:', error);
  process.exit(1);
}); 