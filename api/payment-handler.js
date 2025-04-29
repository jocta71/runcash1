/**
 * Handler consolidado para operações de pagamento
 * Consolida as operações de consulta de pagamento, QR Code PIX e outras funções relacionadas
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

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asaasCustomerId: String,
  asaasPaymentId: String,
  subscriptionId: String,
  value: Number,
  status: String,
  dueDate: Date,
  paymentDate: Date,
  billingType: String,
  invoiceUrl: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Inicializar MongoDB se estiver habilitado
let dbConnection = null;
let User = null;
let Subscription = null;
let Payment = null;

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
    Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
    
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
  'find-payment': findPayment,
  'pix-qrcode': generatePixQrCode,
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
  const operation = req.query.operation || 'find-payment';
  
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

// Buscar informações de pagamento
async function findPayment(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    // Obter o ID do pagamento da query ou do body
    const paymentId = req.query.id || (req.body && req.body.id);
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'ID do pagamento não fornecido'
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

    // Buscar o pagamento na API do Asaas
    const response = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    if (!response.data) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado'
      });
    }

    // Buscar usuário pelo ID do cliente Asaas, se o MongoDB estiver habilitado
    if (MONGODB_ENABLED) {
      const user = await User.findOne({ asaasCustomerId: response.data.customer });
      
      if (user && user._id.toString() !== decoded.id) {
        return res.status(403).json({
          success: false,
          message: 'Acesso não autorizado a este pagamento'
        });
      }

      // Registrar o pagamento no banco de dados, se ainda não existir
      const existingPayment = await Payment.findOne({ asaasPaymentId: paymentId });
      
      if (!existingPayment && user) {
        await Payment.create({
          userId: user._id,
          asaasCustomerId: response.data.customer,
          asaasPaymentId: paymentId,
          subscriptionId: response.data.subscription,
          value: response.data.value,
          status: response.data.status,
          dueDate: response.data.dueDate,
          paymentDate: response.data.paymentDate,
          billingType: response.data.billingType,
          invoiceUrl: response.data.invoiceUrl
        });
      }
    }

    return res.status(200).json({
      success: true,
      payment: {
        id: response.data.id,
        value: response.data.value,
        netValue: response.data.netValue,
        status: response.data.status,
        dueDate: response.data.dueDate,
        paymentDate: response.data.paymentDate,
        billingType: response.data.billingType,
        invoiceUrl: response.data.invoiceUrl,
        description: response.data.description,
        externalReference: response.data.externalReference,
        confirmedDate: response.data.confirmedDate,
        customer: response.data.customer,
        subscription: response.data.subscription
      }
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar pagamento',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// Gerar QR Code PIX
async function generatePixQrCode(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    // Obter o ID do pagamento da query ou do body
    const paymentId = req.query.id || (req.body && req.body.id);
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'ID do pagamento não fornecido'
      });
    }

    // Buscar o QR Code PIX na API do Asaas
    const response = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    if (!response.data || !response.data.encodedImage) {
      return res.status(404).json({
        success: false,
        message: 'QR Code PIX não encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      pixQrCode: {
        encodedImage: response.data.encodedImage,
        payload: response.data.payload,
        expirationDate: response.data.expirationDate
      }
    });
  } catch (error) {
    console.error('Erro ao gerar QR Code PIX:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar QR Code PIX',
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
    <title>API de Pagamentos - Página de Teste</title>
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
    <h1>API de Pagamentos - Página de Teste</h1>
    
    <p>Esta página lista os endpoints disponíveis para a API de pagamentos consolidada.</p>
    
    <h2>Endpoints Disponíveis</h2>
    
    <div class="endpoint">
      <h3>Buscar Informações de Pagamento</h3>
      <p><span class="method">GET</span> <span class="url">/api/payment-handler?operation=find-payment&id=PAYMENT_ID</span></p>
      <p>Busca informações detalhadas sobre um pagamento específico.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X GET \\
        https://sua-api.com/api/payment-handler?operation=find-payment&id=PAYMENT_ID \\
        -H "Authorization: Bearer SEU_TOKEN_JWT"
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Gerar QR Code PIX</h3>
      <p><span class="method">GET</span> <span class="url">/api/payment-handler?operation=pix-qrcode&id=PAYMENT_ID</span></p>
      <p>Gera um QR Code PIX para um pagamento específico.</p>
      <code>
        curl -X GET \\
        https://sua-api.com/api/payment-handler?operation=pix-qrcode&id=PAYMENT_ID
      </code>
      <p>A resposta inclui a imagem do QR Code codificada em base64 e o payload para cópia e cola.</p>
    </div>
    
    <h2>Exemplos de Resposta</h2>
    
    <h3>Buscar Pagamento</h3>
    <code>
      {
        "success": true,
        "payment": {
          "id": "pay_123456789",
          "value": 49.90,
          "netValue": 48.15,
          "status": "CONFIRMED",
          "dueDate": "2023-06-15",
          "paymentDate": "2023-06-14",
          "billingType": "PIX",
          "invoiceUrl": "https://asaas.com/i/123456789",
          "description": "Assinatura mensal",
          "externalReference": "user_123",
          "confirmedDate": "2023-06-14",
          "customer": "cus_123456789",
          "subscription": "sub_123456789"
        }
      }
    </code>
    
    <h3>Gerar QR Code PIX</h3>
    <code>
      {
        "success": true,
        "pixQrCode": {
          "encodedImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhE...",
          "payload": "00020101021226800014br.gov.bcb.pix2558invoice.asaas.com/p/123456789...",
          "expirationDate": "2023-06-15T23:59:59Z"
        }
      }
    </code>
    
    <h2>Códigos de Erro</h2>
    <ul>
      <li><strong>400</strong> - Requisição inválida (parâmetros faltando)</li>
      <li><strong>401</strong> - Não autorizado (token ausente ou inválido)</li>
      <li><strong>403</strong> - Proibido (tentativa de acessar recurso de outro usuário)</li>
      <li><strong>404</strong> - Não encontrado (pagamento ou QR Code não existem)</li>
      <li><strong>405</strong> - Método não permitido</li>
      <li><strong>500</strong> - Erro interno do servidor</li>
    </ul>
  </body>
  </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
} 