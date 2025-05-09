// Endpoint para fornecer dados históricos de todas as roletas
const determinarCor = (numero) => {
  if (numero === 0) return 'verde';
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
};

// Dados simulados de roletas para teste
const gerarRoletasSimuladas = () => {
  const roletas = [];
  const casinos = ['Evolution', 'Pragmatic', 'Playtech', 'Ezugi'];
  
  for (let i = 1; i <= 8; i++) {
    const casino = casinos[Math.floor(Math.random() * casinos.length)];
    const numeros = [];
    
    // Gerar histórico de números
    for (let j = 0; j < 50; j++) {
      const numero = Math.floor(Math.random() * 37); // 0-36
      const timestamp = new Date(Date.now() - (j * 60000)); // Um número a cada minuto
      
      numeros.push({
        numero: numero,
        cor: determinarCor(numero),
        timestamp: timestamp.toISOString()
      });
    }
    
    roletas.push({
      id: `roleta_${i}`,
      roleta_id: `roleta_${i}`,
      nome: `Roleta ${casino} ${i}`,
      roleta_nome: `Roleta ${casino} ${i}`,
      provider: casino,
      status: 'online',
      ultimoNumero: numeros[0]?.numero,
      numero: numeros,
      lastUpdateTime: new Date().toISOString()
    });
  }
  
  return roletas;
};

module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Se for uma requisição OPTIONS, retornar 200 imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Simular um pequeno atraso para parecer mais realista
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Gerar dados simulados
    const roletas = gerarRoletasSimuladas();
    
    // Responder com os dados
    return res.status(200).json({
      success: true,
      data: roletas,
      timestamp: new Date().toISOString(),
      count: roletas.length
    });
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar requisição',
      message: error.message
    });
  }
}; 