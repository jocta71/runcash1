// pages/api/roulette.js
// Este endpoint consolida as funções relacionadas a roletas

export default async function handler(req, res) {
  try {
    // Extrair o caminho da URL
    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Depois de "api", obter a operação (history, proxy, etc)
    const operation = pathSegments[1] === 'roulette' ? pathSegments[2] || '' : '';
    
    // API URL base
    const baseApiUrl = 'https://backendapi-production-36b5.up.railway.app/api/ROULETTES';
    
    // Roteamento com base na operação
    switch(operation) {
      case 'history':
        // Lógica do antigo roulette-history.js
        return await getRouletteHistory(req, res, baseApiUrl);
        
      case 'proxy':
      case '':
        // Lógica do antigo proxy-roulette.js
        return await proxyRoulette(req, res, baseApiUrl);
        
      default:
        return res.status(404).json({ 
          error: 'Endpoint não encontrado',
          message: `Operação '${operation}' não suportada`
        });
    }
  } catch (error) {
    // Log de erro detalhado
    console.error('Erro na API de roleta:', error);
    
    // Retornar erro para o frontend
    res.status(500).json({ 
      error: 'Falha ao processar requisição',
      message: error.message 
    });
  }
}

// Função para buscar histórico de roleta
async function getRouletteHistory(req, res, apiUrl) {
  // Buscar o primeiro conjunto de dados (sem parâmetros extras)
  const response = await fetch(apiUrl);
  
  // Verificar se a resposta foi bem-sucedida
  if (!response.ok) {
    throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
  }
  
  // Converter resposta para JSON
  const roletas = await response.json();
  
  // Log para debugging
  console.log(`Recebidas ${roletas.length} roletas da API`);
  
  // Extrair todos os números do histórico de todas as roletas
  const allNumbers = [];
  
  // Processar cada roleta para extrair seu histórico
  roletas.forEach(roleta => {
    if (roleta.numero && Array.isArray(roleta.numero)) {
      // Adicionar metadados da roleta a cada número
      const numbersWithMeta = roleta.numero.map(num => ({
        ...num,
        roleta_id: roleta.canonical_id || roleta.id,
        roleta_nome: roleta.nome
      }));
      
      // Adicionar ao array principal
      allNumbers.push(...numbersWithMeta);
    }
  });
  
  // Ordenar todos os números por timestamp (mais recentes primeiro)
  allNumbers.sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  // Limitar a quantidade de números retornados (simulando limit=1000)
  const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
  const limitedNumbers = allNumbers.slice(0, limit);
  
  // Log para debugging
  console.log(`Retornando ${limitedNumbers.length} números totais`);
  
  // Retornar os dados combinados
  return res.status(200).json({
    total: allNumbers.length,
    limit,
    data: limitedNumbers
  });
}

// Função para funcionar como proxy da API de roletas
async function proxyRoulette(req, res, apiUrl) {
  // Obter parâmetros da query
  const { limit = 50 } = req.query;
  
  // Log para debugging
  console.log(`Buscando dados com limit=${limit}`);
  
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
  
  // Retornar dados para o frontend
  return res.status(200).json(data);
} 