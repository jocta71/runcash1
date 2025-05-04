import axios from 'axios';
import { getRouletteTypeByName } from '../../utils/roulette-utils';

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

/**
 * Interface para representar um número de roleta
 */
export interface RouletteNumber {
  id: string;
  value: number;
  color?: string;
  timestamp?: string;
  [key: string]: any;
}

// Lista das roletas disponíveis com seus IDs canônicos
// Removendo a lista fixa para não limitar quais roletas são exibidas
export const ROLETAS_CANONICAS: any[] = [];

/**
 * Mapeamento canônico de nomes de roletas para IDs
 * Usado para normalizar os nomes de diferentes origens
 */
export const mapToCanonicalRouletteId = (id: string): string => {
  // Converter para minúsculas e remover espaços
  const normalizedId = id.toLowerCase().trim();
  
  // Tabela de mapeamento para nomes conhecidos
  const mappings: Record<string, string> = {
    'lightning': 'lightning-roulette',
    'lightning roulette': 'lightning-roulette',
    'xxxtreme': 'xxxtreme-lightning',
    'xxxtreme lightning': 'xxxtreme-lightning',
    'immersive': 'immersive-roulette',
    'immersive roulette': 'immersive-roulette',
    'auto': 'auto-roulette',
    'auto roulette': 'auto-roulette',
    'vivo': 'vivo-roulette',
    'vivo roulette': 'vivo-roulette',
    'american': 'american-roulette',
    'american roulette': 'american-roulette',
    'european': 'european-roulette',
    'european roulette': 'european-roulette',
    'french': 'french-roulette',
    'french roulette': 'french-roulette',
  };
  
  // Verificar se temos um mapeamento para este ID
  return mappings[normalizedId] || normalizedId;
};

/**
 * Simplifica nome da roleta para formato canônico
 * @param nomeBruto Nome bruto da roleta
 * @returns Nome simplificado e padronizado
 */
export const simplificarNomeRoleta = (nomeBruto: string): string => {
  if (!nomeBruto) return '';
  
  // Converter para minúsculas e remover espaços extras
  let nome = nomeBruto.toLowerCase().trim();
  
  // Remover palavras comuns que não ajudam na identificação
  nome = nome.replace(/\broulette\b|\bruleta\b|\bcasino\b|\blive\b|\bevo\b/g, '');
  
  // Remover caracteres especiais
  nome = nome.replace(/[^\w\s-]/g, '');
  
  // Remover espaços extras e no início/fim
  nome = nome.replace(/\s+/g, ' ').trim();
  
  // Se ficar vazio, retornar o original
  return nome || nomeBruto.toLowerCase().trim();
};

// Configuração básica para todas as APIs
const apiBaseUrl = '/api'; // Usar o endpoint relativo para aproveitar o proxy

/**
 * IMPORTANTE: Sempre utilizar apenas o endpoint /api/roulettes
 * Outros endpoints como /api/roletas ou /api/ROULETTES foram desativados
 */
const ROULETTES_ENDPOINT = `${apiBaseUrl}/roulettes`;

// Cache para evitar múltiplas solicitações para os mesmos dados
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas através do endpoint /api/roulettes
 * @returns Array com todas as roletas disponíveis
 */
export const fetchAllRoulettes = async (): Promise<any[]> => {
  try {
    // Aqui usaremos a API rouletteApi para buscar as roletas
    const { fetchRoulettesWithNumbers } = await import('./rouletteApi');
    const roulettes = await fetchRoulettesWithNumbers();
    
    return roulettes.map(processRouletteData);
  } catch (error) {
    console.error('Error fetching roulettes:', error);
    return [];
  }
};

/**
 * Função para processar dados brutos da roleta e adicionar informações úteis
 * @param roleta Dados brutos da roleta da API
 * @returns Roleta processada com dados adicionais
 */
