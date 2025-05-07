const express = require('express');
const cors = require('cors');
const rouletteRouter = require('./roulette');
const asaasRouter = require('./asaas');
const webhookRouter = require('./webhook');
const userRouter = require('./user');
const strategyRouter = require('./strategy');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Healthcheck route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API RunCash funcionando!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Rotas
app.use('/api/roulette', rouletteRouter);
app.use('/api/asaas', asaasRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/user', userRouter);
app.use('/api/strategy', strategyRouter);

// Rota padrão
app.get('/', (req, res) => {
  res.json({
    message: 'API RunCash funcionando!',
    version: '1.0.0',
  });
});

// Porta
const PORT = process.env.PORT || 3000;

// Iniciar servidor
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app; 