/**
 * Handler consolidado para operações de cliente
 * Consolida as operações de criação e consulta de clientes no Asaas
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
  'create': createCustomer,
  'find': findCustomer,
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

// Criar cliente
async function createCustomer(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    // Obter os dados da requisição
    const { name, email, cpfCnpj, mobilePhone, address, addressNumber, complement, province, postalCode, externalReference } = req.body;
    
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({
        success: false,
        message: 'Dados insuficientes para criar cliente'
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

    // Verificar se já existe um cliente com o mesmo CPF/CNPJ ou e-mail
    const customerCheckResponse = await axios.get(
      `${ASAAS_API_URL}/customers?cpfCnpj=${cpfCnpj}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    if (customerCheckResponse.data && customerCheckResponse.data.data && customerCheckResponse.data.data.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cliente com o mesmo CPF/CNPJ já existe',
        customerId: customerCheckResponse.data.data[0].id
      });
    }

    // Criar cliente na API do Asaas
    const customerData = {
      name,
      email,
      cpfCnpj,
      mobilePhone,
      address,
      addressNumber,
      complement,
      province,
      postalCode,
      externalReference: externalReference || decoded.id
    };

    const response = await axios.post(
      `${ASAAS_API_URL}/customers`,
      customerData,
      { headers: { access_token: ASAAS_API_KEY } }
    );

    if (!response.data || !response.data.id) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao criar cliente no Asaas'
      });
    }

    // Atualizar o usuário com o ID do cliente no Asaas, se o MongoDB estiver habilitado
    if (MONGODB_ENABLED) {
      const user = await User.findById(decoded.id);
      
      if (user) {
        user.asaasCustomerId = response.data.id;
        user.updatedAt = new Date();
        await user.save();
      }
    }

    return res.status(200).json({
      success: true,
      customer: {
        id: response.data.id,
        name: response.data.name,
        email: response.data.email,
        cpfCnpj: response.data.cpfCnpj,
        mobilePhone: response.data.mobilePhone,
        address: response.data.address,
        addressNumber: response.data.addressNumber,
        complement: response.data.complement,
        province: response.data.province,
        postalCode: response.data.postalCode,
        externalReference: response.data.externalReference
      }
    });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}

// Buscar cliente
async function findCustomer(req, res) {
  // Verificar o método da requisição
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido'
    });
  }

  try {
    // Obter o ID do cliente da query ou do body
    const customerId = req.query.id || (req.body && req.body.id);
    const cpfCnpj = req.query.cpfCnpj || (req.body && req.body.cpfCnpj);
    const email = req.query.email || (req.body && req.body.email);
    
    if (!customerId && !cpfCnpj && !email) {
      return res.status(400).json({
        success: false,
        message: 'É necessário fornecer ID, CPF/CNPJ ou e-mail do cliente'
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

    // Se temos o ID do cliente, buscamos diretamente
    if (customerId) {
      const response = await axios.get(
        `${ASAAS_API_URL}/customers/${customerId}`,
        { headers: { access_token: ASAAS_API_KEY } }
      );
      
      if (!response.data) {
        return res.status(404).json({
          success: false,
          message: 'Cliente não encontrado'
        });
      }
      
      // Verificar se o usuário tem acesso a este cliente
      if (MONGODB_ENABLED) {
        const user = await User.findById(decoded.id);
        
        if (user && user.asaasCustomerId && user.asaasCustomerId !== customerId) {
          return res.status(403).json({
            success: false,
            message: 'Acesso não autorizado a este cliente'
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        customer: {
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          cpfCnpj: response.data.cpfCnpj,
          mobilePhone: response.data.mobilePhone,
          address: response.data.address,
          addressNumber: response.data.addressNumber,
          complement: response.data.complement,
          province: response.data.province,
          postalCode: response.data.postalCode,
          externalReference: response.data.externalReference
        }
      });
    }
    
    // Buscar por CPF/CNPJ ou e-mail
    let queryParam = '';
    if (cpfCnpj) {
      queryParam = `cpfCnpj=${cpfCnpj}`;
    } else if (email) {
      queryParam = `email=${email}`;
    }
    
    const response = await axios.get(
      `${ASAAS_API_URL}/customers?${queryParam}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );
    
    if (!response.data || !response.data.data || response.data.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }
    
    const customer = response.data.data[0];
    
    // Verificar se o usuário tem acesso a este cliente
    if (MONGODB_ENABLED) {
      const user = await User.findById(decoded.id);
      
      if (user && user.asaasCustomerId && user.asaasCustomerId !== customer.id) {
        return res.status(403).json({
          success: false,
          message: 'Acesso não autorizado a este cliente'
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        mobilePhone: customer.mobilePhone,
        address: customer.address,
        addressNumber: customer.addressNumber,
        complement: customer.complement,
        province: customer.province,
        postalCode: customer.postalCode,
        externalReference: customer.externalReference
      }
    });
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar cliente',
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
    <title>API de Clientes - Página de Teste</title>
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
    <h1>API de Clientes - Página de Teste</h1>
    
    <p>Esta página lista os endpoints disponíveis para a API de clientes consolidada.</p>
    
    <h2>Endpoints Disponíveis</h2>
    
    <div class="endpoint">
      <h3>Criar Cliente</h3>
      <p><span class="method">POST</span> <span class="url">/api/customer-handler?operation=create</span></p>
      <p>Cria um novo cliente no Asaas e associa ao usuário atual.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X POST \\
        https://sua-api.com/api/customer-handler?operation=create \\
        -H "Authorization: Bearer SEU_TOKEN_JWT" \\
        -H "Content-Type: application/json" \\
        -d '{
          "name": "Nome do Cliente",
          "email": "cliente@exemplo.com",
          "cpfCnpj": "12345678900",
          "mobilePhone": "11999998888",
          "address": "Rua Exemplo",
          "addressNumber": "123",
          "complement": "Apto 45",
          "province": "Bairro Exemplo",
          "postalCode": "12345678"
        }'
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Buscar Cliente por ID</h3>
      <p><span class="method">GET</span> <span class="url">/api/customer-handler?operation=find&id=CUSTOMER_ID</span></p>
      <p>Busca informações detalhadas sobre um cliente específico por ID.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X GET \\
        https://sua-api.com/api/customer-handler?operation=find&id=cus_123456789 \\
        -H "Authorization: Bearer SEU_TOKEN_JWT"
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Buscar Cliente por CPF/CNPJ</h3>
      <p><span class="method">GET</span> <span class="url">/api/customer-handler?operation=find&cpfCnpj=CPF_OU_CNPJ</span></p>
      <p>Busca informações detalhadas sobre um cliente por CPF ou CNPJ.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X GET \\
        https://sua-api.com/api/customer-handler?operation=find&cpfCnpj=12345678900 \\
        -H "Authorization: Bearer SEU_TOKEN_JWT"
      </code>
    </div>
    
    <div class="endpoint">
      <h3>Buscar Cliente por E-mail</h3>
      <p><span class="method">GET</span> <span class="url">/api/customer-handler?operation=find&email=EMAIL</span></p>
      <p>Busca informações detalhadas sobre um cliente por e-mail.</p>
      <p>Requer autenticação via token JWT no cabeçalho Authorization.</p>
      <code>
        curl -X GET \\
        https://sua-api.com/api/customer-handler?operation=find&email=cliente@exemplo.com \\
        -H "Authorization: Bearer SEU_TOKEN_JWT"
      </code>
    </div>
    
    <h2>Exemplos de Resposta</h2>
    
    <h3>Criar Cliente</h3>
    <code>
      {
        "success": true,
        "customer": {
          "id": "cus_123456789",
          "name": "Nome do Cliente",
          "email": "cliente@exemplo.com",
          "cpfCnpj": "12345678900",
          "mobilePhone": "11999998888",
          "address": "Rua Exemplo",
          "addressNumber": "123",
          "complement": "Apto 45",
          "province": "Bairro Exemplo",
          "postalCode": "12345678",
          "externalReference": "user_123"
        }
      }
    </code>
    
    <h3>Buscar Cliente</h3>
    <code>
      {
        "success": true,
        "customer": {
          "id": "cus_123456789",
          "name": "Nome do Cliente",
          "email": "cliente@exemplo.com",
          "cpfCnpj": "12345678900",
          "mobilePhone": "11999998888",
          "address": "Rua Exemplo",
          "addressNumber": "123",
          "complement": "Apto 45",
          "province": "Bairro Exemplo",
          "postalCode": "12345678",
          "externalReference": "user_123"
        }
      }
    </code>
    
    <h3>Cliente Já Existente</h3>
    <code>
      {
        "success": false,
        "message": "Cliente com o mesmo CPF/CNPJ já existe",
        "customerId": "cus_123456789"
      }
    </code>
    
    <h2>Códigos de Erro</h2>
    <ul>
      <li><strong>400</strong> - Requisição inválida (parâmetros faltando)</li>
      <li><strong>401</strong> - Não autorizado (token ausente ou inválido)</li>
      <li><strong>403</strong> - Proibido (tentativa de acessar recurso de outro usuário)</li>
      <li><strong>404</strong> - Não encontrado (cliente não existe)</li>
      <li><strong>405</strong> - Método não permitido</li>
      <li><strong>409</strong> - Conflito (cliente já existe)</li>
      <li><strong>500</strong> - Erro interno do servidor</li>
    </ul>
  </body>
  </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
} 