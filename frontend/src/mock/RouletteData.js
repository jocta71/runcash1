/**
 * Dados de mock para roletas com 20 números em vez de 5
 */

export const MOCK_ROULETTE_DATA = {
  type: "all_roulettes_update",
  data: [
    {
      id: "2010165",
      roleta_id: "2010165",
      nome: "Roulette",
      roleta_nome: "Roulette",
      provider: "Desconhecido",
      status: "online",
      numeros: [30, 33, 6, 10, 17, 22, 8, 14, 27, 5, 19, 31, 12, 36, 2, 0, 25, 11, 16, 7],
      ultimoNumero: 30,
      timestamp: 1746979564518
    },
    {
      id: "2010033",
      roleta_id: "2010033",
      nome: "Lightning Roulette",
      roleta_nome: "Lightning Roulette",
      provider: "Desconhecido",
      status: "online",
      numeros: [29, 18, 4, 14, 27, 0, 36, 8, 15, 22, 33, 11, 17, 21, 5, 26, 1, 9, 30, 3],
      ultimoNumero: 29,
      timestamp: 1746979558689
    },
    {
      id: "2010016",
      roleta_id: "2010016",
      nome: "Immersive Roulette",
      roleta_nome: "Immersive Roulette",
      provider: "Desconhecido",
      status: "online",
      numeros: [29, 29, 2, 0, 35, 12, 18, 7, 14, 9, 31, 25, 17, 3, 22, 8, 15, 1, 36, 20],
      ultimoNumero: 29,
      timestamp: 1746979547723
    }
  ],
  _timestamp: 1746979581361
};

/**
 * Função para converter o formato de dados em formato compatível com a API
 */
export const formatRouletteData = (data) => {
  if (!data || !Array.isArray(data.data)) return [];
  
  return data.data.map(roleta => ({
    ...roleta,
    numero: roleta.numeros.map(num => ({
      numero: num
    }))
  }));
};

export default MOCK_ROULETTE_DATA; 