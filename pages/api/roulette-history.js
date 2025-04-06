// pages/api/roulette-history.js
// Este endpoint busca múltiplos conjuntos de dados do backend e os combina
// para criar um histórico mais completo

export default async function handler(req, res) {
  try {
    // URL base da API
    const apiUrl = 'https://backendapi-production-36b5.up.railway.app/api/ROULETTES';
    
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
    res.status(200).json({
      total: allNumbers.length,
      limit,
      data: limitedNumbers
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ 
      error: 'Falha ao buscar histórico',
      message: error.message 
    });
  }
} 