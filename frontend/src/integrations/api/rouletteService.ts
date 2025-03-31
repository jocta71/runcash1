import axios from 'axios';
import config from '@/config/env';

// Usar a variável de ambiente centralizada do config
const API_URL = config.apiBaseUrl;
console.log('[API] Usando URL da API:', API_URL);

// Configuração do axios com headers padrão
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',  // Adicionar este header para ignorar a tela de proteção do ngrok
    'bypass-tunnel-reminder': 'true'       // Ignorar lembrete do serviço de túnel
  },
  // Adicionar timeout mais longo para permitir conexões mais lentas
  timeout: 10000,
});

// Tipos e interfaces necessárias
export interface RouletteData {
  id: string;
  nome: string;
  roleta_nome?: string;
  numeros: number[];
  updated_at: string;
  estado_estrategia: string;
  numero_gatilho: number;
  numero_gatilho_anterior: number;
  terminais_gatilho: number[];
  terminais_gatilho_anterior: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
}

export interface LatestRouletteNumber {
  id: string;
  nome: string;
  numero_recente: number | null;
  estado_estrategia: string;
  numero_gatilho: number;
  vitorias: number;
  derrotas: number;
  sugestao_display: string;
  updated_at: string;
}

export interface RouletteNumberRecord {
  id: string;
  roleta_id: string;
  roleta_nome: string;
  numero: number;
  timestamp: string;
}

export interface RouletteStrategy {
  estado: string;
  numero_gatilho: number | null;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
}

// Manter o cache de roletas para evitar múltiplas chamadas
let cachedRoulettes: any[] = [];
let lastCacheTime = 0;
const CACHE_DURATION = 10 * 1000; // 10 segundos

/**
 * Função auxiliar para obter e cachear todas as roletas
 */
const getAllRoulettesWithCache = async (forceRefresh = false): Promise<any[]> => {
  const now = Date.now();
  // Usar cache se disponível e não expirado
  if (!forceRefresh && cachedRoulettes.length > 0 && (now - lastCacheTime) < CACHE_DURATION) {
    console.log('[API] Usando dados em cache para roletas');
    return cachedRoulettes;
  }
  
  try {
    console.log('[API] Extraindo dados de todas as roletas...');
    const response = await api.get('/roulettes');
    if (response.data && Array.isArray(response.data)) {
      cachedRoulettes = response.data;
      lastCacheTime = now;
      console.log(`[API] Atualizando cache com ${cachedRoulettes.length} roletas`);
      return cachedRoulettes;
    }
    return [];
  } catch (error) {
    console.error('[API] Erro ao extrair dados de roletas:', error);
    return cachedRoulettes.length > 0 ? cachedRoulettes : []; // Usar cache mesmo expirado em caso de erro
  }
};

/**
 * Extrai lista de nomes de roletas disponíveis
 */
export const extractAvailableRoulettes = async (): Promise<any[]> => {
  try {
    const allRoulettes = await getAllRoulettesWithCache();
    return allRoulettes;
  } catch (error) {
    console.error('[API] Erro ao extrair roletas disponíveis:', error);
    return [];
  }
};

/**
 * Extrai informações de todas as roletas
 */
export const extractAllRoulettes = async (): Promise<any[]> => {
  return await getAllRoulettesWithCache();
};

/**
 * Extrai números de uma roleta pelo nome
 */
export const extractRouletteNumbersByName = async (roletaNome: string, limit = 10): Promise<any> => {
  try {
    console.log(`[API] Extraindo números para roleta '${roletaNome}'...`);
    const allRoulettes = await getAllRoulettesWithCache();
    const roleta = allRoulettes.find(r => r.nome === roletaNome);
    
    if (roleta && roleta.numeros) {
      // Limitar a quantidade de números retornados
      const numeros = Array.isArray(roleta.numeros) ? roleta.numeros.slice(0, limit) : [];
      console.log(`[API] Encontrados ${numeros.length} números para roleta ${roletaNome}`);
      return numeros;
    }
    
    console.warn(`[API] Roleta '${roletaNome}' não encontrada ou sem números`);
    return [];
  } catch (error) {
    console.error(`[API] Erro ao extrair números para roleta '${roletaNome}':`, error);
    return [];
  }
};

/**
 * Extrai números de uma roleta pelo ID
 */
