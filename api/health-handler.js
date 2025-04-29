/**
 * Handler consolidado para verificação de saúde do sistema
 * Consolida as operações de verificação de status da API e serviços conectados
 */

const mongoose = require('mongoose');
const axios = require('axios');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_ENABLED = process.env.MONGODB_ENABLED === 'true';

// Configuração Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Operações disponíveis
const operations = {
  'check': healthCheck,
  'status': systemStatus,
  'test': testPage
};

// Handler principal
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Lidar com preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verificar o método da requisição
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  // Obter a operação da query string
  const operation = req.query.operation || 'check';
  
  if (!operations[operation]) {
    return res.status(400).json({ 
      success: false, 
      message: 'Operação inválida' 
    });
  }

  try {
    // Executar a operação especificada
    await operations[operation](req, res);
  } catch (error) {
    console.error(`Erro ao executar operação ${operation}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Verificação básica de saúde
async function healthCheck(req, res) {
  return res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    message: 'API funcionando corretamente',
    version: process.env.npm_package_version || '1.0.0'
  });
}

// Verificação detalhada de status dos serviços
async function systemStatus(req, res) {
  const services = {
    api: {
      status: 'healthy',
      message: 'API funcionando corretamente'
    },
    mongodb: {
      status: 'unknown',
      message: 'MongoDB não configurado'
    },
    asaas: {
      status: 'unknown',
      message: 'Asaas não configurado'
    }
  };

  // Verificar MongoDB
  if (MONGODB_ENABLED) {
    try {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        connectTimeoutMS: 5000
      });
      
      if (mongoose.connection.readyState === 1) {
        services.mongodb.status = 'healthy';
        services.mongodb.message = 'MongoDB conectado';
      } else {
        services.mongodb.status = 'degraded';
        services.mongodb.message = `MongoDB não conectado (estado: ${mongoose.connection.readyState})`;
      }
      
      // Fechar conexão após verificação
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
    } catch (error) {
      services.mongodb.status = 'unhealthy';
      services.mongodb.message = `Erro ao conectar ao MongoDB: ${error.message}`;
    }
  }

  // Verificar Asaas
  if (ASAAS_API_KEY) {
    try {
      const response = await axios.get(
        `${ASAAS_API_URL}/finance/balance`,
        { 
          headers: { access_token: ASAAS_API_KEY },
          timeout: 5000
        }
      );
      
      if (response.status === 200) {
        services.asaas.status = 'healthy';
        services.asaas.message = 'Asaas API conectada';
      } else {
        services.asaas.status = 'degraded';
        services.asaas.message = `Resposta inesperada da API Asaas: ${response.status}`;
      }
    } catch (error) {
      services.asaas.status = 'unhealthy';
      services.asaas.message = `Erro ao conectar à API Asaas: ${error.message}`;
    }
  }

  // Determinar status geral do sistema
  let systemStatus = 'healthy';
  
  if (Object.values(services).some(service => service.status === 'unhealthy')) {
    systemStatus = 'unhealthy';
  } else if (Object.values(services).some(service => service.status === 'degraded')) {
    systemStatus = 'degraded';
  }

  return res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    status: systemStatus,
    services,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
}

// Página de teste
async function testPage(req, res) {
  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API de Verificação de Saúde - Página de Teste</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 20px;
        color: #333;
      }
      h1 {
        color: #0066cc;
        border-bottom: 2px solid #0066cc;
        padding-bottom: 10px;
      }
      h2 {
        color: #0099cc;
        margin-top: 20px;
      }
      code {
        background-color: #f4f4f4;
        border: 1px solid #ddd;
        border-radius: 4px;
        display: block;
        padding: 10px;
        margin: 10px 0;
        overflow: auto;
      }
      .endpoint {
        background-color: #f9f9f9;
        border-left: 4px solid #0099cc;
        padding: 10px;
        margin: 15px 0;
      }
      .method {
        font-weight: bold;
        color: #009900;
      }
      .url {
        color: #0066cc;
        word-break: break-all;
      }
      .status {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
      }
      .healthy {
        background-color: #4CAF50;
      }
      .degraded {
        background-color: #FF9800;
      }
      .unhealthy {
        background-color: #F44336;
      }
      .unknown {
        background-color: #9E9E9E;
      }
    </style>
  </head>
  <body>
    <h1>API de Verificação de Saúde - Página de Teste</h1>
    
    <p>Esta página lista os endpoints disponíveis para a API de verificação de saúde consolidada.</p>
    
    <h2>Endpoints Disponíveis</h2>
    
    <div class="endpoint">
      <h3>Verificação Básica de Saúde</h3>
      <p><span class="method">GET</span> <span class="url">/api/health-handler?operation=check</span></p>
      <p>Retorna informações básicas sobre o estado de funcionamento da API.</p>
      <code>
        curl -X GET https://sua-api.com/api/health-handler?operation=check
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Status Detalhado do Sistema</h3>
      <p><span class="method">GET</span> <span class="url">/api/health-handler?operation=status</span></p>
      <p>Retorna informações detalhadas sobre o estado de todos os serviços conectados à API.</p>
      <code>
        curl -X GET https://sua-api.com/api/health-handler?operation=status
      </code>
    </div>
    
    <h2>Exemplos de Resposta</h2>
    
    <h3>Verificação Básica de Saúde</h3>
    <code>
      {
        "success": true,
        "timestamp": "2023-06-15T12:34:56.789Z",
        "message": "API funcionando corretamente",
        "version": "1.0.0"
      }
    </code>
    
    <h3>Status Detalhado do Sistema</h3>
    <code>
      {
        "success": true,
        "timestamp": "2023-06-15T12:34:56.789Z",
        "status": "healthy",
        "services": {
          "api": {
            "status": "healthy",
            "message": "API funcionando corretamente"
          },
          "mongodb": {
            "status": "healthy",
            "message": "MongoDB conectado"
          },
          "asaas": {
            "status": "healthy",
            "message": "Asaas API conectada"
          }
        },
        "version": "1.0.0",
        "environment": "production",
        "uptime": 3600
      }
    </code>
    
    <h2>Códigos de Status dos Serviços</h2>
    <ul>
      <li><span class="status healthy">healthy</span> - Serviço funcionando corretamente</li>
      <li><span class="status degraded">degraded</span> - Serviço funcionando com limitações</li>
      <li><span class="status unhealthy">unhealthy</span> - Serviço indisponível</li>
      <li><span class="status unknown">unknown</span> - Estado do serviço desconhecido</li>
    </ul>
    
    <h2>Verificação em Tempo Real</h2>
    <div id="status-container">
      <p>Clique nos botões abaixo para verificar o status da API em tempo real:</p>
      <button id="check-basic">Verificação Básica</button>
      <button id="check-detailed">Status Detalhado</button>
      <div id="result"></div>
    </div>
    
    <script>
      document.getElementById('check-basic').addEventListener('click', async function() {
        const result = document.getElementById('result');
        result.innerHTML = '<p>Carregando...</p>';
        
        try {
          const response = await fetch('/api/health-handler?operation=check');
          const data = await response.json();
          
          result.innerHTML = '<h3>Resultado da Verificação Básica:</h3>' +
            '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        } catch (error) {
          result.innerHTML = '<h3>Erro:</h3>' +
            '<pre>' + error.message + '</pre>';
        }
      });
      
      document.getElementById('check-detailed').addEventListener('click', async function() {
        const result = document.getElementById('result');
        result.innerHTML = '<p>Carregando...</p>';
        
        try {
          const response = await fetch('/api/health-handler?operation=status');
          const data = await response.json();
          
          let servicesHtml = '<h3>Status dos Serviços:</h3><ul>';
          
          for (const service in data.services) {
            if (Object.prototype.hasOwnProperty.call(data.services, service)) {
              const info = data.services[service];
              servicesHtml += '<li>' + service + ': <span class="status ' + info.status + '">' + info.status + '</span> - ' + info.message + '</li>';
            }
          }
          
          servicesHtml += '</ul>';
          
          result.innerHTML = '<h3>Resultado do Status Detalhado:</h3>' +
            '<p>Status geral: <span class="status ' + data.status + '">' + data.status + '</span></p>' +
            servicesHtml +
            '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        } catch (error) {
          result.innerHTML = '<h3>Erro:</h3>' +
            '<pre>' + error.message + '</pre>';
        }
      });
    </script>
  </body>
  </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
} 