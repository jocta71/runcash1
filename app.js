/**
 * Aplicação principal para API de roletas
 * Implementa sistema de autenticação JWT e verificação de assinatura Asaas
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');

// Importar middleware de autenticação e verificação de assinatura
const { autenticar } = require('./backend/middleware/auth');
const { verificarAssinaturaPremium } = require('./backend/middleware/assinaturaAsaas');

// Importar middleware de verificação de assinatura das roletas
const verificarAssinaturaRoletas = require('./middleware/verificarAssinaturaRoletas');
// Importar serviço de dados simulados
const DadosSimuladosService = require('./services/DadosSimuladosService');

// Carregar variáveis de ambiente
dotenv.config();

// Criar app Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

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

// Aplicar middleware de verificação de assinatura para todas as rotas de roletas
app.use(['/api/ROULETTES', '/api/roulettes', '/api/roletas'], verificarAssinaturaRoletas);

// Modificar o endpoint de roletas para verificar nível de acesso
app.use('/api/ROULETTES', (req, res, next) => {
  console.log(`[API] Requisição para /api/ROULETTES - Nível de acesso: ${req.nivelAcessoRoletas || 'não definido'}`);
  
  // Se o nível de acesso for 'simulado', retornar dados simulados
  if (req.nivelAcessoRoletas === 'simulado') {
    console.log('[API] Fornecendo dados SIMULADOS para usuário sem assinatura premium');
    
    // Obter limite da query string
    const limit = parseInt(req.query.limit) || 20;
    
    // Retornar roletas simuladas
    return res.json(DadosSimuladosService.obterTodasRoletasSimuladas(limit));
  }
  
  // Se for premium, continuar para o próximo middleware (que vai buscar dados reais)
  console.log('[API] Redirecionando requisição de usuário PREMIUM para dados reais');
  req.url = req.url.replace('/api/ROULETTES', '/api/roletas');
  next();
});

// Endpoint em minúsculas também verifica nível de acesso
app.use('/api/roulettes', (req, res, next) => {
  console.log(`[API] Requisição para /api/roulettes - Nível de acesso: ${req.nivelAcessoRoletas || 'não definido'}`);
  
  // Se o nível de acesso for 'simulado', retornar dados simulados
  if (req.nivelAcessoRoletas === 'simulado') {
    console.log('[API] Fornecendo dados SIMULADOS para usuário sem assinatura premium');
    
    // Obter limite da query string
    const limit = parseInt(req.query.limit) || 20;
    
    // Retornar roletas simuladas
    return res.json(DadosSimuladosService.obterTodasRoletasSimuladas(limit));
  }
  
  // Se for premium, continuar para o próximo middleware (que vai buscar dados reais)
  console.log('[API] Redirecionando requisição de usuário PREMIUM para dados reais');
  req.url = req.url.replace('/api/roulettes', '/api/roletas');
  next();
});

// Rota para verificar status da assinatura
app.get('/api/subscription/status', verificarAssinaturaRoletas, (req, res) => {
  console.log('[API] Verificação de status de assinatura:', {
    nivelAcesso: req.nivelAcessoRoletas || 'simulado',
    usuarioId: req.usuario?.id || 'não autenticado'
  });
  
  return res.json({
    nivelAcesso: req.nivelAcessoRoletas || 'simulado',
    assinatura: req.assinatura || null,
    usuario: req.usuario ? {
      id: req.usuario.id,
      email: req.usuario.email
    } : null,
    mensagem: req.nivelAcessoRoletas === 'premium' 
      ? 'Você tem acesso aos dados reais das roletas'
      : 'Você está usando dados simulados. Faça uma assinatura premium para acessar dados reais.'
  });
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