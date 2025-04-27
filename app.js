/**
 * Aplicação principal para API de roletas
 * Implementa sistema de autenticação JWT e verificação de assinatura Asaas
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Criar app Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const roletaRoutes = require('./routes/roletaRoutes');
app.use('/api/roletas', roletaRoutes);

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`URL da API: http://localhost:${PORT}/`);
  console.log('Ambiente:', process.env.NODE_ENV || 'development');
});

module.exports = app; 