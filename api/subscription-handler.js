/**
 * Handler consolidado para operações de assinatura
 * Consolida as operações de criação, consulta e cancelamento de assinaturas
 */

const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_ENABLED = process.env.MONGODB_ENABLED === 'true';
const DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

// Configuração Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_ACCESS_TOKEN = process.env.ASAAS_ACCESS_TOKEN;

// Configuração JWT
const JWT_SECRET = process.env.JWT_SECRET;

// Esquemas
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

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asaasCustomerId: String,
  asaasSubscriptionId: String,
  planId: String,
  status: String,
  nextPaymentDate: Date,
  value: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  value: { type: Number, required: true },
  billingCycle: { type: String, default: 'MONTHLY' },
  features: [String],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Inicializar MongoDB se estiver habilitado
let dbConnection = null;
let User = null;
let Subscription = null;
let Plan = null;

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
    Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
    Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);
    
    return dbConnection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return null;
  }
}

// Verificar token JWT
function verifyToken(token) {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Operações disponíveis
const operations = {
  'create': createSubscription,
  'find': findSubscription,
  'cancel': cancelSubscription,
  'test': testPage
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
  const operation = req.query.operation || 'find';
  
  if (!operations[operation]) {
    return res.status(400).json({ 
      success: false, 
      message: 'Operação inválida' 
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

// Criar assinatura
async function createSubscription(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    // Obter os dados da requisição
    const { customerId, planId, billingType = 'PIX', nextDueDate, value, description, externalReference } = req.body;
    
    if (!customerId || !planId) {
      return res.status(400).json({
        success: false,
        message: 'Dados insuficientes para criar assinatura'
      });
    }

    // Verificar token JWT para autorização
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Buscar o plano se o MongoDB estiver habilitado
    let planValue = value;
    let planDescription = description || 'Assinatura RunCash';
    
    if (MONGODB_ENABLED) {
      const plan = await Plan.findById(planId);
      
      if (plan) {
        planValue = plan.value;
        planDescription = plan.description || plan.name;
      }
    }

    // Criar assinatura na API do Asaas
    const currentDate = new Date();
    const nextPaymentDate = nextDueDate || new Date(currentDate.setDate(currentDate.getDate() + 1)).toISOString().split('T')[0];
    
    const subscriptionData = {
      customer: customerId,
      billingType,
      value: planValue,
      nextDueDate: nextPaymentDate,
      description: planDescription,
      cycle: 'MONTHLY',
      externalReference: externalReference || decoded.id
    };

    const response = await axios.post(
      `${ASAAS_API_URL}/subscriptions`,
      subscriptionData,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    if (!response.data || !response.data.id) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar assinatura no Asaas'
      });
    }

    // Salvar assinatura no banco de dados, se o MongoDB estiver habilitado
    if (MONGODB_ENABLED) {
      const user = await User.findOne({ asaasCustomerId: customerId });
      
      if (user) {
        // Atualizar o usuário com o plano e status da assinatura
        user.planId = planId;
        user.subscriptionStatus = response.data.status;
        user.updatedAt = new Date();
        await user.save();

        // Criar registro de assinatura
        await Subscription.create({
          userId: user._id,
          asaasCustomerId: customerId,
          asaasSubscriptionId: response.data.id,
          planId,
          status: response.data.status,
          nextPaymentDate: response.data.nextDueDate,
          value: response.data.value
        });
      }
    }

    return res.status(200).json({
      success: true,
      subscription: {
        id: response.data.id,
        status: response.data.status,
        customer: response.data.customer,
        value: response.data.value,
        nextDueDate: response.data.nextDueDate,
        description: response.data.description,
        cycle: response.data.cycle,
        billingType: response.data.billingType
      }
    });
  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar assinatura',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// Buscar assinatura
async function findSubscription(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    // Obter o ID da assinatura da query ou do body
    const subscriptionId = req.query.id || (req.body && req.body.id);
    const customerId = req.query.customerId || (req.body && req.body.customerId);
    
    if (!subscriptionId && !customerId) {
      return res.status(400).json({
        success: false,
        message: 'ID da assinatura ou do cliente não fornecido'
      });
    }

    // Verificar token JWT para autorização
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    let response;
    
    // Buscar assinatura por ID
    if (subscriptionId) {
      response = await axios.get(
        `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
        { headers: { access_token: ASAAS_API_KEY } }
      );
      
      if (!response.data) {
        return res.status(404).json({
          success: false,
          message: 'Assinatura não encontrada'
        });
      }
      
      // Verificar se o usuário tem acesso a essa assinatura
      if (MONGODB_ENABLED) {
        const user = await User.findById(decoded.id);
        
        if (!user || user.asaasCustomerId !== response.data.customer) {
          return res.status(403).json({
            success: false,
            message: 'Acesso não autorizado a esta assinatura'
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        subscription: {
          id: response.data.id,
          status: response.data.status,
          customer: response.data.customer,
          value: response.data.value,
          nextDueDate: response.data.nextDueDate,
          description: response.data.description,
          cycle: response.data.cycle,
          billingType: response.data.billingType
        }
      });
    }
    
    // Buscar assinaturas por cliente
    if (customerId) {
      // Verificar se o usuário tem acesso a este cliente
      if (MONGODB_ENABLED) {
        const user = await User.findById(decoded.id);
        
        if (!user || user.asaasCustomerId !== customerId) {
          return res.status(403).json({
            success: false,
            message: 'Acesso não autorizado às assinaturas deste cliente'
          });
        }
      }
      
      response = await axios.get(
        `${ASAAS_API_URL}/subscriptions?customer=${customerId}`,
        { headers: { access_token: ASAAS_API_KEY } }
      );
      
      if (!response.data || !response.data.data) {
        return res.status(404).json({
          success: false,
          message: 'Nenhuma assinatura encontrada para este cliente'
        });
      }
      
      const subscriptions = response.data.data.map(subscription => ({
        id: subscription.id,
        status: subscription.status,
        customer: subscription.customer,
        value: subscription.value,
        nextDueDate: subscription.nextDueDate,
        description: subscription.description,
        cycle: subscription.cycle,
        billingType: subscription.billingType
      }));
      
      return res.status(200).json({
        success: true,
        subscriptions
      });
    }
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar assinatura',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// Cancelar assinatura
async function cancelSubscription(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    // Obter o ID da assinatura da query ou do body
    const subscriptionId = req.query.id || (req.body && req.body.id);
    
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'ID da assinatura não fornecido'
      });
    }

    // Verificar token JWT para autorização
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Buscar informações da assinatura antes de cancelar
    const subscriptionResponse = await axios.get(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );
    
    if (!subscriptionResponse.data) {
      return res.status(404).json({
        success: false,
        message: 'Assinatura não encontrada'
      });
    }
    
    const asaasCustomerId = subscriptionResponse.data.customer;
    
    // Verificar se o usuário tem acesso a essa assinatura
    if (MONGODB_ENABLED) {
      const user = await User.findById(decoded.id);
      
      if (!user || user.asaasCustomerId !== asaasCustomerId) {
        return res.status(403).json({
          success: false,
          message: 'Acesso não autorizado a esta assinatura'
        });
      }
    }

    // Cancelar assinatura na API do Asaas
    const response = await axios.delete(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    // Atualizar o status da assinatura no banco de dados, se o MongoDB estiver habilitado
    if (MONGODB_ENABLED) {
      const subscription = await Subscription.findOne({ asaasSubscriptionId: subscriptionId });
      
      if (subscription) {
        subscription.status = 'CANCELED';
        subscription.updatedAt = new Date();
        await subscription.save();
      }
      
      // Atualizar o usuário com o status da assinatura cancelada
      const user = await User.findOne({ asaasCustomerId });
      
      if (user) {
        user.subscriptionStatus = 'CANCELED';
        user.updatedAt = new Date();
        await user.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao cancelar assinatura',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// Página de teste
async function testPage(req, res) {
  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API de Assinaturas - Página de Teste</title>
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
    </style>
  </head>
  <body>
    <h1>API de Assinaturas - Página de Teste</h1>
    
    <p>Esta página lista os endpoints disponíveis para a API de assinaturas consolidada.</p>
    
    <h2>Endpoints Disponíveis</h2>
    
    <div class="endpoint">
      <h3>Criar Assinatura</h3>
      <p><span class="method">POST</span> <span class="url">/api/subscription-handler?operation=create</span></p>
      <p>Cria uma nova assinatura para o cliente.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X POST \\
        https://sua-api.com/api/subscription-handler?operation=create \\
        -H "Authorization: Bearer SEU_TOKEN_JWT" \\
        -H "Content-Type: application/json" \\
        -d '{
          "customerId": "cus_123456789",
          "planId": "plan_123",
          "billingType": "PIX",
          "value": 49.90,
          "description": "Assinatura mensal"
        }'
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Buscar Assinatura</h3>
      <p><span class="method">GET</span> <span class="url">/api/subscription-handler?operation=find&id=SUBSCRIPTION_ID</span></p>
      <p>Busca informações detalhadas sobre uma assinatura específica.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X GET \\
        https://sua-api.com/api/subscription-handler?operation=find&id=SUBSCRIPTION_ID \\
        -H "Authorization: Bearer SEU_TOKEN_JWT"
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Buscar Assinaturas do Cliente</h3>
      <p><span class="method">GET</span> <span class="url">/api/subscription-handler?operation=find&customerId=CUSTOMER_ID</span></p>
      <p>Busca todas as assinaturas de um cliente específico.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X GET \\
        https://sua-api.com/api/subscription-handler?operation=find&customerId=CUSTOMER_ID \\
        -H "Authorization: Bearer SEU_TOKEN_JWT"
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Cancelar Assinatura</h3>
      <p><span class="method">DELETE</span> <span class="url">/api/subscription-handler?operation=cancel&id=SUBSCRIPTION_ID</span></p>
      <p>Cancela uma assinatura específica.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X DELETE \\
        https://sua-api.com/api/subscription-handler?operation=cancel&id=SUBSCRIPTION_ID \\
        -H "Authorization: Bearer SEU_TOKEN_JWT"
      </code>
    </div>
    
    <h2>Exemplos de Resposta</h2>
    
    <h3>Criar Assinatura</h3>
    <code>
      {
        "success": true,
        "subscription": {
          "id": "sub_123456789",
          "status": "ACTIVE",
          "customer": "cus_123456789",
          "value": 49.90,
          "nextDueDate": "2023-06-15",
          "description": "Assinatura mensal",
          "cycle": "MONTHLY",
          "billingType": "PIX"
        }
      }
    </code>
    
    <h3>Buscar Assinatura</h3>
    <code>
      {
        "success": true,
        "subscription": {
          "id": "sub_123456789",
          "status": "ACTIVE",
          "customer": "cus_123456789",
          "value": 49.90,
          "nextDueDate": "2023-06-15",
          "description": "Assinatura mensal",
          "cycle": "MONTHLY",
          "billingType": "PIX"
        }
      }
    </code>
    
    <h3>Cancelar Assinatura</h3>
    <code>
      {
        "success": true,
        "message": "Assinatura cancelada com sucesso"
      }
    </code>
    
    <h2>Códigos de Erro</h2>
    <ul>
      <li><strong>400</strong> - Requisição inválida (parâmetros faltando)</li>
      <li><strong>401</strong> - Não autorizado (token ausente ou inválido)</li>
      <li><strong>403</strong> - Proibido (tentativa de acessar recurso de outro usuário)</li>
      <li><strong>404</strong> - Não encontrado (assinatura não existe)</li>
      <li><strong>405</strong> - Método não permitido</li>
      <li><strong>500</strong> - Erro interno do servidor</li>
    </ul>
  </body>
  </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
} 