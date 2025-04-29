/**
 * Configuração CORS centralizada para servidores backend
 * Este módulo fornece funções para configurar CORS de forma consistente em diferentes servidores
 */

// Lista de origens permitidas - pode ser atualizada conforme necessário
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3030',
  'https://runcashh.vercel.app',
  'https://runcashh-v2.vercel.app',
  'https://runcash-app.vercel.app',
  'https://runcash.app',
  'https://www.runcash.app'
];

/**
 * Verifica se uma origem está na lista de permitidas
 * @param {string} origin - A origem a ser verificada
 * @returns {boolean} - Verdadeiro se a origem é permitida
 */
function isOriginAllowed(origin) {
  // Se não houver origem (ex: requisição direta via Postman/curl), permitimos
  if (!origin) return true;
  
  // Verificar contra a lista de origens permitidas
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Configura cabeçalhos CORS para uma resposta Express
 * @param {Object} req - Objeto de requisição do Express
 * @param {Object} res - Objeto de resposta do Express
 * @returns {boolean} - Retorna true se a requisição foi tratada (OPTIONS)
 */
function configureCors(req, res) {
  const origin = req.headers.origin;
  
  // Definir Access-Control-Allow-Origin baseado na origem da requisição
  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Para origens não permitidas, ainda definimos o cabeçalho, mas com valor restrito
    // Isso é melhor que retornar um erro CORS, que poderia bloquear a UI completamente
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    console.warn(`[CORS] Requisição de origem não permitida: ${origin}`);
  }
  
  // Configurar outros cabeçalhos CORS
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-asaas-access-token, x-subscription-token');
  res.header('Access-Control-Max-Age', '86400'); // Cache por 24 horas
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Logar para depuração
  console.log(`[CORS] Configurado para requisição ${req.method} em ${req.path} de origem: ${origin || 'desconhecida'}`);
  
  // Tratar solicitações preflight
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Requisição OPTIONS respondida automaticamente');
    res.status(204).end();
    return true; // Indica que a requisição OPTIONS foi tratada
  }
  
  return false; // Indica para continuar o processamento da requisição
}

/**
 * Cria um middleware Express para configuração de CORS
 * @returns {Function} Middleware do Express para CORS
 */
function corsMiddleware() {
  return (req, res, next) => {
    // Aplicar configuração CORS
    const handled = configureCors(req, res);
    
    // Se a requisição já foi tratada (OPTIONS), encerrar aqui
    if (handled) {
      return; // response já foi enviada
    }
    
    // Continuar para o próximo middleware
    next();
  };
}

/**
 * Retorna a configuração para o Socket.IO
 * @returns {Object} Configuração CORS para Socket.IO
 */
function socketIoCorsConfig() {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin) || !origin) {
        callback(null, true);
      } else {
        console.warn(`[Socket.IO] Tentativa de conexão de origem não permitida: ${origin}`);
        // Permitimos de qualquer forma para evitar problemas com a UI
        // mas logamos para monitoramento
        callback(null, true);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowEIO3: true
  };
}

// Exportar as funções
module.exports = {
  ALLOWED_ORIGINS,
  isOriginAllowed,
  configureCors,
  corsMiddleware,
  socketIoCorsConfig
}; 