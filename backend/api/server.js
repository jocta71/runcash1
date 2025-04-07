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
const configRouter = require('./routes/configApi');

// Configuração do servidor
const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: ['https://runcashh-front.vercel.app', 'https://www.runcashh.com', 'http://localhost:8080', 'http://localhost:3000'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
}));
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
app.use('/api/config', configRouter);

// Rota de status da API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    mongodb: mongodb.isConnected() ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

// ----- INÍCIO DA IMPLEMENTAÇÃO DIRETA DE CONFIGURAÇÃO DE ROLETAS -----
// Variável em memória para armazenar a configuração atual
let currentRouletteConfig = null;

// Função para carregar a configuração inicial
function getInitialRouletteConfig() {
  try {
    // Se já tivermos uma configuração em memória, retorná-la
    if (currentRouletteConfig) {
      return currentRouletteConfig;
    }
    
    // Caso contrário, criar a configuração padrão das variáveis de ambiente
    const defaultRoulettes = process.env.VITE_ALLOWED_ROULETTES || process.env.ALLOWED_ROULETTES
      ? (process.env.VITE_ALLOWED_ROULETTES || process.env.ALLOWED_ROULETTES).split(',').map(id => id.trim())
      : ["2010016","2380335","2010065","2010096","2010017","2010098"];
    
    currentRouletteConfig = {
      allowedRoulettes: defaultRoulettes,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`[CONFIG] Configuração inicial de roletas carregada: ${defaultRoulettes.length} roletas permitidas`);
    return currentRouletteConfig;
  } catch (error) {
    console.error('[CONFIG] Erro ao carregar configuração inicial:', error);
    // Configuração de fallback em caso de erro
    return {
      allowedRoulettes: ["2010016","2380335","2010065","2010096","2010017","2010098"],
      lastUpdated: new Date().toISOString()
    };
  }
}

// Endpoint GET para obter a lista atual de roletas permitidas
app.get('/api/config/allowed-roulettes', (req, res) => {
  try {
    const config = getInitialRouletteConfig();
    console.log(`[CONFIG] GET /api/config/allowed-roulettes - Retornando ${config.allowedRoulettes.length} roletas`);
    res.json({
      allowedRoulettes: config.allowedRoulettes,
      totalCount: config.allowedRoulettes.length,
      lastUpdated: config.lastUpdated
    });
  } catch (error) {
    console.error('[CONFIG] Erro ao processar requisição GET:', error);
    res.status(500).json({ 
      error: 'Erro interno ao processar requisição', 
      message: error.message 
    });
  }
});

// Endpoint POST para atualizar a lista de roletas permitidas
app.post('/api/config/allowed-roulettes', async (req, res) => {
  try {
    const { allowedRoulettes } = req.body;
    
    // Validação básica
    if (!Array.isArray(allowedRoulettes)) {
      console.warn('[CONFIG] Formato inválido recebido:', req.body);
      return res.status(400).json({ 
        error: 'O formato esperado é um array de IDs de roletas' 
      });
    }
    
    // Sanitização dos IDs (remover duplicatas e valores vazios)
    const sanitizedRoulettes = [...new Set(
      allowedRoulettes
        .map(id => String(id).trim())
        .filter(id => id !== '')
    )];
    
    // Atualizar a configuração em memória
    currentRouletteConfig = {
      allowedRoulettes: sanitizedRoulettes,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`[CONFIG] Lista de roletas atualizada: ${sanitizedRoulettes.join(', ')}`);
    
    // Tentar criar um arquivo Python para o scraper, se possível
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Caminho para o arquivo Python do scraper (ajuste conforme necessário)
      const scraperPath = path.join(__dirname, '../../scraper/roletas_permitidas_dinamicas.py');
      
      // Conteúdo do arquivo Python
      const pythonContent = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Roletas permitidas dinâmicas - GERADO AUTOMATICAMENTE PELO API SERVER
NÃO EDITE MANUALMENTE ESTE ARQUIVO!
Última atualização: ${new Date().toISOString()}
"""

# Lista de roletas permitidas definida dinamicamente pela API
ALLOWED_ROULETTES = [
    ${sanitizedRoulettes.map(id => `"${id}"`).join(',\n    ')}
]

# Para usar em outros módulos
def get_allowed_roulettes():
    return ALLOWED_ROULETTES
`;
      
      // Escrever o arquivo de forma assíncrona
      fs.writeFile(scraperPath, pythonContent, 'utf8', (err) => {
        if (err) {
          console.error('[CONFIG] Erro ao salvar arquivo Python:', err);
        } else {
          console.log(`[CONFIG] Arquivo Python atualizado: ${scraperPath}`);
        }
      });
    } catch (fsError) {
      console.error('[CONFIG] Erro ao tentar salvar o arquivo Python:', fsError);
      // Continuar mesmo se falhar ao salvar o arquivo - a configuração em memória ainda funcionará
    }
    
    // Responder com sucesso
    res.json({ 
      success: true, 
      message: 'Roletas permitidas atualizadas com sucesso',
      allowedRoulettes: sanitizedRoulettes,
      totalCount: sanitizedRoulettes.length,
      lastUpdated: currentRouletteConfig.lastUpdated
    });
  } catch (error) {
    console.error('[CONFIG] Erro ao processar requisição POST:', error);
    res.status(500).json({ 
      error: 'Erro interno ao processar requisição', 
      message: error.message 
    });
  }
});
// ----- FIM DA IMPLEMENTAÇÃO DIRETA DE CONFIGURAÇÃO DE ROLETAS -----

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