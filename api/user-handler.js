/**
 * Handler consolidado para operações relacionadas ao usuário
 * Isso permite reduzir o número de funções serverless para atender às limitações do plano gratuito da Vercel
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_ENABLED = process.env.MONGODB_ENABLED === 'true';
const DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Esquema do Usuário
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  username: String,
  asaasCustomerId: String,
  planId: String,
  apiKey: String,
  subscriptionStatus: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Inicializar MongoDB se estiver habilitado
let dbConnection = null;
let User = null;

async function connectToDatabase() {
  if (!MONGODB_ENABLED) return null;
  
  try {
    if (dbConnection) return dbConnection;
    
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    dbConnection = mongoose.connection;
    console.log('Connected to MongoDB');
    
    // Definir modelos
    User = mongoose.models.User || mongoose.model('User', userSchema);
    
    return dbConnection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return null;
  }
}

// Operações disponíveis
const operations = {
  'update': updateUser,
  'test-page': testPage,
};

// Handler principal
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Lidar com preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Obter a operação da query string
  const operation = req.query.operation;
  
  if (!operation || !operations[operation]) {
    return res.status(400).json({ 
      success: false, 
      message: 'Operação inválida ou não especificada' 
    });
  }

  try {
    // Conectar ao banco de dados se necessário
    if (MONGODB_ENABLED) {
      await connectToDatabase();
    }
    
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

// Extrair token de autorização
function extractToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

// Atualizar usuário
async function updateUser(req, res) {
  try {
    const { asaasCustomerId, userId, planId, subscriptionStatus } = req.body;
    
    // Verificar autenticação
    const token = extractToken(req);
    let authenticatedUserId = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'runcash-secret-key');
        authenticatedUserId = decoded.id;
      } catch (error) {
        console.warn('JWT verification failed:', error.message);
      }
    }
    
    // Se não houver autenticação e não for fornecido um userId, retornar erro
    if (!authenticatedUserId && !userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }
    
    // Usar o ID do token ou o ID fornecido no corpo
    const targetUserId = authenticatedUserId || userId;
    
    if (!MONGODB_ENABLED) {
      return res.status(200).json({
        success: true,
        message: 'Operação simulada: MongoDB desativado',
        userId: targetUserId
      });
    }
    
    // Buscar usuário no banco de dados
    const user = await User.findById(targetUserId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    
    // Atualizar campos fornecidos
    if (asaasCustomerId) user.asaasCustomerId = asaasCustomerId;
    if (planId) user.planId = planId;
    if (subscriptionStatus) user.subscriptionStatus = subscriptionStatus;
    
    user.updatedAt = new Date();
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        asaasCustomerId: user.asaasCustomerId,
        planId: user.planId,
        subscriptionStatus: user.subscriptionStatus
      }
    });
  } catch (error) {
    console.error('[updateUser] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// Página de teste
async function testPage(req, res) {
  // Simples página HTML para testes
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>RunCash API Test</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #101010;
            color: #eaeaea;
          }
          h1 {
            color: #00ff00;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #1a1a1a;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .endpoint {
            margin-bottom: 15px;
            padding: 10px;
            background-color: #252525;
            border-radius: 4px;
            border-left: 3px solid #00ff00;
          }
          .url {
            font-family: monospace;
            color: #0095ff;
          }
          .method {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 8px;
          }
          .get { background-color: #2962ff; color: white; }
          .post { background-color: #00c853; color: white; }
          .delete { background-color: #f44336; color: white; }
          .status {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 5px;
          }
          .online { background-color: #00c853; }
          .offline { background-color: #f44336; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>RunCash API Test</h1>
          <p>Esta página é usada para testar a disponibilidade dos endpoints da API RunCash.</p>
          
          <div>
            <h2>Status</h2>
            <p><span class="status online"></span> API está funcionando</p>
          </div>
          
          <div>
            <h2>Endpoints Disponíveis</h2>
            
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="url">/api/update-user</span>
              <p>Atualiza informações do usuário, incluindo ID do cliente no Asaas.</p>
            </div>
            
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="url">/api/asaas-create-customer</span>
              <p>Cria um novo cliente no Asaas para o usuário.</p>
            </div>
            
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="url">/api/asaas-find-customer</span>
              <p>Busca um cliente existente no Asaas.</p>
            </div>
            
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="url">/api/asaas-create-subscription</span>
              <p>Cria uma nova assinatura no Asaas para o cliente.</p>
            </div>
            
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="url">/api/asaas-find-subscription</span>
              <p>Busca uma assinatura existente no Asaas.</p>
            </div>
            
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="url">/api/asaas-cancel-subscription</span>
              <p>Cancela uma assinatura existente no Asaas.</p>
            </div>
          </div>
          
          <hr>
          
          <footer>
            <p>&copy; ${new Date().getFullYear()} RunCash - Todos os direitos reservados</p>
          </footer>
        </div>
      </body>
    </html>
  `;
  
  return res.status(200).send(html);
} 