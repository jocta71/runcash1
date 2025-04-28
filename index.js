// Arquivo index.js principal
const express = require('express');
const cors = require('cors');
const apiRouter = require('./api');

// Criar a aplicação Express
const app = express();

// Configurar middlewares básicos
app.use(cors({
  origin: ['https://runcashh11.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Verificar se o ambiente está configurado
const PORT = process.env.PORT || 5000;

// Configurar rota raiz para verificação de saúde
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Configurar rota da API
app.use('/api', apiRouter);

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 