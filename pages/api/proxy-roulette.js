// pages/api/proxy-roulette.js
// Este endpoint serve como proxy para o backend, evitando problemas de CORS

// Variável global para controlar o intervalo entre requisições
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 11000; // Intervalo mínimo de 11 segundos entre requisições

export default async function handler(req, res) {
  try {
    // Verificar se o intervalo mínimo já foi respeitado
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
      // Se o intervalo for menor que 11 segundos, esperar até completar
      const waitTime = MIN_FETCH_INTERVAL - timeSinceLastFetch;
      console.log(`Respeitando o intervalo mínimo de polling. Aguardando ${waitTime}ms...`);
      
      // Usar dados em cache se disponíveis
      if (global.lastRouletteData) {
        console.log(`Retornando dados em cache (${global.lastRouletteData.length} registros)`);
        return res.status(200).json(global.lastRouletteData);
      }
      
      // Aguardar o tempo necessário
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Atualizar o timestamp da última requisição
    lastFetchTime = Date.now();
    
    // Obter parâmetros da query
    const { limit = 50 } = req.query;
    
    // Log para debugging
    console.log(`Buscando dados com limit=${limit}`);
    
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
    console.log(`Recebidos ${data.length} registros da API`);
    
    // Armazenar em cache global
    global.lastRouletteData = data;
    
    // Retornar dados para o frontend
    res.status(200).json(data);
  } catch (error) {
    // Log de erro detalhado
    console.error('Erro ao buscar dados do backend:', error);
    
    // Retornar erro para o frontend
    res.status(500).json({ 
      error: 'Falha ao buscar dados da API',
      message: error.message 
    });
  }
} 