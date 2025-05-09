const cors = require('cors');

// Função para determinar a cor do número na roleta
function determinarCor(numero) {
  if (numero === 0) return 'green';
  const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return vermelhos.includes(numero) ? 'red' : 'black';
}

// Função para gerar dados simulados de roletas
function gerarRoletasSimuladas() {
  const roletas = [];
  
  // Nomes e provedores de roletas populares
  const provedores = ['Evolution', 'Pragmatic', 'Playtech', 'Ezugi', 'Vivo', 'Authentic'];
  const nomes = ['Roulette Live', 'Lightning Roulette', 'Auto Roulette', 'Speed Roulette', 'American Roulette', 'European Roulette', 'VIP Roulette', 'Prestige Roulette'];
  
  // Gerar entre 8-12 roletas aleatórias
  const numRoletas = 8;
  
  for (let i = 0; i < numRoletas; i++) {
    const nomeProvedor = provedores[Math.floor(Math.random() * provedores.length)];
    const nomeRoleta = nomes[Math.floor(Math.random() * nomes.length)];
    
    // Gerar histórico aleatório de números
    const historico = [];
    const numEntradas = 20 + Math.floor(Math.random() * 15); // 20-35 entradas de histórico
    
    for (let j = 0; j < numEntradas; j++) {
      const numero = Math.floor(Math.random() * 37); // 0-36 para roleta europeia
      historico.push({
        numero,
        cor: determinarCor(numero),
        timestamp: new Date(Date.now() - (numEntradas - j) * 30000).toISOString() // Um número a cada 30 segundos no passado
      });
    }
    
    roletas.push({
      id: `roleta-${i + 1}`,
      nome: `${nomeProvedor} ${nomeRoleta}`,
      provider: nomeProvedor,
      status: 'online',
      numeros_recentes: historico,
    });
  }
  
  return roletas;
}

// Configuração para SSE (Server-Sent Events)
function setupSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Enviar evento de conexão inicial
  res.write('event: connected\ndata: {"message": "Conexão SSE estabelecida"}\n\n');
  
  // Dados iniciais
  const roletas = gerarRoletasSimuladas();
  res.write(`event: roulette:data-updated\ndata: ${JSON.stringify({ roletas })}\n\n`);
  
  // Função para atualizar dados periodicamente
  const atualizarDados = setInterval(() => {
    // Selecionar uma roleta aleatória para atualizar
    const roletaIndex = Math.floor(Math.random() * roletas.length);
    const roleta = roletas[roletaIndex];
    
    // Gerar novo número
    const novoNumero = Math.floor(Math.random() * 37);
    const novaEntrada = {
      numero: novoNumero,
      cor: determinarCor(novoNumero),
      timestamp: new Date().toISOString()
    };
    
    // Adicionar ao histórico
    roleta.numeros_recentes.push(novaEntrada);
    if (roleta.numeros_recentes.length > 50) {
      roleta.numeros_recentes.shift(); // Manter apenas os 50 números mais recentes
    }
    
    // Enviar atualização para cliente
    res.write(`event: roulette:new-number\ndata: ${JSON.stringify({ 
      roleta_id: roleta.id, 
      numero: novaEntrada 
    })}\n\n`);
    
    // A cada 5 atualizações, enviar o conjunto completo de dados
    if (Math.random() < 0.2) {
      res.write(`event: roulette:data-updated\ndata: ${JSON.stringify({ roletas })}\n\n`);
    }
  }, 5000); // Atualizar a cada 5 segundos
  
  // Enviar heartbeat a cada 30 segundos para manter a conexão viva
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);
  
  // Limpar intervalos quando a conexão for encerrada
  res.on('close', () => {
    clearInterval(atualizarDados);
    clearInterval(heartbeat);
  });
}

// Handler principal da função
module.exports = (req, res) => {
  // Configuração CORS
  const corsHandler = cors({
    origin: '*',
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
  
  // Processar preflight CORS
  if (req.method === 'OPTIONS') {
    return corsHandler(req, res, () => {
      res.statusCode = 204;
      res.end();
    });
  }
  
  // Processar solicitações que não são GET
  if (req.method !== 'GET') {
    return corsHandler(req, res, () => {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    });
  }
  
  return corsHandler(req, res, () => {
    // Verificar o modo de operação (histórico ou stream)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const mode = url.searchParams.get('mode') || 'historical';
    
    if (mode === 'stream') {
      // Modo stream - configurar SSE
      setupSSE(res);
    } else {
      // Modo histórico - retornar dados de roletas
      setTimeout(() => {
        const roletas = gerarRoletasSimuladas();
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ 
          success: true,
          roletas 
        }));
      }, 500); // Pequeno atraso para simular latência da API
    }
  });
}; 