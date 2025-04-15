/**
 * Configuração CORS para permitir solicitações entre domínios
 */

// Lista de origens permitidas
const allowedOrigins = [
  // Frontend no Vercel
  'https://runcashh11.vercel.app',
  'https://runcash11.vercel.app',
  'https://runcashh1.vercel.app',
  'https://runcash1.vercel.app',
  'https://runcashhh1.vercel.app',
  // Ambiente de desenvolvimento local
  'http://localhost:3000',
  'http://localhost:5173',
];

/**
 * Aplica configurações CORS a uma resposta HTTP
 */
function applyCors(req, res) {
  // Obter a origem da solicitação
  const origin = req.headers.origin;
  
  // Verificar se a origem está na lista de permitidas
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    // Permitir qualquer origem em ambiente de desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
  }
  
  // Configurações CORS comuns
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Lidar com solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  
  return false;
}

module.exports = {
  applyCors,
  allowedOrigins
}; 