export const processRouletteData = (roleta: any): any => {
  if (!roleta) return null;
  
  // Normalizar propriedades
  const nome = roleta.nome || roleta.name || 'Sem nome';
  const id = roleta.id || roleta._id || mapToCanonicalRouletteId(nome);
  
  // Adicionar tipo da roleta
  const rouletteType = getRouletteTypeByName(nome);
  
  return {
    ...roleta,
    id: id,
    nome: nome,
    nome_canonico: nome.toLowerCase().trim(),
    id_canonico: mapToCanonicalRouletteId(id),
    tipo: rouletteType,
    imagem: roleta.imagem || `/images/roulettes/${mapToCanonicalRouletteId(id)}.png`,
    // Certificar-se de que números seja um array
    numeros: Array.isArray(roleta.numeros) ? roleta.numeros : 
             Array.isArray(roleta.numero) ? roleta.numero : []
  };
};

/**
 * Busca todas as roletas através do endpoint /api/roulettes e adiciona números reais a cada uma
 * @returns Array com todas as roletas disponíveis, incluindo números
 */
export const fetchAllRoulettesWithNumbers = async (): Promise<any[]> => {
  try {
    // Aqui usaremos a API rouletteApi para buscar as roletas com números
    const { fetchRoulettesWithNumbers } = await import('./rouletteApi');
    const roulettes = await fetchRoulettesWithNumbers();
    
    return roulettes.map(processRouletteData);
  } catch (error) {
    console.error('Error fetching roulettes with numbers:', error);
    return [];
  }
};

/**
 * Busca uma roleta específica pelo ID usando o resultado de fetchRoulettes
 */
export const fetchRouletteById = async (roletaId: string): Promise<RouletteData | null> => {
  try {
    // Buscar todas as roletas
    const roletas = await fetchAllRoulettes();
    
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
 * Busca números para uma roleta específica por ID
 * Implementa cache para reduzir chamadas ao servidor
 */
export const fetchRouletteNumbersById = async (roletaId: string, limit = 20): Promise<RouletteNumber[] | null> => {
  try {
    // Verificar cache
    const cacheKey = `roulette_numbers_${roletaId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[API] Usando dados em cache para números da roleta ${roletaId}`);
      return cache[cacheKey].data;
    }

    // Obter token de autenticação de várias fontes
    let authToken = '';
    
    // Função para obter cookies
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };
    
    // Tentar obter dos cookies primeiro (mais confiável)
    const tokenCookie = getCookie('token') || getCookie('token_alt');
    if (tokenCookie) {
      authToken = tokenCookie;
      console.log('[API] Usando token de autenticação dos cookies');
    } else {
      // Se não encontrou nos cookies, verificar localStorage
      const possibleKeys = [
        'auth_token_backup',  // Usado pelo AuthContext
        'token',              // Nome do cookie usado na requisição bem-sucedida
        'auth_token',         // Usado em alguns componentes
        'authToken'           // Usado em alguns utilitários
      ];
      
      for (const key of possibleKeys) {
        const storedToken = localStorage.getItem(key);
        if (storedToken) {
          authToken = storedToken;
          console.log(`[API] Usando token de autenticação do localStorage (${key})`);
          
          // Restaurar para cookies se necessário
          try {
            document.cookie = `token=${authToken}; path=/; max-age=2592000`;
            document.cookie = `token_alt=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
            console.log('[API] Token restaurado para cookies');
          } catch (cookieError) {
            console.warn('[API] Erro ao restaurar token para cookies:', cookieError);
          }
          
          break;
        }
      }
    }

    // Configurar headers exatamente como na requisição bem-sucedida
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'accept': 'application/json, text/plain, */*'
    };

    // Adicionar token de autenticação se disponível
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('[API] Token de autenticação adicionado ao cabeçalho da requisição para buscar números da roleta');
    } else {
      console.warn('[API] Nenhum token de autenticação encontrado, tentando acessar endpoint sem autenticação');
    }

    // Usar endpoint base sem parâmetros adicionais
    const endpoint = `/api/roulettes/${roletaId}/numbers`;
    console.log(`[API] Buscando números da roleta ${roletaId} do endpoint ${endpoint}`);
    const response = await axios.get(endpoint, {
      headers,
      withCredentials: true, // Importante: Incluir cookies na requisição
      params: { limit }
    });

    if (response.data && Array.isArray(response.data)) {
      // Guardar em cache
      cache[cacheKey] = {
        data: response.data,
        timestamp: Date.now()
      };
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`[API] Erro ao buscar números para roleta ${roletaId}:`, error);
    return null;
  }
};

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
