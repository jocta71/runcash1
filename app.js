/**
 * Aplicação principal para API de roletas
 * Implementa sistema de autenticação JWT e verificação de assinatura Asaas
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');

// Importar middleware de autenticação e verificação de assinatura
const { autenticar } = require('./backend/middleware/auth');
const { verificarAssinaturaPremium } = require('./backend/middleware/assinaturaAsaas');

// Carregar variáveis de ambiente
dotenv.config();

// Criar app Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging em desenvolvimento
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rota de status para verificar se a API está funcionando
app.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'API de roletas funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Importar e configurar rotas
const authRoutes = require('./routes/authRoutes');
const roletaRoutes = require('./routes/roletaRoutes');

// Configuração de rotas
app.use('/api/auth', authRoutes);

// Nova implementação da API de roletas com autenticação e verificação de assinatura
app.use('/api/roletas', roletaRoutes);

// Redirecionar as chamadas antigas para a nova implementação
app.use('/api/ROULETTES', (req, res, next) => {
    console.log(`[API] Redirecionando requisição de /api/ROULETTES para /api/roletas: ${req.method} ${req.path}`);
    req.url = req.url.replace('/api/ROULETTES', '/api/roletas');
    app._router.handle(req, res, next);
});

app.use('/api/roulettes', (req, res, next) => {
    console.log(`[API] Redirecionando requisição de /api/roulettes para /api/roletas: ${req.method} ${req.path}`);
    req.url = req.url.replace('/api/roulettes', '/api/roletas');
    app._router.handle(req, res, next);
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({
    success: false,
    message: 'Erro interno no servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'ERRO_INTERNO'
  });
});

// Rota 404 para endpoints não encontrados
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    error: 'ROTA_NAO_ENCONTRADA'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em modo ${process.env.NODE_ENV} na porta ${PORT}`);
  console.log(`URL da API: http://localhost:${PORT}/`);
  console.log('Ambiente:', process.env.NODE_ENV || 'development');
});

module.exports = app; 