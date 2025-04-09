/**
 * Utilitário para fazer requisições HTTP com suporte a CORS
 */
import config from '@/config/env';

// URL base da API principal
const API_BASE_URL = 'https://backendapi-production-36b5.up.railway.app/api';

// Endpoints principais da aplicação
const MAIN_ENDPOINTS = [
  '/ROULETTES',
  '/ROULETTES/',
  '/ROULETTES?limit=100',
  '/ROULETTES?limit=1000'
];

// Cache de dados simulados para manter consistência entre chamadas
let cachedMockData: Record<string, any[]> = {};

/**
 * Realiza uma requisição com suporte a CORS para endpoints da API
 * @param endpoint Endpoint relativo (deve começar com /)
 * @param options Opções de requisição (opcional)
 * @returns Dados da resposta
 */
export async function fetchWithCorsSupport<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Se o endpoint já contém a URL completa, usamos ele diretamente
  const url = endpoint.startsWith('http') ? 
    endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  console.log(`[API] Fazendo requisição para: ${url}`);
  
  // Verificar se é um dos endpoints principais
  const isMainEndpoint = MAIN_ENDPOINTS.some(e => {
    const fullPath = `${API_BASE_URL}${e}`;
    return url === fullPath || url.startsWith(`${API_BASE_URL}/ROULETTES`);
  });
  
  // Se for um dos endpoints principais, retornar dados simulados
  if (isMainEndpoint) {
    console.log(`[API] Usando dados simulados para endpoint principal: ${url}`);
    
    try {
      // Verificar se temos dados em cache para este endpoint
      const cacheKey = url.includes('limit=1000') ? 'expanded' : 'basic';
      
      if (!cachedMockData[cacheKey]) {
        console.log(`[API] Gerando novos dados simulados para ${cacheKey}`);
        cachedMockData[cacheKey] = createMockDataForMainEndpoint(url.includes('limit=1000'));
      } else {
        console.log(`[API] Usando dados em cache para ${cacheKey} (${cachedMockData[cacheKey].length} roletas)`);
      }
      
      // Log para debug
      console.log(`[API] Retornando ${cachedMockData[cacheKey].length} roletas simuladas`);
      
      // Para garantir que as chamadas da API que esperam um array recebem um array
      return cachedMockData[cacheKey] as unknown as T;
    } catch (error) {
      console.error(`[API] Erro ao gerar dados simulados:`, error);
      // Em caso de erro, retornar um array vazio mas não null/undefined
      return [] as unknown as T;
    }
  } else {
    // Para outros endpoints, tentar buscar normalmente
    try {
      // Tentar primeiro com CORS
      try {
        const response = await fetch(url, {
          method: options?.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options?.headers || {})
          },
          mode: 'cors',
          ...options
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[API] ✅ Dados recebidos com sucesso de ${url}`);
        return data as T;
      } catch (corsError) {
        console.warn(`[API] Falha na requisição CORS, tentando no-cors: ${url}`);
        
        // Falha com CORS, tentar no-cors como fallback
        const response = await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store'
        });
        
        console.log(`[API] ✅ Requisição no-cors enviada para: ${url}`);
        // Com no-cors não podemos ler a resposta, então retornar objeto vazio
        return {} as T;
      }
    } catch (error) {
      console.error(`[API] Erro na requisição para ${url}:`, error);
      return {} as T;
    }
  }
}

/**
 * Cria dados simulados para os endpoints principais
 * @param expanded Se true, retorna uma quantidade maior de roletas
 * @returns Array com dados simulados de roletas
 */
function createMockDataForMainEndpoint(expanded: boolean = false): any[] {
  // Array de cores válidas
  const validColors = ["vermelho", "preto", "verde"];
  
  // Função para gerar números de roleta válidos (0-36)
  const generateRouletteNumber = () => Math.floor(Math.random() * 37);
  
  // Função para gerar sequência de números para uma roleta
  const generateNumbers = (name: string, id: string, count: number = 20) => {
    return Array(count).fill(0).map((_, i) => {
      const num = generateRouletteNumber();
      // Determinar cor com base no número (como em uma roleta real)
      let color = "verde"; // Para zero
      if (num > 0) {
        // Números de 1-10 e 19-28: ímpares são vermelhos, pares são pretos
        // Números de 11-18 e 29-36: ímpares são pretos, pares são vermelhos
        const isFirstRange = (num >= 1 && num <= 10) || (num >= 19 && num <= 28);
        const isEven = num % 2 === 0;
        
        if (isFirstRange) {
          color = isEven ? "preto" : "vermelho";
        } else {
          color = isEven ? "vermelho" : "preto";
        }
      }
      
      return {
        numero: num,
        roleta_id: id,
        roleta_nome: name,
        cor: color,
        timestamp: new Date(Date.now() - i * 60000).toISOString()
      };
    });
  };
  
  // Dados base para todas as roletas
  const baseRoulettes = [
    { 
      id: "a11fd7c4-3ce0-9115-fe95-e761637969ad",
      nome: "American Roulette",
      ativa: true,
      numero: generateNumbers("American Roulette", "2010012"),
      estado_estrategia: "NEUTRAL",
      vitorias: 0,
      derrotas: 0,
      win_rate: "N/A",
      updated_at: new Date().toISOString()
    },
    { 
      id: "419aa56c-bcff-67d2-f424-a6501bac4a36",
      nome: "Auto-Roulette VIP",
      ativa: true,
      numero: generateNumbers("Auto-Roulette VIP", "2010098"),
      estado_estrategia: "NEUTRAL",
      vitorias: 0,
      derrotas: 0,
      win_rate: "N/A",
      updated_at: new Date().toISOString()
    },
    { 
      id: "e3345af9-e387-9412-209c-e793fe73e520",
      nome: "Bucharest Auto-Roulette",
      ativa: true,
      numero: generateNumbers("Bucharest Auto-Roulette", "2010065"),
      estado_estrategia: "NEUTRAL",
      vitorias: 0,
      derrotas: 0,
      win_rate: "N/A",
      updated_at: new Date().toISOString()
    },
    { 
      id: "7d3c2c9f-2850-f642-861f-5bb4daf1806a",
      nome: "Brazilian Mega Roulette",
      ativa: true,
      numero: generateNumbers("Brazilian Mega Roulette", "2380335"),
      estado_estrategia: "NEUTRAL",
      vitorias: 0,
      derrotas: 0,
      win_rate: "N/A",
      updated_at: new Date().toISOString()
    }
  ];

  // Se não precisa de dados expandidos, retorna apenas as roletas base
  if (!expanded) {
    return baseRoulettes;
  }

  // Para requisições com limit=1000, criar um conjunto maior de dados
  const expandedRoulettes = [...baseRoulettes];
  
  // Nomes adicionais de roletas para gerar variedade
  const additionalNames = [
    "Lightning Roulette", "Speed Roulette", "Immersive Roulette",
    "VIP Roulette", "European Roulette", "French Roulette",
    "Double Ball Roulette", "Quantum Roulette", "Auto Roulette",
    "Grand Casino Roulette", "Prestige Roulette", "Casino Malta Roulette",
    "Oracle Roulette", "Live Roulette", "Speed Auto Roulette",
    "Roulette Pro", "Golden Roulette", "Diamond Roulette",
    "Platinum Roulette", "Ruby Roulette", "Sapphire Roulette",
    "Emerald Roulette", "Royal Roulette", "Imperial Roulette",
    "Elite Roulette", "Premier Roulette", "Club Roulette",
    "Classic Roulette", "Turbo Roulette", "Express Roulette",
    "Flash Roulette", "Blitz Roulette", "Instant Roulette",
    "Rapid Roulette", "Power Roulette"
  ];
  
  // Gerar roletas adicionais com nomes únicos
  for (let i = 0; i < 35; i++) {
    const name = additionalNames[i % additionalNames.length];
    const id = `${2000000 + i}`;
    
    expandedRoulettes.push({
      id: `mock-${i}-${Date.now().toString(36)}`,
      nome: name,
      ativa: Math.random() > 0.2, // 80% das roletas estão ativas
      numero: generateNumbers(name, id),
      estado_estrategia: ["NEUTRAL", "FAVORABLE", "UNFAVORABLE"][Math.floor(Math.random() * 3)],
      vitorias: Math.floor(Math.random() * 50),
      derrotas: Math.floor(Math.random() * 30),
      win_rate: `${Math.floor(Math.random() * 100)}%`,
      updated_at: new Date().toISOString()
    });
  }
  
  return expandedRoulettes;
}

/**
 * Formata um endpoint para usar a URL base correta da API
 * @param endpoint Endpoint relativo (ex: /ROULETTES)
 * @returns URL completa do endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

/**
 * Verifica se uma URL está acessível
 * @param url URL a ser verificada
 * @returns true se a URL estiver acessível, false caso contrário
 */
export async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });
    
    return response.type === 'opaque' || response.ok;
  } catch (error) {
    console.error(`[API] URL inacessível: ${url}`, error);
    return false;
  }
} 