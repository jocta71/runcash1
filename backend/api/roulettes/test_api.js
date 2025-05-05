/**
 * API de teste para roletas
 * Este script implementa um endpoint único que retorna dados de todas as roletas
 * Com suporte à criptografia para proteger os dados
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const port = process.env.PORT || 3004;

// Chave mestra simulada para criptografia
const MASTER_KEY = 'wh4t3v3r-y0u-w4nt-th1s-t0-b3-32-ch4rs';

// Habilitar CORS
app.use(cors());

// Armazenamento de chaves de clientes
const clientKeys = new Map();

// Dados simulados das roletas
const roletas = [
  {
    id: "a8a1f746-6002-eabf-b14d-d78d13877599",
    nome: "VIP Roulette",
    ativa: true,
    numero: [],
    estado_estrategia: "NEUTRAL",
    vitorias: 0,
    derrotas: 0,
    win_rate: "N/A",
    updated_at: new Date().toISOString()
  },
  {
    id: "ab0ab995-bb00-9b42-57fe-856838109c3d",
    nome: "XXXtreme Lightning Roulette",
    ativa: true,
    numero: [],
    estado_estrategia: "NEUTRAL",
    vitorias: 0,
    derrotas: 0,
    win_rate: "N/A",
    updated_at: new Date().toISOString()
  },
  {
    id: "0b8fdb47-e536-6f43-bf53-96b9a34af3b7",
    nome: "Football Studio Roulette",
    ativa: true,
    numero: [],
    estado_estrategia: "NEUTRAL",
    vitorias: 0,
    derrotas: 0,
    win_rate: "N/A",
    updated_at: new Date().toISOString()
  },
  {
    id: "a11fd7c4-3ce0-9115-fe95-e761637969ad",
    nome: "American Roulette",
    ativa: true,
    numero: [],
    estado_estrategia: "NEUTRAL",
    vitorias: 0,
    derrotas: 0,
    win_rate: "N/A",
    updated_at: new Date().toISOString()
  }
];

// IDs de roletas específicas
const roletaIds = {
  "VIP Roulette": ["2010097", "2380117"],
  "XXXtreme Lightning Roulette": ["2010440"],
  "Football Studio Roulette": ["2010099"],
  "American Roulette": ["2010012"]
};

// Função para gerar um número aleatório de roleta (0-36)
function generateRandomNumber() {
  return Math.floor(Math.random() * 37);
}

// Função para determinar a cor com base no número
function getColor(number) {
  if (number === 0) return 'verde';
  if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number)) {
    return 'vermelho';
  }
  return 'preto';
}

// Função para simular a criptografia dos dados (Fe26.2 format)
function encryptData(data) {
  // Adicionar timestamp se não existir
  if (!data.timestamp) {
    data.timestamp = new Date().toISOString();
  }
  
  // Converter dados para string JSON
  const jsonData = JSON.stringify(data);
  
  // Simulação de criptografia Fe26.2 format
  // Em um sistema real, usaríamos @hapi/iron para selar os dados
  
  // Gerar partes aleatórias para simular o token Fe26.2
  const randomId = crypto.randomBytes(8).toString('hex');
  const randomMac = crypto.randomBytes(12).toString('hex');
  const randomIv = crypto.randomBytes(8).toString('hex');
  
  // Codificar dados em base64
  const encodedData = Buffer.from(jsonData).toString('base64');
  
  // Criar token Fe26.2 simulado
  return `fe26.2**${randomId}**${randomIv}**${encodedData}**${randomMac}`;
}

// Função para encriptação no formato específico solicitado
function encryptEventData(data) {
  // Adicionar timestamp se não existir
  if (!data.timestamp) {
    data.timestamp = Date.now();
  }
  
  // Converter dados para string JSON
  const jsonData = JSON.stringify(data);
  
  // Simulação de criptografia no formato Fe26.2*1*[random]*[random]*[data]*[timestamp]*[mac]*[random]~2
  
  // Gerar partes aleatórias para simular o token
  const part1 = crypto.randomBytes(32).toString('hex');
  const part2 = crypto.randomBytes(11).toString('base64').replace(/=/g, '');
  
  // Para grandes volumes, é mais eficiente não usar Buffer diretamente
  // Otimização para grandes volumes de dados
  let part3 = '';
  try {
    part3 = Buffer.from(jsonData).toString('base64').replace(/=/g, '');
  } catch (e) {
    // Fallback para strings muito grandes
    console.warn('Objeto muito grande para Buffer direto, usando método alternativo');
    part3 = btoa(unescape(encodeURIComponent(jsonData))).replace(/=/g, '');
  }
  
  const timestamp = Date.now();
  const mac = crypto.randomBytes(32).toString('hex');
  const part4 = crypto.randomBytes(22).toString('base64').replace(/=/g, '');
  
  // Criar token no formato solicitado
  return `Fe26.2*1*${part1}*${part2}*${part3}*${timestamp}*${mac}*${part4}~2`;
}

// Função para criptografar os números de uma roleta
function encryptRoletaNumeros(roleta) {
  // Criar uma cópia do objeto
  const roletaCripto = { ...roleta };
  
  // Criptografar cada número individualmente
  roletaCripto.numero = roleta.numero.map(num => {
    return encryptData(num);
  });
  
  return roletaCripto;
}

// Função para criptografar um array de roletas
function encryptRoletas(roletas) {
  return roletas.map(roleta => encryptRoletaNumeros(roleta));
}

// Gerar dados iniciais para todas as roletas
function gerarHistoricoInicial() {
  // Para cada roleta, gerar 20 números
  roletas.forEach(roleta => {
    // Limpar histórico existente
    roleta.numero = [];
    
    // Para cada ID de roleta específica (algumas roletas têm mais de uma mesa)
    const ids = roletaIds[roleta.nome] || ["default-id"];
    
    // Período de tempo para histórico (2 horas atrás até agora)
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).getTime();
    const agora = Date.now();
    
    // Gerar 20 números aleatórios por roleta
    for (let i = 0; i < 20; i++) {
      const numero = generateRandomNumber();
      const cor = getColor(numero);
      
      // Escolher um ID aleatório da lista de IDs para esta roleta
      const roleta_id = ids[Math.floor(Math.random() * ids.length)];
      
      // Timestamp aleatório entre 2 horas atrás e agora
      const timestamp = new Date(Math.floor(Math.random() * (agora - duasHorasAtras) + duasHorasAtras));
      
      // Adicionar ao histórico
      roleta.numero.push({
        numero,
        roleta_id,
        roleta_nome: roleta.nome,
        cor,
        timestamp: timestamp.toISOString()
      });
    }
    
    // Ordenar por timestamp, mais recente primeiro
    roleta.numero.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Atualizar o timestamp de atualização da roleta
    roleta.updated_at = roleta.numero[0]?.timestamp || new Date().toISOString();
  });
}

// Gerar um novo número para uma roleta aleatória periodicamente
function gerarNovoNumero() {
  // Escolher uma roleta aleatória
  const roletaIndex = Math.floor(Math.random() * roletas.length);
  const roleta = roletas[roletaIndex];
  
  // Gerar um novo número
  const numero = generateRandomNumber();
  const cor = getColor(numero);
  
  // Escolher um ID específico para esta roleta
  const ids = roletaIds[roleta.nome] || ["default-id"];
  const roleta_id = ids[Math.floor(Math.random() * ids.length)];
  
  // Timestamp atual
  const timestamp = new Date().toISOString();
  
  // Adicionar ao início do histórico
  roleta.numero.unshift({
    numero,
    roleta_id,
    roleta_nome: roleta.nome,
    cor,
    timestamp
  });
  
  // Limitar o histórico a 20 itens
  if (roleta.numero.length > 20) {
    roleta.numero.pop();
  }
  
  // Atualizar o timestamp da roleta
  roleta.updated_at = timestamp;
  
  console.log(`Novo número gerado para ${roleta.nome}: ${numero} (${cor})`);
}

// Middleware para verificação de chaves
function verificarChave(req, res, next) {
  const clientKey = req.query.k;
  
  // Se a chave não for fornecida, retornar versão criptografada
  if (!clientKey) {
    // Flag para indicar que os dados estão criptografados
    req.dadosCriptografados = true;
    return next();
  }
  
  // Verificar se a chave existe em nosso registro
  if (!clientKeys.has(clientKey)) {
    return res.status(401).json({
      error: 'Chave inválida',
      message: 'A chave fornecida não é válida ou expirou'
    });
  }
  
  // Se a chave for válida, não criptografar os dados
  req.dadosCriptografados = false;
  next();
}

// Endpoint para retornar todas as roletas
app.get('/api/roulettes', verificarChave, (req, res) => {
  if (req.dadosCriptografados) {
    // Retornar dados criptografados
    return res.json(encryptRoletas(roletas));
  }
  
  // Retornar dados descriptografados
  res.json(roletas);
});

// Endpoint para retornar apenas os dados essenciais (formato condensado)
app.get('/api/roulettes/compact/all', verificarChave, (req, res) => {
  const dadosCondensados = roletas.map(roleta => {
    // Pegar apenas o último número (mais recente) para cada roleta
    const ultimoNumero = roleta.numero.length > 0 ? roleta.numero[0] : null;
    
    return {
      id: roleta.id,
      nome: roleta.nome,
      ativa: roleta.ativa,
      ultimo_numero: req.dadosCriptografados && ultimoNumero ? 
                    encryptData(ultimoNumero) : 
                    ultimoNumero,
      total_numeros: roleta.numero.length,
      updated_at: roleta.updated_at
    };
  });
  
  res.json(dadosCondensados);
});

// Endpoint para retornar um formato consolidado dos dados das roletas
app.get('/api/roulettes/consolidated', verificarChave, (req, res) => {
  // Criar uma estrutura consolidada, organizando todos os números de todas as roletas
  // em uma única lista, ordenada por timestamp
  let todosNumeros = [];
  
  roletas.forEach(roleta => {
    // Para cada número da roleta, adicionar informações da roleta
    const numerosProcessados = roleta.numero.map(num => {
      // Criar uma cópia do número com informações adicionais
      const numeroComInfo = {...num};
      
      // Se os dados precisarem ser criptografados
      if (req.dadosCriptografados) {
        return encryptData(numeroComInfo);
      }
      
      return numeroComInfo;
    });
    
    // Adicionar à lista global
    todosNumeros = [...todosNumeros, ...numerosProcessados];
  });
  
  // Ordenar por timestamp, do mais recente para o mais antigo
  if (!req.dadosCriptografados) {
    todosNumeros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  
  // Estrutura da resposta
  const resposta = {
    roletas: roletas.map(r => ({
      id: r.id,
      nome: r.nome,
      ativa: r.ativa
    })),
    numeros: todosNumeros.slice(0, 50), // Limitar a 50 números mais recentes
    total_numeros: todosNumeros.length,
    timestamp: new Date().toISOString()
  };
  
  res.json(resposta);
});

// Endpoint para retornar uma roleta específica por ID
app.get('/api/roulettes/:id', verificarChave, (req, res) => {
  const roleta = roletas.find(r => r.id === req.params.id);
  
  if (!roleta) {
    return res.status(404).json({ error: 'Roleta não encontrada' });
  }
  
  if (req.dadosCriptografados) {
    // Retornar dados criptografados
    return res.json(encryptRoletaNumeros(roleta));
  }
  
  // Retornar dados descriptografados
  res.json(roleta);
});

// Endpoint para retornar os dados em formato de eventos com dados criptografados
app.get('/api/roulettes/events/updates', (req, res) => {
  // Definir os cabeçalhos para formato de texto plano
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Coletar dados de todas as roletas e gerar eventos
  let eventData = '';
  
  roletas.forEach((roleta, index) => {
    // Obter dados completos da roleta para criptografia
    const roletaData = {
      id: roleta.id,
      nome: roleta.nome,
      ativa: roleta.ativa,
      ultimo_numero: roleta.numero.length > 0 ? roleta.numero[0] : null,
      updated_at: roleta.updated_at,
      timestamp: new Date().toISOString()
    };
    
    // Criar um token criptografado no formato solicitado
    const tokenData = encryptEventData(roletaData);
    
    // Adicionar linha de evento
    eventData += `event: update\n`;
    eventData += `id: ${index + 1}\n`;
    eventData += `data: ${tokenData}\n\n`;
  });
  
  // Enviar todos os eventos de uma vez
  res.send(eventData);
});

// Endpoint para retornar os dados em formato SSE (Server-Sent Events) em tempo real
app.get('/api/roulettes/events/stream', (req, res) => {
  // Configurar cabeçalhos para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Função para enviar atualizações
  const sendUpdate = () => {
    roletas.forEach((roleta, index) => {
      // Obter dados relevantes da roleta
      const roletaData = {
        id: roleta.id,
        nome: roleta.nome,
        ativa: roleta.ativa,
        ultimo_numero: roleta.numero.length > 0 ? roleta.numero[0] : null,
        updated_at: roleta.updated_at,
        timestamp: new Date().toISOString()
      };
      
      // Criptografar dados com o formato específico
      const tokenData = encryptEventData(roletaData);
      
      // Enviar evento para o cliente
      res.write(`event: update\n`);
      res.write(`id: ${index + 1}\n`);
      res.write(`data: ${tokenData}\n\n`);
    });
  };
  
  // Enviar dados iniciais
  sendUpdate();
  
  // Configurar um intervalo para enviar atualizações periódicas
  const intervalId = setInterval(sendUpdate, 10000); // A cada 10 segundos
  
  // Quando o cliente desconectar, limpar o intervalo
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Endpoint para retornar todas as roletas em um único evento criptografado
app.get('/api/roulettes/events/all-in-one', (req, res) => {
  // Definir os cabeçalhos para formato de texto plano
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Obter parâmetros de limite (opcional)
  const maxRoletas = req.query.max_roletas ? parseInt(req.query.max_roletas) : undefined;
  const maxNumeros = req.query.max_numeros ? parseInt(req.query.max_numeros) : undefined;
  
  // Criar uma cópia das roletas com limites aplicados
  let roletasData = [...roletas];
  
  // Limitar número de roletas se especificado
  if (maxRoletas && !isNaN(maxRoletas) && maxRoletas > 0) {
    roletasData = roletasData.slice(0, maxRoletas);
  }
  
  // Criar um objeto que contém todos os dados de todas as roletas, com limites de números
  const allData = {
    timestamp: new Date().toISOString(),
    roletas: roletasData.map(roleta => {
      let numeros = [...roleta.numero];
      
      // Limitar número de números por roleta se especificado
      if (maxNumeros && !isNaN(maxNumeros) && maxNumeros > 0) {
        numeros = numeros.slice(0, maxNumeros);
      }
      
      return {
        id: roleta.id,
        nome: roleta.nome,
        ativa: roleta.ativa,
        numeros: numeros,
        total_numeros: roleta.numero.length, // Total real, independente do limite
        updated_at: roleta.updated_at
      };
    }),
    total_roletas: roletas.length, // Total real, independente do limite
    limites_aplicados: {
      max_roletas: maxRoletas,
      max_numeros: maxNumeros
    }
  };
  
  // Criptografar o objeto completo em um único token
  const tokenData = encryptEventData(allData);
  
  // Criar o formato de evento único
  let eventData = 'event: update\n';
  eventData += 'id: 1\n';
  eventData += `data: ${tokenData}\n\n`;
  
  // Enviar o evento único
  res.send(eventData);
});

// Endpoint para gerar uma chave de cliente
app.post('/api/roulettes/keys/generate', (req, res) => {
  // Gerar uma chave única
  const clientKey = crypto.randomBytes(16).toString('hex');
  
  // Armazenar a chave (em um sistema real, seria armazenada em um banco de dados seguro)
  clientKeys.set(clientKey, {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expira em 24 horas
  });
  
  // Retornar a chave para o cliente
  res.json({
    key: clientKey,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    message: 'Use esta chave como parâmetro "k" nas requisições para descriptografar os dados'
  });
});

// Endpoint para documentação da API
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>API de Roletas - Modelo Unificado com Criptografia</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.5; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
          .endpoint { margin-bottom: 20px; }
          code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>API de Roletas - Modelo Unificado com Criptografia</h1>
        <p>Esta API implementa o modelo unificado de acesso aos dados de roletas com criptografia.</p>
        
        <div class="endpoint">
          <h2>POST /api/roulettes/keys/generate</h2>
          <p>Gera uma chave de cliente para descriptografar os dados.</p>
          <pre>curl -X POST http://localhost:${port}/api/roulettes/keys/generate</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /api/roulettes</h2>
          <p>Retorna todas as roletas com seus históricos de números.</p>
          <p>Sem chave: retorna dados criptografados.</p>
          <p>Com chave: retorna dados descriptografados.</p>
          <pre>curl http://localhost:${port}/api/roulettes</pre>
          <pre>curl "http://localhost:${port}/api/roulettes?k=SUA_CHAVE_AQUI"</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /api/roulettes/:id</h2>
          <p>Retorna uma roleta específica com seu histórico de números.</p>
          <pre>curl http://localhost:${port}/api/roulettes/a8a1f746-6002-eabf-b14d-d78d13877599</pre>
          <pre>curl "http://localhost:${port}/api/roulettes/a8a1f746-6002-eabf-b14d-d78d13877599?k=SUA_CHAVE_AQUI"</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /api/roulettes/compact/all</h2>
          <p>Retorna todas as roletas em formato condensado, contendo apenas os dados essenciais 
          e o último número de cada roleta.</p>
          <pre>curl http://localhost:${port}/api/roulettes/compact/all</pre>
          <pre>curl "http://localhost:${port}/api/roulettes/compact/all?k=SUA_CHAVE_AQUI"</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /api/roulettes/consolidated</h2>
          <p>Retorna todos os números de todas as roletas em uma única lista consolidada, 
          ordenada do mais recente para o mais antigo.</p>
          <p>Este endpoint evita duplicação de dados, agrupando informações básicas de roletas 
          e retornando todos os números em uma única lista.</p>
          <pre>curl http://localhost:${port}/api/roulettes/consolidated</pre>
          <pre>curl "http://localhost:${port}/api/roulettes/consolidated?k=SUA_CHAVE_AQUI"</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /api/roulettes/events/updates</h2>
          <p>Retorna dados de todas as roletas no formato de eventos, com cada roleta 
          como um evento separado e dados completamente criptografados.</p>
          <p>Este formato é útil para sistemas que processam fluxos de eventos.</p>
          <pre>curl http://localhost:${port}/api/roulettes/events/updates</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /api/roulettes/events/stream</h2>
          <p>Fornece um fluxo contínuo de eventos SSE (Server-Sent Events) com atualizações 
          em tempo real das roletas, todas criptografadas.</p>
          <p>Ideal para aplicações que necessitam de atualizações em tempo real.</p>
          <pre>curl http://localhost:${port}/api/roulettes/events/stream</pre>
        </div>
        
        <div class="endpoint">
          <h2>GET /api/roulettes/events/all-in-one</h2>
          <p>Retorna todas as roletas e todos os seus números em um único evento criptografado.</p>
          <p>Este endpoint é ideal para sincronização completa dos dados em um único evento.</p>
          <p>Mesmo com grandes volumes de dados (ex: 40 roletas com 1000 números cada), tudo é retornado em um único token criptografado.</p>
          <p><strong>Parâmetros opcionais:</strong></p>
          <ul>
            <li><code>max_roletas</code>: Limita o número máximo de roletas retornadas</li>
            <li><code>max_numeros</code>: Limita o número máximo de números por roleta</li>
          </ul>
          <pre>curl http://localhost:${port}/api/roulettes/events/all-in-one</pre>
          <pre>curl "http://localhost:${port}/api/roulettes/events/all-in-one?max_roletas=10&max_numeros=50"</pre>
        </div>
      </body>
    </html>
  `);
});

// Gerar histórico inicial
gerarHistoricoInicial();

// Gerar novos números periodicamente (a cada 15-30 segundos)
setInterval(() => {
  gerarNovoNumero();
}, Math.random() * 15000 + 15000);

// Iniciar o servidor
app.listen(port, () => {
  console.log(`API de Roletas (modelo unificado com criptografia) rodando em http://localhost:${port}`);
  console.log(`Endpoints disponíveis:`);
  console.log(`- POST /api/roulettes/keys/generate`);
  console.log(`- GET /api/roulettes`);
  console.log(`- GET /api/roulettes/:id`);
  console.log(`- GET /api/roulettes/compact/all`);
  console.log(`- GET /api/roulettes/consolidated`);
  console.log(`- GET /api/roulettes/events/updates`);
  console.log(`- GET /api/roulettes/events/stream`);
  console.log(`- GET /api/roulettes/events/all-in-one`);
}); 