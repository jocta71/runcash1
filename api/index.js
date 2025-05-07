const express = require('express');
const cors = require('cors');
const rouletteRouter = require('./roulette');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rotas
app.use('/api', rouletteRouter);

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