export const extractRouletteNumbersById = async (roletaId: string, limit = 10): Promise<any> => {
  try {
    console.log(`[API] Extraindo ${limit} números para roleta ID ${roletaId}...`);
    const allRoulettes = await getAllRoulettesWithCache();
    const roleta = allRoulettes.find(r => r.id === roletaId);
    
    if (roleta && roleta.numeros) {
      // Transformar para formato esperado pela aplicação
      const numeros = Array.isArray(roleta.numeros) ? roleta.numeros.slice(0, limit).map(n => ({
        numero: n,
        roleta_id: roletaId,
        roleta_nome: roleta.nome
      })) : [];
      
      console.log(`[API] Encontrados ${numeros.length} números para roleta ID ${roletaId}`);
      return numeros;
    }
    
    console.warn(`[API] Roleta ID ${roletaId} não encontrada ou sem números`);
    return [];
  } catch (error) {
    console.error(`[API] Erro ao extrair números para roleta ${roletaId}:`, error);
    return [];
  }
};

/**
 * Extrai informações da estratégia de uma roleta
 */
export const extractRouletteStrategy = async (roletaId: string): Promise<any> => {
  try {
    console.log(`[API] Extraindo estratégia para roleta ID ${roletaId}...`);
    const allRoulettes = await getAllRoulettesWithCache();
    const roleta = allRoulettes.find(r => r.id === roletaId);
    
    if (roleta) {
      // Construir um objeto de estratégia a partir dos dados da roleta
      return {
        estado: roleta.estado_estrategia || 'NEUTRAL',
        numero_gatilho: roleta.numero_gatilho || null,
        terminais_gatilho: roleta.terminais_gatilho || [],
        vitorias: roleta.vitorias || 0,
        derrotas: roleta.derrotas || 0,
        sugestao_display: roleta.sugestao_display || ''
      };
    }
    
    console.warn(`[API] Roleta ID ${roletaId} não encontrada`);
    return null;
  } catch (error) {
    console.error(`[API] Erro ao extrair estratégia para roleta ${roletaId}:`, error);
    return null;
  }
};

/**
 * Extrai informações de uma roleta pelo ID
 */
export const extractRouletteById = async (roletaId: string): Promise<any> => {
  try {
    console.log(`[API] Extraindo dados da roleta ${roletaId}...`);
    const allRoulettes = await getAllRoulettesWithCache();
    const roleta = allRoulettes.find(r => r.id === roletaId);
    
    if (roleta) {
      return roleta;
    }
    
    console.warn(`[API] Roleta ID ${roletaId} não encontrada`);
    return null;
  } catch (error) {
    console.error(`[API] Erro ao extrair dados da roleta ${roletaId}:`, error);
    return null;
  }
};

// ===== FUNÇÕES DE PROCESSAMENTO DE DADOS =====
// Estas funções processam os dados extraídos e os formatam conforme necessário

/**
 * Processa a lista de nomes de roletas
 */
export const fetchAvailableRoulettesFromNumbers = async (): Promise<string[]> => {
  const data = await extractAvailableRoulettes();
  
  if (Array.isArray(data)) {
    const rouletteNames = data.map((roleta: any) => roleta.nome);
    console.log('[API] Roletas disponíveis:', rouletteNames);
    return rouletteNames;
  }
  
  console.warn('[API] Formato de resposta inválido ou sem roletas');
  return [];
};

/**
 * Processa informações de todas as roletas
 */
export const fetchAllRoulettes = async (): Promise<RouletteData[]> => {
  const data = await extractAllRoulettes();
  
  if (Array.isArray(data)) {
    // Formatar os dados para o tipo RouletteData
    const formattedData: RouletteData[] = data.map((roleta: any) => ({
      id: roleta.id || roleta._id,
      nome: roleta.nome,
      roleta_nome: roleta.roleta_nome || roleta.nome,
      numeros: roleta.numeros || [],
      updated_at: roleta.updated_at || new Date().toISOString(),
      estado_estrategia: roleta.estado_estrategia || 'NEUTRAL',
      numero_gatilho: roleta.numero_gatilho || 0,
      numero_gatilho_anterior: roleta.numero_gatilho_anterior || 0,
      terminais_gatilho: roleta.terminais_gatilho || [],
      terminais_gatilho_anterior: roleta.terminais_gatilho_anterior || [],
      vitorias: roleta.vitorias || 0,
      derrotas: roleta.derrotas || 0,
      sugestao_display: roleta.sugestao_display || ''
    }));
    
    console.log(`[API] Processadas ${formattedData.length} roletas`);
    return formattedData;
  }
  
  console.warn('[API] Formato de resposta inválido ou sem roletas');
  return [];
};

/**
 * Processa números de uma roleta por nome
 */
