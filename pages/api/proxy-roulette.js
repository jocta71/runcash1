// pages/api/proxy-roulette.js
// Este endpoint serve como proxy para o backend, evitando problemas de CORS

export default async function handler(req, res) {
  try {
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