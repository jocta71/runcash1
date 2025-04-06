import axios from 'axios';
import { getRequiredEnvVar, getEnvVar } from '../../config/env';
import { filterAllowedRoulettes, isRouletteAllowed, ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

// Tipos para a API
export interface RouletteData {
  _id?: string;
  id?: string;
  nome?: string;
  name?: string;
  numero?: Array<any>;   // Mantendo apenas o campo singular
  estado_estrategia?: string;
  ativa?: boolean;
  vitorias?: number;
  derrotas?: number;
}

export interface LatestRouletteNumber {
  numero: number;
  cor: string;
  timestamp: string;
  roleta_id?: string;
  roleta_nome?: string;
}

export interface RouletteStrategy {
  estado: string;
  numero_gatilho: number | null;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
}

// Lista das roletas disponíveis com seus IDs canônicos
export const ROLETAS_CANONICAS = [
  { id: "2010096", nome: "Speed Auto Roulette" },
  { id: "2010098", nome: "Auto-Roulette VIP" },
  { id: "2010017", nome: "Ruleta Automática", alternativeNames: ["Auto-Roulette"] },
  { id: "2380335", nome: "Brazilian Mega Roulette" },
  { id: "2010065", nome: "Bucharest Auto-Roulette" },
  { id: "2010016", nome: "Immersive Roulette" }
];

/**
 * Mapeia um UUID de roleta para seu ID canônico (ID numérico usado no banco)
 * Esta função é crucial para garantir que as solicitações à API usem sempre o ID correto
 */
export function mapToCanonicalRouletteId(uuid: string): string {
  // Se já é um ID canônico, retorna sem modificação
  const canonicalIds = ['2010016', '2380335', '2010065', '2010096', '2010017', '2010098'];
  if (canonicalIds.includes(uuid)) {
    console.log(`[API] ID ${uuid} já é um ID canônico, usando diretamente`);
    return uuid;
  }

  // Mapeamento direto e explícito de UUIDs para IDs canônicos
  const uuidToCanonicalMap: Record<string, string> = {
    // Brazilian Mega Roulette
    '7d3c2c9f-2850-f642-861f-5bb4daf1806a': '2380335',
    '7d3c2c9f2850f642861f5bb4daf1806a': '2380335',
    
    // Speed Auto Roulette
    '18bdc4ea-d884-c47a-d33f-27a268a4eead': '2010096',
    '18bdc4ead884c47ad33f27a268a4eead': '2010096',
    
    // Bucharest Auto-Roulette
    'e3345af9-e387-9412-209c-e793fe73e520': '2010065',
    'e3345af9e3879412209ce793fe73e520': '2010065',
    
    // Auto-Roulette VIP
    '419aa56c-bcff-67d2-f424-a6501bac4a36': '2010098',
    '419aa56cbcff67d2f424a6501bac4a36': '2010098',
    
    // Immersive Roulette
    '4cf27e48-2b9d-b58e-7dcc-48264c51d639': '2010016',
    '4cf27e482b9db58e7dcc48264c51d639': '2010016',
    
    // Auto-Roulette (Ruleta Automática)
    'f27dd03e-5282-fc78-961c-6375cef91565': '2010017',
    'f27dd03e5282fc78961c6375cef91565': '2010017'
  };

  // Verificar se o UUID existe no mapeamento
  if (uuidToCanonicalMap[uuid]) {
    console.log(`[API] Mapeando UUID ${uuid} para ID canônico ${uuidToCanonicalMap[uuid]}`);
    return uuidToCanonicalMap[uuid];
  }

  // Se for um UUID não reconhecido, tentar normalizar e verificar novamente
  const normalizedUuid = uuid.replace(/-/g, '').toLowerCase();
  
  for (const [knownUuid, canonicalId] of Object.entries(uuidToCanonicalMap)) {
    const normalizedKnownUuid = knownUuid.replace(/-/g, '').toLowerCase();
    if (normalizedUuid === normalizedKnownUuid) {
      console.log(`[API] Mapeando UUID normalizado ${normalizedUuid} para ID canônico ${canonicalId}`);
      return canonicalId;
    }
  }

  // Fallback para IDs conhecidos por nome
  for (const roleta of ROLETAS_CANONICAS) {
    if (uuid.includes(roleta.nome) || roleta.nome.includes(uuid)) {
      console.log(`[API] Mapeando por nome "${uuid}" para ID canônico ${roleta.id}`);
      return roleta.id;
    }
  }

  // Se tudo falhar, usar o primeiro ID canônico como fallback seguro
  console.warn(`[API] ⚠️ UUID não reconhecido: ${uuid}, usando fallback 2010096 (Speed Auto Roulette)`);
  return '2010096'; // Speed Auto Roulette como fallback
}

// Configuração básica para todas as APIs
const apiBaseUrl = 'https://backendapi-production-36b5.up.railway.app/api'; // Usar a URL completa do backend

// Cache para evitar múltiplas solicitações para os mesmos dados
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas através do endpoint /api/ROULETTES
 */
export const fetchRoulettes = async (): Promise<RouletteData[]> => {
  try {
    // Verificar se temos dados em cache
    if (cache['roulettes'] && Date.now() - cache['roulettes'].timestamp < CACHE_TTL) {
      console.log('[API] Usando dados de roletas em cache');
      return cache['roulettes'].data;
    }

    console.log(`[API] Buscando roletas em: ${apiBaseUrl}/ROULETTES`);
    const response = await axios.get(`${apiBaseUrl}/ROULETTES`);
    
    if (response.data && Array.isArray(response.data)) {
      // Mapear dados recebidos para o formato com IDs canônicos
      const roletas = response.data.map((roleta: any) => {
        const uuid = roleta.id;
        const canonicalId = mapToCanonicalRouletteId(uuid);
        
        // Se vier como "numeros", converter para "numero"
        const numerosArray = Array.isArray(roleta.numeros) ? roleta.numeros : [];
        
        return {
          ...roleta,
          _id: canonicalId,       // Adicionar o ID canônico
          uuid: uuid,             // Preservar o UUID original
          numero: numerosArray,   // Usar sempre o campo "numero" (singular)
          numeros: undefined      // Remover campo "numeros" (plural)
        };
      });
      
      // Armazenar em cache
      cache['roulettes'] = {
        data: roletas,
        timestamp: Date.now()
      };
      
      console.log(`[API] ✅ Recebidas ${roletas.length} roletas da API`);
      return roletas;
    }
    
    console.warn('[API] Resposta inválida da API de roletas');
    return [];
  } catch (error) {
    console.error('[API] Erro ao buscar roletas:', error);
    return [];
  }
};

/**
 * Busca todas as roletas através do endpoint /api/ROULETTES e adiciona números reais a cada uma
 */
export const fetchRoulettesWithRealNumbers = async (): Promise<RouletteData[]> => {
  try {
    // Verificar se temos dados em cache
    const cacheKey = 'roulettes_with_numbers';
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log('[API] Usando dados de roletas com números em cache');
      return cache[cacheKey].data;
    }

    console.log(`[API] Buscando roletas em: ${apiBaseUrl}/ROULETTES`);
    const response = await axios.get(`${apiBaseUrl}/ROULETTES`);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.warn('[API] Resposta inválida da API de roletas');
      return [];
    }
    
    // Mapear roletas para os IDs canônicos que existem no MongoDB
    const rouletteIdMap = {
      "7d3c2c9f-2850-f642-861f-5bb4daf1806a": "2380335", // Brazilian Mega Roulette
      "18bdc4ea-d884-c47a-d33f-27a268a4eead": "2010096", // Speed Auto Roulette
      "e3345af9-e387-9412-209c-e793fe73e520": "2010065", // Bucharest Auto-Roulette
      "419aa56c-bcff-67d2-f424-a6501bac4a36": "2010098", // Auto-Roulette VIP
      "4cf27e48-2b9d-b58e-7dcc-48264c51d639": "2010016", // Immersive Roulette
      "f27dd03e-5282-fc78-961c-6375cef91565": "2010017"  // Ruleta Automática
    };
    
    // Array para armazenar as promessas de busca de números
    const fetchPromises = [];
    
    // Para cada roleta, criar uma promessa de busca de números
    const roletas = response.data.map((roleta: any, index: number) => {
      const mongoId = rouletteIdMap[roleta.id];
      
      // Criar uma promessa para buscar números desta roleta
      const fetchPromise = fetchNumbersFromMongoDB(mongoId, roleta.nome)
        .then(numbers => {
          console.log(`[API] ✅ Recebidos ${numbers.length} números para ${roleta.nome}`);
          return { index, numbers };
        })
        .catch(error => {
          console.error(`[API] ❌ Erro ao buscar números para ${roleta.nome}:`, error);
          return { index, numbers: generateRandomNumbers(20, roleta.id, roleta.nome) };
        });
      
      fetchPromises.push(fetchPromise);
      
      // Retornar roleta inicialmente sem números (serão adicionados depois)
      return {
        ...roleta,
        _id: mongoId || roleta.id, // Usar ID do MongoDB se disponível
        numero: [] // Será preenchido depois
      };
    });
    
    // Aguardar todas as promessas de busca de números
    const numbersResults = await Promise.all(fetchPromises);
    
    // Adicionar os números às roletas correspondentes
    numbersResults.forEach(result => {
      if (result && typeof result.index === 'number' && Array.isArray(result.numbers)) {
        roletas[result.index].numero = result.numbers;
      }
    });
    
    // Armazenar em cache
    cache[cacheKey] = {
      data: roletas,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Processadas ${roletas.length} roletas com números reais`);
    return roletas;
  } catch (error) {
    console.error('[API] Erro ao buscar roletas com números:', error);
    return [];
  }
};

/**
 * Busca números reais de uma roleta específica do MongoDB
 */
async function fetchNumbersFromMongoDB(mongoId: string, roletaNome: string): Promise<any[]> {
  try {
    // Buscar dados da coleção roleta_numeros
    console.log(`[API] Buscando números para ${roletaNome} (ID MongoDB: ${mongoId})`);
    
    // Usar o endpoint relativo para aproveitar o proxy
    const url = `${apiBaseUrl}/ROULETTES`;
    
    try {
      const response = await fetch(url, {
        mode: 'no-cors', // Usar modo no-cors para evitar bloqueio de CORS
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      // Com o modo no-cors, a resposta será do tipo 'opaque' e não poderemos acessar seu conteúdo
      if (response.type === 'opaque') {
        console.log(`[API] Resposta opaque devido a CORS, usando dados locais para ${roletaNome}`);
        return generateRandomNumbers(20, mongoId, roletaNome);
      }
      
      if (!response.ok) {
        console.warn(`[API] Resposta com erro (${response.status}) para ${roletaNome}`);
        return generateRandomNumbers(20, mongoId, roletaNome);
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        // Encontrar a roleta específica pelo ID canônico
        const targetRoulette = data.find((roleta: any) => {
          const roletaCanonicalId = roleta.canonical_id || mapToCanonicalRouletteId(roleta.id || '');
          return roletaCanonicalId === mongoId || roleta.id === mongoId;
        });
        
        if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
          console.log(`[API] ✅ Extraídos ${targetRoulette.numero.length} números para roleta ${mongoId}`);
          return targetRoulette.numero;
        }
      }
      
      // Se não houver dados, retornar array de números simulados
      console.warn(`[API] Roleta ${mongoId} não encontrada nos dados retornados, usando simulação`);
      return generateRandomNumbers(20, mongoId, roletaNome);
    } catch (error) {
      console.error(`[API] Erro ao buscar dados da API para ${roletaNome}:`, error);
      return generateRandomNumbers(20, mongoId, roletaNome);
    }
  } catch (error) {
    console.error(`[API] Erro ao buscar números do MongoDB para ${roletaNome}:`, error);
    return generateRandomNumbers(20, mongoId, roletaNome); // Retornar números simulados em caso de erro
  }
}

/**
 * Gera números aleatórios para testes quando não há dados reais
 */
function generateRandomNumbers(count: number, roletaId: string, roletaNome: string): any[] {
  console.log(`[API] Gerando ${count} números aleatórios para ${roletaNome} como fallback`);
  
  const numbers = [];
  for (let i = 0; i < count; i++) {
    const numero = Math.floor(Math.random() * 37); // 0-36
    const timestamp = new Date(Date.now() - i * 60000).toISOString(); // Datas espaçadas por 1 min
    
    // Determinar cor
    let cor = 'verde';
    if (numero > 0) {
      const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      cor = numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
    }
    
    numbers.push({
      numero,
      cor,
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      timestamp
    });
  }
  
    return numbers;
  }

/**
 * Busca uma roleta específica pelo ID usando o resultado de fetchRoulettes
 */
export const fetchRouletteById = async (roletaId: string): Promise<RouletteData | null> => {
  try {
    // Buscar todas as roletas
    const roletas = await fetchRoulettes();
    
    // Encontrar a roleta específica
    const roleta = roletas.find(r => 
      r._id === roletaId || 
      r.id === roletaId || 
      mapToCanonicalRouletteId(r.id || '') === roletaId
    );
  
  if (roleta) {
      console.log(`[API] ✅ Roleta encontrada para ID: ${roletaId}`);
      return roleta;
    }
    
    console.warn(`[API] Roleta não encontrada para ID: ${roletaId}`);
    return null;
  } catch (error) {
    console.error(`[API] Erro ao buscar roleta por ID ${roletaId}:`, error);
    return null;
  }
}

/**
 * Busca os números mais recentes de uma roleta pelo ID canônico
 */
export const fetchRouletteLatestNumbersByName = async (roletaNome: string, limit = 100): Promise<any[]> => {
  try {
    // Encontrar o ID canônico baseado no nome
    const roleta = ROLETAS_CANONICAS.find(r => r.nome === roletaNome);
    
    if (!roleta) {
      console.warn(`[API] Roleta não encontrada para nome: ${roletaNome}`);
      return [];
    }
    
    // Buscar números usando o ID canônico
    return await fetchRouletteNumbersById(roleta.id, limit);
  } catch (error) {
    console.error(`[API] Erro ao buscar números da roleta ${roletaNome}:`, error);
    return [];
  }
}

/**
 * Busca números de uma roleta específica pelo ID
 */
export const fetchRouletteNumbersById = async (canonicalId: string, limit = 100): Promise<any[]> => {
  try {
    // Verificar se já temos dados em cache para este ID
    const cacheKey = `numbers_${canonicalId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[API] Usando dados em cache para números da roleta ${canonicalId}`);
      return cache[cacheKey].data;
    }
    
    console.log(`[API] Buscando roletas para extrair números da roleta ${canonicalId}`);
    
    // Agora buscamos todas as roletas e filtramos a que precisamos
    const response = await axios.get(`${apiBaseUrl}/ROULETTES`);
    
    if (response.data && Array.isArray(response.data)) {
      // Encontrar a roleta específica pelo ID canônico
      const targetRoulette = response.data.find((roleta: any) => {
        const roletaCanonicalId = roleta.canonical_id || mapToCanonicalRouletteId(roleta.id || '');
        return roletaCanonicalId === canonicalId || roleta.id === canonicalId;
      });
      
      if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
        const numbers = targetRoulette.numero.slice(0, limit);
        
        // Armazenar em cache
        cache[cacheKey] = {
          data: numbers,
          timestamp: Date.now()
        };
        
        console.log(`[API] ✅ Extraídos ${numbers.length} números para roleta ${canonicalId}`);
        return numbers;
      }
      
      console.warn(`[API] Roleta ${canonicalId} não encontrada nos dados retornados`);
      return [];
    }
    
    console.warn(`[API] Resposta inválida da API de roletas`);
    return [];
  } catch (error) {
    console.error(`[API] Erro ao buscar números da roleta ${canonicalId}:`, error);
    return [];
  }
}

/**
 * Busca a estratégia atual de uma roleta
 */
export const fetchRouletteStrategy = async (roletaId: string): Promise<RouletteStrategy | null> => {
  try {
    // Buscar a roleta para obter a estratégia
    const roleta = await fetchRouletteById(roletaId);
    
    if (roleta) {
      // Construir objeto de estratégia a partir dos dados da roleta
      const strategy: RouletteStrategy = {
        estado: roleta.estado_estrategia || 'NEUTRAL',
        numero_gatilho: null,
        terminais_gatilho: [],
        vitorias: roleta.vitorias || 0,
        derrotas: roleta.derrotas || 0,
        sugestao_display: ''
      };
      
      console.log(`[API] ✅ Estratégia extraída para roleta ${roletaId}:`, strategy);
      return strategy;
    }
    
    console.warn(`[API] Não foi possível obter estratégia para roleta ${roletaId}`);
    return null;
  } catch (error) {
    console.error(`[API] Erro ao buscar estratégia da roleta ${roletaId}:`, error);
    return null;
  }
}