export const fetchRouletteLatestNumbersByName = async (roletaNome: string, limit = 10): Promise<number[]> => {
  const data = await extractRouletteNumbersByName(roletaNome, limit);
  
  if (data && Array.isArray(data)) {
    // Extrair apenas os números do array de objetos
    const numbers = data.map((item: any) => item.numero);
    console.log(`[API] Retornando ${numbers.length} números para roleta '${roletaNome}'`);
    return numbers;
  }
  
  console.warn(`[API] Nenhum número encontrado para roleta '${roletaNome}'`);
  return [];
};

/**
 * Processa números de uma roleta por ID
 */
export const fetchRouletteLatestNumbers = async (roletaId: string, limit = 10): Promise<number[]> => {
  const data = await extractRouletteNumbersById(roletaId, limit);
  
  if (data && Array.isArray(data)) {
    // Extrair apenas os números do array de objetos
    const numbers = data.map((item: any) => {
      return typeof item.numero === 'number' ? item.numero : parseInt(item.numero, 10);
    });
    console.log(`[API] Processados ${numbers.length} números para roleta ID ${roletaId}:`, numbers);
    return numbers;
  }
  
  console.warn(`[API] Nenhum número encontrado para roleta ID ${roletaId}`);
  return [];
};

/**
 * Processa informações de uma roleta pelo ID
 */
export const fetchRouletteById = async (id: string): Promise<RouletteData> => {
  const roleta = await extractRouletteById(id);
  
  if (roleta) {
    // Formatar os dados para o tipo RouletteData
    return {
      id: roleta.id || roleta._id,
      nome: roleta.nome,
      roleta_nome: roleta.roleta_nome || roleta.nome,
      numeros: roleta.numeros || [],
      updated_at: roleta.updated_at || new Date().toISOString(),
      estado_estrategia: roleta.estado_estrategia || 'NEUTRAL',
      numero_gatilho: roleta.numero_gatilho || 0,
      numero_gatilho_anterior: roleta.numero_gatilho_anterior || 0,
      terminais_gatilho: roleta.terminais_gatilho || [],
      terminais_gatilho_anterior: roleta.terminais_gatilho_anterior || [],
      vitorias: roleta.vitorias || 0,
      derrotas: roleta.derrotas || 0,
      sugestao_display: roleta.sugestao_display || ''
    };
  }
  
  throw new Error(`Roleta com ID ${id} não encontrada`);
};

/**
 * Processa a estratégia de uma roleta
 */
export const fetchRouletteStrategy = async (roletaId: string): Promise<RouletteStrategy | null> => {
  // Primeiro, tentar obter a estratégia principal
  const strategyData = await extractRouletteStrategy(roletaId);
  
  if (strategyData) {
    // Verificar se temos os dados de vitórias e derrotas
    const vitorias = strategyData.vitorias !== undefined ? parseInt(strategyData.vitorias) : 0;
    const derrotas = strategyData.derrotas !== undefined ? parseInt(strategyData.derrotas) : 0;
    
    console.log(`[API] Estratégia processada para roleta ID ${roletaId}:`, {
      vitorias, 
      derrotas, 
      estado: strategyData.estado
    });
    
    // Se não temos valores válidos de vitórias/derrotas, tentar obter da roleta
    if ((vitorias === 0 && derrotas === 0) || vitorias === null || derrotas === null) {
      const roletaData = await extractRouletteById(roletaId);
      
      if (roletaData) {
        let vitoriasFinais = vitorias;
        let derrotasFinais = derrotas;
        
        // Verificar se há valores na resposta da roleta
        if (roletaData.vitorias !== undefined && roletaData.vitorias !== null) {
          vitoriasFinais = parseInt(roletaData.vitorias);
        }
        
        if (roletaData.derrotas !== undefined && roletaData.derrotas !== null) {
          derrotasFinais = parseInt(roletaData.derrotas);
        }
        
        console.log(`[API] Dados complementares processados da roleta:`, {
          vitorias: vitoriasFinais,
          derrotas: derrotasFinais
        });
        
        return {
          estado: strategyData.estado || 'NEUTRAL',
          numero_gatilho: strategyData.numero_gatilho || null,
          terminais_gatilho: strategyData.terminais_gatilho || [],
          vitorias: vitoriasFinais || 0,
          derrotas: derrotasFinais || 0,
          sugestao_display: strategyData.sugestao_display || ''
        };
      }
    }
    
    // Usar os dados originais
    return {
      estado: strategyData.estado || 'NEUTRAL',
      numero_gatilho: strategyData.numero_gatilho || null,
      terminais_gatilho: strategyData.terminais_gatilho || [],
      vitorias: vitorias || 0,
      derrotas: derrotas || 0,
      sugestao_display: strategyData.sugestao_display || ''
    };
  }
  
  console.warn(`[API] Nenhum dado de estratégia encontrado para roleta ID ${roletaId}`);
  return null;
};
