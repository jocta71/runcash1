/**
 * API test-page - Página de teste para Vercel
 */

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // HTML para página de teste
  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RunCash API - Teste</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        color: #333;
      }
      h1 {
        color: #2c3e50;
        border-bottom: 2px solid #3498db;
        padding-bottom: 10px;
      }
      .card {
        background: #f9f9f9;
        border-left: 4px solid #3498db;
        padding: 15px;
        margin-bottom: 20px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }
      .success {
        color: #27ae60;
        font-weight: bold;
      }
      .endpoints {
        background: #eee;
        padding: 15px;
        border-radius: 4px;
      }
      code {
        background: #e0e0e0;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
      }
    </style>
  </head>
  <body>
    <h1>RunCash API - Página de Teste</h1>
    
    <div class="card">
      <h2>Status do Servidor</h2>
      <p class="success">✅ API está operacional</p>
      <p>Versão: 1.0.0</p>
      <p>Ambiente: ${process.env.NODE_ENV || 'development'}</p>
    </div>
    
    <div class="card">
      <h2>Endpoints Disponíveis</h2>
      <div class="endpoints">
        <p><code>GET /api/test-page</code> - Esta página de teste</p>
        <p><code>POST /api/asaas-webhook</code> - Webhook do Asaas</p>
        <p><code>POST /api/asaas-create-customer</code> - Criar cliente</p>
        <p><code>POST /api/asaas-create-subscription</code> - Criar assinatura</p>
      </div>
    </div>
    
    <div class="card">
      <h2>Timestamp</h2>
      <p>Data/Hora: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
  </body>
  </html>
  `;
  
  // Retornar a página HTML
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}; 