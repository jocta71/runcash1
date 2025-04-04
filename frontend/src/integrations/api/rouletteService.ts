import axios from 'axios';
import config from '@/config/env';
import { filterAllowedRoulettes, isRouletteAllowed, ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

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
  // Sempre buscar dados atualizados da API antes de mostrar os cards
  try {
    console.log('[API] Extraindo dados atualizados de todas as roletas...');
    const response = await api.get('/roulettes');
    if (response.data && Array.isArray(response.data)) {
      // Filtrar apenas as roletas permitidas antes de armazenar em cache
      const allRoulettes = response.data;
      const filteredRoulettes = allRoulettes.filter(roulette => {
        const rouletteId = String(roulette.id || roulette._id || '');
        return isRouletteAllowed(rouletteId);
      });
      
      console.log(`[API] Filtradas ${filteredRoulettes.length} roletas permitidas de um total de ${allRoulettes.length}`);
      
      cachedRoulettes = filteredRoulettes;
      lastCacheTime = now;
      return cachedRoulettes;
    }
    return [];
  } catch (error) {
    console.error('[API] Erro ao extrair dados de roletas:', error);
    return []; // Em caso de erro, retorna array vazio em vez de usar cache antigo
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
 * Extrai números de uma roleta pelo nome (sem simulação)
 */
export const extractRouletteNumbersByName = async (roletaNome: string, limit = 10): Promise<any> => {
  try {
    console.log(`[API] Extraindo números para roleta '${roletaNome}'...`);
    const allRoulettes = await getAllRoulettesWithCache();
    const roleta = allRoulettes.find(r => r.nome === roletaNome);
    
    if (roleta && roleta.numeros && roleta.numeros.length > 0) {
      // Limitar a quantidade de números retornados
      const numeros = Array.isArray(roleta.numeros) ? roleta.numeros.slice(0, limit) : [];
      console.log(`[API] Encontrados ${numeros.length} números para roleta ${roletaNome}`);
      return numeros;
    }
    
    console.warn(`[API] Roleta '${roletaNome}' sem números reais. Retornando array vazio.`);
    return [];
  } catch (error) {
    console.error(`[API] Erro ao extrair números para roleta '${roletaNome}':`, error);
    return [];
  }
};

// Adicionar um mapeamento para IDs canônicos
export const mapToCanonicalRouletteId = (uuid: string, nome?: string): string => {
  // Validar o ID de entrada
  if (!uuid || uuid === 'undefined') {
    console.error(`[API] ID inválido recebido: "${uuid}", verificando nome`);
    // Se temos nome, tentar mapear pelo nome
    if (nome) {
      const mappedId = mapRouletteNameToId(nome);
      if (mappedId) {
        console.log(`[API] Mapeado nome "${nome}" para ID canônico ${mappedId}`);
        return mappedId;
      }
    }
    console.warn(`[API] Não foi possível mapear ID vazio, usando fallback "2010096"`);
    return "2010096"; // Fallback para Speed Auto Roulette
  }

  // Verificar se o ID já é numérico (formato canônico)
  if (/^\d+$/.test(uuid)) {
    console.log(`[API] ID ${uuid} já é um ID canônico no formato numérico`);
    return uuid;
  }

  // Verificar se o ID já é um dos IDs permitidos específicos
  if (ROLETAS_PERMITIDAS.includes(uuid)) {
    console.log(`[API] ID ${uuid} já é um ID canônico válido na lista de permitidos`);
    return uuid;
  }

  // MAPEAMENTO COMPLETO: Tabela de conversão de UUIDs para IDs canônicos
  const uuidToIdMap: Record<string, string> = {
    // Brazilian Mega Roulette (2380335)
    "7d3c2c9f-2850-f642-861f-5bb4daf1806a": "2380335",
    "7d3c2c9f2850f642861f5bb4daf1806a": "2380335",
    
    // Immersive Roulette (2010016)
    "1f156e80-ba21-11e5-b4c9-005056a03af2": "2010016",
    "1f156e80ba2111e5b4c9005056a03af2": "2010016",
    "f27dd03e-5282-fc78-961c-6375cef91565": "2010016",
    "f27dd03e5282fc78961c6375cef91565": "2010016",
    
    // Speed Auto Roulette (2010096)
    "e95fe030-c341-11e8-a12e-005056a03af2": "2010096",
    "e95fe030c34111e8a12e005056a03af2": "2010096",
    
    // Bucharest Auto-Roulette (2010065)
    "d7115270-fec9-11e8-81a4-0025907e870c": "2010065",
    "d7115270fec911e881a40025907e870c": "2010065",
    
    // Auto-Roulette (2010017)
    "12de4qt1-c791-11e8-a01c-005056a03af2": "2010017",
    "12de4qt1c79111e8a01c005056a03af2": "2010017",
    
    // Auto-Roulette VIP (2010098)
    "303f7ca0-c415-11e8-a12e-005056a03af2": "2010098",
    "303f7ca0c41511e8a12e005056a03af2": "2010098",
    
    // Mapeamentos adicionais observados nos logs
    "180dc4ea-d884-c47a-d33f-27a268a4eead": "2010016", // Immersive
    "e345afa9-e387-9412-209c-e793fe7ae520": "2010065", // Bucharest
    "4cf27e48-2b9d-b58e-7dcc-4826c51de39": "2010017",  // Auto-Roulette
    "419aa56c-bcff-67d2-f424-a6501bac4a36": "2010096"  // Speed Auto
  };

  // Remover hifens e converter para lowercase para aumentar chances de correspondência
  const normalizedUuid = uuid.replace(/-/g, '').toLowerCase();
  
  // Tentar encontrar correspondência pelo UUID normalizado
  for (const [key, value] of Object.entries(uuidToIdMap)) {
    const normalizedKey = key.replace(/-/g, '').toLowerCase();
    if (normalizedUuid === normalizedKey) {
      console.log(`[API] Mapeado UUID normalizado "${uuid}" para ID canônico ${value}`);
      return value;
    }
  }

  // Se o UUID está no mapeamento direto, usá-lo
  if (uuidToIdMap[uuid]) {
    console.log(`[API] Mapeando UUID "${uuid}" para ID canônico ${uuidToIdMap[uuid]}`);
    return uuidToIdMap[uuid];
  }

  // Mapeamento baseado nos nomes das roletas (como fallback)
  if (nome) {
    const mappedId = mapRouletteNameToId(nome);
    if (mappedId) {
      console.log(`[API] Mapeando pelo nome da roleta "${nome}" para ID canônico ${mappedId}`);
      return mappedId;
    }
  }

  // Fallback final: verificar manualmente pelo padrão de ID da roleta
  // Speed Auto Roulette
  if (uuid.includes("Speed") || uuid.toLowerCase().includes("speed")) {
    console.log(`[API] Mapeamento por padrão de nome: "${uuid}" -> Speed Auto Roulette (2010096)`);
    return "2010096";
  }
  // Brazilian Mega
  if (uuid.includes("Brazilian") || uuid.toLowerCase().includes("brazil")) {
    console.log(`[API] Mapeamento por padrão de nome: "${uuid}" -> Brazilian Mega Roulette (2380335)`);
    return "2380335";
  }
  // Immersive
  if (uuid.includes("Immersive") || uuid.toLowerCase().includes("immersive")) {
    console.log(`[API] Mapeamento por padrão de nome: "${uuid}" -> Immersive Roulette (2010016)`);
    return "2010016";
  }
  // Auto-Roulette
  if (uuid.includes("Auto-Roulette") && !uuid.includes("VIP") && !uuid.includes("Bucharest")) {
    console.log(`[API] Mapeamento por padrão de nome: "${uuid}" -> Auto-Roulette (2010017)`);
    return "2010017";
  }
  // Auto-Roulette VIP
  if (uuid.includes("VIP") || uuid.toLowerCase().includes("vip")) {
    console.log(`[API] Mapeamento por padrão de nome: "${uuid}" -> Auto-Roulette VIP (2010098)`);
    return "2010098";
  }
  // Bucharest
  if (uuid.includes("Bucharest") || uuid.toLowerCase().includes("bucharest")) {
    console.log(`[API] Mapeamento por padrão de nome: "${uuid}" -> Bucharest Auto-Roulette (2010065)`);
    return "2010065";
  }

  // FORCE FALLBACK: Se chegou até aqui e não conseguiu mapear, usar um ID conhecido
  // Isso garante que não enviemos UUIDs não mapeados para o servidor
  console.warn(`[API] ⚠️ Não foi possível mapear UUID "${uuid}" para ID canônico, usando fallback para Speed Auto Roulette`);
  return "2010096"; // Fallback para Speed Auto Roulette
};

// Função auxiliar para mapear nomes de roletas para IDs canônicos
const mapRouletteNameToId = (nome: string): string | null => {
  const nameToIdMap: Record<string, string> = {
    "Immersive Roulette": "2010016",
    "Brazilian Mega Roulette": "2380335",
    "Bucharest Auto-Roulette": "2010065",
    "Speed Auto Roulette": "2010096",
    "Auto-Roulette": "2010017",
    "Auto-Roulette VIP": "2010098"
  };

  return nameToIdMap[nome] || null;
};

// Modificar a função de extração de números para usar o ID canônico
export const extractRouletteNumbersById = async (roletaId: string, limit = 10): Promise<any> => {
  try {
    // Mapear para o ID canônico antes de fazer a requisição
    const canonicalId = mapToCanonicalRouletteId(roletaId);
    console.log(`[API] Extraindo ${limit} números para roleta ID ${roletaId} (canônico: ${canonicalId})...`);

    // Tentar obter dados usando o endpoint novo com o ID canônico
    try {
      const response = await api.get(`/roulette-numbers/${canonicalId}?limit=${limit}`);
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`[API] Encontrados ${response.data.length} números via novo endpoint para roleta ID ${canonicalId}`);
        return response.data;
      }
    } catch (newEndpointError) {
      console.warn(`[API] Erro ao usar novo endpoint para roleta ${canonicalId}:`, newEndpointError);
      // Continuar para tentar o fallback
    }

    // Fallback: buscar da coleção de roletas
    const allRoulettes = await getAllRoulettesWithCache();
    const roleta = allRoulettes.find(r => r.id === roletaId || r.id === canonicalId);
    
    if (roleta && roleta.numeros && roleta.numeros.length > 0) {
      // Transformar para formato esperado pela aplicação
      const numeros = Array.isArray(roleta.numeros) ? roleta.numeros.slice(0, limit).map(n => ({
        numero: n,
        roleta_id: canonicalId,
        roleta_nome: roleta.nome
      })) : [];
      
      console.log(`[API] Encontrados ${numeros.length} números (fallback) para roleta ID ${canonicalId}`);
      return numeros;
    }
    
    console.warn(`[API] Roleta ID ${canonicalId} sem números reais. Retornando array vazio.`);
    return [];
  } catch (error) {
    console.error(`[API] Erro ao extrair números para roleta ${roletaId}:`, error);
    return [];
  }
};

