/**
 * Serviço para prover dados simulados de roletas
 * Usado para usuários sem assinatura premium
 */

// Lista de roletas simuladas
const ROLETAS_SIMULADAS = [
  { id: "sim_001", nome: "Speed Roulette Demo" },
  { id: "sim_002", nome: "Immersive Roulette Demo" },
  { id: "sim_003", nome: "Auto-Roulette Demo" },
  { id: "sim_004", nome: "VIP Roulette Demo" },
  { id: "sim_005", nome: "Lobby Roulette Demo" }
];

// Cache para números gerados (para consistência entre chamadas)
const CACHE_NUMEROS = new Map();

// Mantém o mesmo conjunto de dados por 5 minutos
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Gera um número aleatório para roleta (0-36)
 */
function gerarNumeroRoleta() {
  return Math.floor(Math.random() * 37);
}

/**
 * Determina a cor de um número de roleta
 * @param {number} numero Número da roleta
 * @returns {string} Cor (vermelho, preto, verde)
 */
function determinarCorNumero(numero) {
  if (numero === 0) return "verde";
  
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? "vermelho" : "preto";
}

/**
 * Gera um timestamp aleatório entre 1 e 10 minutos no passado
 */
function gerarTimestampRecente() {
  const agora = new Date();
  // Subtrair entre 1 e 10 minutos (em milissegundos)
  const minutosAleatorios = Math.floor(Math.random() * 9) + 1;
  const tempoSubtraido = minutosAleatorios * 60 * 1000;
  agora.setTime(agora.getTime() - tempoSubtraido);
  return agora.toISOString();
}

/**
 * Obter números simulados para uma roleta específica
 * @param {string} roletaId ID da roleta
 * @param {number} limit Quantidade de números a retornar
 * @returns {Array} Array de números simulados
 */
function obterNumerosSimuladosPorId(roletaId, limit = 20) {
  // Verificar se já temos números em cache para esta roleta
  const cacheKey = `${roletaId}-${limit}`;
  
  if (CACHE_NUMEROS.has(cacheKey)) {
    const { timestamp, numeros } = CACHE_NUMEROS.get(cacheKey);
    
    // Verificar se o cache ainda é válido
    if (Date.now() - timestamp < CACHE_TTL) {
      return numeros;
    }
  }
  
  // Buscar informações da roleta
  const roleta = ROLETAS_SIMULADAS.find(r => r.id === roletaId);
  if (!roleta) return [];
  
  // Gerar números simulados
  const numeros = [];
  for (let i = 0; i < limit; i++) {
    const numero = gerarNumeroRoleta();
    numeros.push({
      numero: numero,
      cor: determinarCorNumero(numero),
      roleta_id: roletaId,
      roleta_nome: roleta.nome,
      timestamp: gerarTimestampRecente()
    });
  }
  
  // Ordenar por timestamp (mais recentes primeiro)
  numeros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Armazenar em cache
  CACHE_NUMEROS.set(cacheKey, {
    timestamp: Date.now(),
    numeros: numeros
  });
  
  return numeros;
}

/**
 * Obter todas as roletas simuladas com seus números
 * @param {number} limit Quantidade de números a retornar por roleta
 * @returns {Array} Array de roletas com números
 */
function obterTodasRoletasSimuladas(limit = 20) {
  return ROLETAS_SIMULADAS.map(roleta => {
    const numeros = obterNumerosSimuladosPorId(roleta.id, limit);
    return {
      id: roleta.id,
      nome: roleta.nome,
      ativa: true,
      numero: numeros,
      estado_estrategia: "SIMULADO",
      vitorias: Math.floor(Math.random() * 50),
      derrotas: Math.floor(Math.random() * 30),
      updated_at: new Date().toISOString()
    };
  });
}

/**
 * Obter uma roleta simulada específica com seus números
 * @param {string} roletaId ID da roleta
 * @param {number} limit Quantidade de números a retornar
 * @returns {Object|null} Dados da roleta ou null se não encontrada
 */
function obterRoletaSimuladaPorId(roletaId, limit = 20) {
  const roleta = ROLETAS_SIMULADAS.find(r => r.id === roletaId);
  if (!roleta) return null;
  
  const numeros = obterNumerosSimuladosPorId(roletaId, limit);
  
  return {
    id: roleta.id,
    nome: roleta.nome,
    ativa: true,
    numero: numeros,
    estado_estrategia: "SIMULADO",
    vitorias: Math.floor(Math.random() * 50),
    derrotas: Math.floor(Math.random() * 30),
    updated_at: new Date().toISOString()
  };
}

module.exports = {
  obterTodasRoletasSimuladas,
  obterRoletaSimuladaPorId,
  obterNumerosSimuladosPorId
}; 