/**
 * Aplicação principal Express
 * Configura middlewares globais e registra todas as rotas
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config();

// Importar rotas
const apiRoutes = require('./api/routes');

// Criar aplicação Express
const app = express();

// Configurar middlewares globais
app.use(helmet()); // Segurança
app.use(cors()); // CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded

// Registrar rotas da API
app.use('/api', apiRoutes);

// Servir frontend estático em produção
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Rota padrão
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API RunCash funcionando!',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Configurar porta
const PORT = process.env.PORT || 5000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} em modo ${process.env.NODE_ENV || 'development'}`);
  console.log(`API disponível em http://localhost:${PORT}/api`);
});

module.exports = app; 