// Endpoint de teste para verificar a configuração do Vercel
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return res.status(200).json({
    status: 'success',
    message: 'API funcionando corretamente',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
}; 