/**
 * Extrai informações de todas as roletas
 */
export const fetchAllRoulettes = async (): Promise<RouletteData[]> => {
  const data = await extractAllRoulettes();
  
  if (Array.isArray(data)) {
    // Formatar os dados para o tipo RouletteData
    const formattedData: RouletteData[] = await Promise.all(data.map(async (roleta: any) => {
      const roletaId = roleta.id || roleta._id;
      
      // Buscar os números desta roleta específica do endpoint correto
      let numeros: number[] = [];
      try {
        // Buscar números da roleta do endpoint específico
        console.log(`[API] Buscando números para roleta ${roletaId} do endpoint específico...`);
        const response = await api.get(`/roulette-numbers/${roletaId}?limit=50`);
        
        if (response.data && Array.isArray(response.data)) {
          // Extrair apenas os números do array de objetos
          numeros = response.data.map((item: any) => {
            if (typeof item.numero === 'number') return item.numero;
            if (typeof item.numero === 'string') return parseInt(item.numero, 10);
            return 0;
          }).filter((n: number) => !isNaN(n));
          
          console.log(`[API] Obtidos ${numeros.length} números para roleta ${roleta.nome} (ID: ${roletaId})`);
        }
      } catch (error) {
        console.warn(`[API] Erro ao buscar números para roleta ${roleta.nome} (ID: ${roletaId}):`, error);
        // Em caso de erro, manter os números existentes no objeto da roleta (se houver)
        if (roleta.numeros && Array.isArray(roleta.numeros)) {
          numeros = roleta.numeros;
        }
      }
      
      return {
        id: roletaId,
        nome: roleta.nome,
        roleta_nome: roleta.roleta_nome || roleta.nome,
        numeros: numeros, // Usar os números obtidos do endpoint específico
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
    }));
    
    // Os dados já foram filtrados anteriormente no getAllRoulettesWithCache
    console.log(`[API] Processadas ${formattedData.length} roletas com dados completos de números`);
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
    // Extrair apenas os números 
    const numbers = data.map((item: any) => {
      // Se for um objeto, extrair o número
      if (typeof item === 'object' && item !== null && item.numero !== undefined) {
        return typeof item.numero === 'number' ? item.numero : parseInt(item.numero, 10);
      }
      // Se for direto um número
      return typeof item === 'number' ? item : parseInt(item, 10);
    }).filter(n => !isNaN(n));
    
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
      // Verificar se o item.numero é válido
      if (typeof item.numero === 'number' && !isNaN(item.numero)) {
        return item.numero;
      } else if (typeof item.numero === 'string' && item.numero.trim() !== '') {
        const parsedValue = parseInt(item.numero, 10);
        if (!isNaN(parsedValue)) return parsedValue;
      }
      // Se chegou aqui, é um valor inválido, retornar 0
      console.warn(`[API] Valor inválido de número encontrado: ${item.numero}, substituindo por 0`);
      return 0;
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
    
    console.warn(`[API] Roleta ID ${roletaId} não encontrada.`);
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
    
    console.warn(`[API] Roleta ID ${roletaId} não encontrada.`);
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
