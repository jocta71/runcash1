// pages/api/proxy-roulette.js
// Este endpoint serve como proxy para o backend, evitando problemas de CORS

// Variável global para controlar o intervalo entre requisições
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 30000; // Aumento para 30 segundos para maior controle
const CACHE_VALIDITY = 30 * 60 * 1000; // Cache válido por 30 minutos

// Armazenar dados em cache com timestamp
global.rouletteCache = {
  data: null,
  timestamp: 0,
  requestInProgress: false,
  clientsWaiting: []
};

export default async function handler(req, res) {
  try {
    const now = Date.now();
    
    // Estatísticas para debug
    console.log(`[Proxy-Roulette] Recebida requisição, última foi há ${Math.round((now - lastFetchTime)/1000)}s`);
    console.log(`[Proxy-Roulette] Cache ${global.rouletteCache.data ? 'existe' : 'não existe'}, idade: ${Math.round((now - global.rouletteCache.timestamp)/1000)}s`);
    
    // Função para enviar resposta do cache
    const sendCachedResponse = () => {
      if (global.rouletteCache.data) {
        console.log(`[Proxy-Roulette] Retornando dados em cache (${global.rouletteCache.data.length} registros, idade: ${Math.round((now - global.rouletteCache.timestamp)/1000)}s)`);
        return res.status(200).json(global.rouletteCache.data);
      }
      return false;
    };
    
    // 1. Verificar se o cache é válido (menos de 30 minutos)
    const cacheAge = now - global.rouletteCache.timestamp;
    if (cacheAge < CACHE_VALIDITY) {
      // Se temos dados em cache válidos, retornar imediatamente
      if (sendCachedResponse()) return;
    }
    
    // 2. Verificar se o intervalo mínimo já foi respeitado
    const timeSinceLastFetch = now - lastFetchTime;
    
    // 3. Se uma requisição já estiver em andamento, colocar este cliente na fila
    if (global.rouletteCache.requestInProgress) {
      console.log(`[Proxy-Roulette] Requisição já em andamento, aguardando...`);
      
      // Adicionar uma promessa à lista de clientes aguardando
      const responsePromise = new Promise((resolve) => {
        global.rouletteCache.clientsWaiting.push(resolve);
      });
      
      // Aguardar até que a requisição em andamento termine
      await responsePromise;
      
      // Responder com os dados do cache
      return sendCachedResponse();
    }
    
    // 4. Se não passou tempo suficiente desde a última requisição
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
      // Usar dados do cache se existirem
      if (sendCachedResponse()) return;
      
      // Se não temos cache e precisamos esperar, aguardar
      const waitTime = MIN_FETCH_INTERVAL - timeSinceLastFetch;
      console.log(`[Proxy-Roulette] Respeitando intervalo mínimo. Aguardando ${Math.round(waitTime/1000)}s...`);
      
      // Aguardar o tempo necessário
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // 5. Marcar que uma requisição está em andamento (semáforo)
    global.rouletteCache.requestInProgress = true;
    
    try {
      // Atualizar o timestamp da última requisição
      lastFetchTime = Date.now();
      
      // Obter parâmetros da query
      const { limit = 1000 } = req.query;
      
      console.log(`[Proxy-Roulette] Buscando dados com limit=${limit}`);
      
      // URL da API backend
      const apiUrl = `https://backendapi-production-36b5.up.railway.app/api/ROULETTES`;
      
      // Buscar dados do backend
      const response = await fetch(apiUrl);
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
      }
      
      // Converter resposta para JSON
      const data = await response.json();
      
      // Log do tamanho dos dados
      console.log(`[Proxy-Roulette] Recebidos ${data.length} registros da API`);
      
      // Atualizar cache global
      global.rouletteCache.data = data;
      global.rouletteCache.timestamp = Date.now();
      
      // Notificar todos os clientes que estavam aguardando
      if (global.rouletteCache.clientsWaiting.length > 0) {
        console.log(`[Proxy-Roulette] Notificando ${global.rouletteCache.clientsWaiting.length} clientes em espera`);
        global.rouletteCache.clientsWaiting.forEach(resolve => resolve());
        global.rouletteCache.clientsWaiting = [];
      }
      
      // Retornar dados para o frontend
      res.status(200).json(data);
    } finally {
      // Independente do resultado, marcar que a requisição terminou
      global.rouletteCache.requestInProgress = false;
    }
  } catch (error) {
    // Log de erro detalhado
    console.error('[Proxy-Roulette] Erro ao buscar dados do backend:', error);
    
    // Se temos cache, retornar os dados do cache mesmo expirados em caso de erro
    if (global.rouletteCache.data) {
      console.log(`[Proxy-Roulette] Retornando dados em cache devido a erro (${global.rouletteCache.data.length} registros)`);
      return res.status(200).json(global.rouletteCache.data);
    }
    
    // Retornar erro para o frontend
    res.status(500).json({ 
      error: 'Falha ao buscar dados da API',
      message: error.message 
    });
  }
} 