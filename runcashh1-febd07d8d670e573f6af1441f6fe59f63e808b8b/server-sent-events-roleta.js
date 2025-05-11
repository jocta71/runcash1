/**
 * Servidor de Stream de Eventos para Roleta
 * 
 * Este servidor implementa o padrão Server-Sent Events (SSE) para enviar
 * atualizações em tempo real dos números da roleta para clientes web.
 * 
 * Similar ao sistema observado em tipminer.com
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configurações
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/roleta_db";
const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_secreta";
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = process.env.POLL_INTERVAL || 2000; // 2 segundos

// Inicializar Express
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Conexão com MongoDB
let db, collection;
let isConnected = false;

async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    db = client.db();
    collection = db.collection(COLLECTION_NAME);
    isConnected = true;
    
    return true;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    isConnected = false;
    return false;
  }
}

// Middleware de autenticação via JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticação necessário'
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }
    
    req.user = user;
    next();
  });
}

// Endpoint para login e obtenção de token
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Exemplo simples - em produção, validar contra banco de dados
  if (username === 'admin' && password === 'password') {
    const user = {
      id: '1',
      username: username,
      role: 'admin'
    };
    
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token: token
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Credenciais inválidas'
    });
  }
});

// Função para criptografar os dados da roleta
function encryptRouletteData(data) {
  // Gera uma string aleatória para adicionar entropia aos dados
  const randomPart = crypto.randomBytes(12).toString('hex');
  
  // Converte os dados em string JSON e adiciona o timestamp
  const jsonData = JSON.stringify({
    ...data,
    _t: Date.now(),
    _r: randomPart
  });
  
  // Encoda em base64 (similar ao formato observado na requisição de exemplo)
  const base64Data = Buffer.from(jsonData).toString('base64');
  
  return base64Data;
}

// Endpoint SSE para streaming de números da roleta
app.get('/stream/rounds/ROULETTE/:roletaId/v2/live', authenticateToken, async (req, res) => {
  const roletaId = req.params.roletaId;
  
  // Configurar cabeçalhos para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Verificar conexão com MongoDB
  if (!isConnected) {
    await connectToMongoDB();
  }
  
  // ID de evento 
  let eventId = 1;
  
  // Enviar dados iniciais
  const initialData = {
    roleta_id: roletaId,
    numero: Math.floor(Math.random() * 37), // 0-36
    cor: getRouletteColor(Math.floor(Math.random() * 37)),
    timestamp: new Date().toISOString()
  };
  
  const encodedInitialData = encryptRouletteData(initialData);
  
  // Enviar evento inicial
  res.write(`event: update\n`);
  res.write(`id: ${eventId}\n`);
  res.write(`data: ${encodedInitialData}\n\n`);
  
  eventId++;
  
  // Configurar intervalo para enviar atualizações
  const interval = setInterval(async () => {
    try {
      if (!isConnected) {
        await connectToMongoDB();
      }
      
      // Em produção, buscaria no MongoDB o número mais recente
      // Para este exemplo, estamos gerando números aleatórios
      const newData = {
        roleta_id: roletaId,
        numero: Math.floor(Math.random() * 37), // 0-36
        cor: getRouletteColor(Math.floor(Math.random() * 37)),
        timestamp: new Date().toISOString()
      };
      
      const encodedData = encryptRouletteData(newData);
      
      // Enviar o evento
      res.write(`event: update\n`);
      res.write(`id: ${eventId}\n`);
      res.write(`data: ${encodedData}\n\n`);
      
      eventId++;
    } catch (error) {
      console.error('Erro ao enviar atualização:', error);
    }
  }, POLL_INTERVAL);
  
  // Limpar intervalo quando a conexão for fechada
  req.on('close', () => {
    clearInterval(interval);
    console.log('Cliente desconectado do stream de roleta');
  });
});

// Função para determinar a cor do número na roleta
function getRouletteColor(number) {
  if (number === 0) return 'verde';
  
  const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return vermelhos.includes(number) ? 'vermelho' : 'preto';
}

// Endpoint de status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mongodb_connected: isConnected,
    version: '1.0.0'
  });
});

// Iniciar servidor
connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor SSE para roleta iniciado na porta ${PORT}`);
  });
}); 