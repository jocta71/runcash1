/**
 * API Server para o Runcash
 * Gerencia API REST para histórico de roletas e outros serviços
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const mongodb = require('./libs/mongodb');

// Carregar variáveis de ambiente
dotenv.config();

// Importar rotas
const usersRouter = require('./routes/users');
const strategyRouter = require('./routes/strategy');
const notificationRouter = require('./routes/notification');
const rouletteSearchRouter = require('./routes/rouletteSearch');
const historyRouter = require('./routes/historyApi');

// Configuração do servidor
const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para disponibilizar o banco de dados para todas as requisições
app.use(async (req, res, next) => {
  try {
    if (!mongodb.isConnected()) {
      await mongodb.connect();
    }
    
    // Fazer o banco de dados e funções auxiliares disponíveis em todos os middlewares
    req.app.locals.db = mongodb.getDb();
    req.app.locals.mapToCanonicalId = mongodb.mapToCanonicalId;
    
    next();
  } catch (error) {
    console.error('Erro ao acessar MongoDB no middleware:', error);
    
    // Continuar mesmo se a conexão falhar
    if (process.env.REQUIRE_DB === 'true') {
      return res.status(500).json({ error: 'Banco de dados indisponível' });
    }
    
    next();
  }
});

// Registrar rotas da API
app.use('/api/users', usersRouter);
app.use('/api/strategy', strategyRouter);
app.use('/api/notification', notificationRouter);
app.use('/api/roulette-search', rouletteSearchRouter);
app.use('/api/history', historyRouter);

// Rota de status da API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    mongodb: mongodb.isConnected() ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('Erro global:', err);
  res.status(500).json({
    error: 'Erro interno no servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// Iniciar o servidor
async function startServer() {
  try {
    // Conectar ao MongoDB
    await mongodb.connect();
    
    app.listen(PORT, () => {
      console.log(`API Server rodando na porta ${PORT}`);
      console.log(`Status da API: http://localhost:${PORT}/api/status`);
    });
    
    // Tratar encerramento do servidor
    process.on('SIGINT', async () => {
      console.log('Encerrando o servidor...');
      
      if (mongodb.isConnected()) {
        await mongodb.disconnect();
      }
      
      process.exit(0);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    
    if (process.env.REQUIRE_DB === 'true') {
      console.error('Conexão com MongoDB é obrigatória. Encerrando o servidor.');
      process.exit(1);
    }
    
    // Iniciar mesmo sem MongoDB
    app.listen(PORT, () => {
      console.log(`API Server rodando na porta ${PORT} (sem MongoDB)`);
      console.log(`Status da API: http://localhost:${PORT}/api/status`);
    });
  }
}

// Se este arquivo for executado diretamente, iniciar o servidor
if (require.main === module) {
  startServer();
}

module.exports = app; 