// Removendo a importação do mapeamento canônico que pode estar filtrando roletas
// import { mapToCanonicalRouletteId } from './rouletteService';
import { PlanType } from '@/types/plans';
import axios from 'axios';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

// Referência para o contexto de assinatura (injetado externamente pelo contexto)
let subscriptionContext: { hasFeatureAccess: (featureId: string) => Promise<boolean> } | null = null;

// Dados simulados para usar quando o acesso é negado
const mockRoulettes = [
  { 
    id: 'mock-1', 
    nome: 'Roleta Demo', 
    status: 'ativo', 
    online: true, 
    numero: [],
    message: 'Acesso limitado - Faça upgrade para ver dados reais'
  },
  { 
    id: 'mock-2', 
    nome: 'Roleta Exemplo', 
    status: 'ativo', 
    online: true, 
    numero: [],
    message: 'Acesso limitado - Faça upgrade para ver dados reais'
  }
];

// Função utilitária para verificar se o usuário pode acessar dados detalhados
const canAccessDetailedData = async (): Promise<boolean> => {
  // Se o contexto não foi injetado, negar acesso por segurança
  if (!subscriptionContext) {
    console.warn('[rouletteApi] Contexto de assinatura não definido, negando acesso por padrão');
    return false;
  }
  
  try {
    // Verificar se o usuário tem acesso à feature específica
    console.log('[rouletteApi] Iniciando verificação de acesso a dados detalhados de roletas...');
    const hasAccess = await subscriptionContext.hasFeatureAccess('view_roulette_cards');
    
    if (hasAccess) {
      console.log('[rouletteApi] ✅ Acesso a dados detalhados de roletas PERMITIDO');
    } else {
      console.log('[rouletteApi] ❌ Acesso a dados detalhados de roletas NEGADO');
    }
    
    return hasAccess;
  } catch (error) {
    console.error('[rouletteApi] Erro ao verificar permissões:', error);
    return false;
  }
};

/**
 * Busca todas as roletas e inclui os números mais recentes para cada uma.
 * Esta API combina os dados que normalmente seriam buscados separadamente.
 */
export const fetchRoulettesWithNumbers = async (limit = 20): Promise<any[]> => {
  try {
    // Verificar se o usuário tem permissão antes de carregar dados detalhados
    console.log('[rouletteApi] Verificando permissões para acessar dados de roletas...');
    const hasAccess = await canAccessDetailedData();
    
    if (!hasAccess) {
      console.log('[rouletteApi] Requisição de números bloqueada: usuário sem plano adequado');
      console.log('[rouletteApi] Retornando dados simulados para demonstração');
      return mockRoulettes;
    }
    
    console.log('[rouletteApi] Permissão concedida, buscando dados completos das roletas');
    
    // Verificar cache
    const cacheKey = `roulettes_with_numbers_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log('[rouletteApi] Usando dados em cache para roletas com números');
      return cache[cacheKey].data;
    }

    // Tentar diferentes endpoints para encontrar os dados (abordagem resiliente)
    const possibleEndpoints = [
      '/api/roulettes',
      '/api/roulette',
      '/api/ROULETTES',
      '/api/history/roulettes'
    ];
    
    let roulettesData = null;
    
    // Tentar cada endpoint até encontrar dados válidos
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`[rouletteApi] Tentando buscar roletas em ${endpoint}`);
        const response = await axios.get(endpoint);
        
        // Verificar se a resposta contém dados válidos
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log(`[rouletteApi] ✅ Encontrados ${response.data.length} roletas em ${endpoint}`);
          roulettesData = response.data;
          break;
        }
      } catch (endpointError) {
        console.log(`[rouletteApi] ❌ Endpoint ${endpoint} falhou: ${endpointError.message}`);
        // Continuar tentando outros endpoints
      }
    }
    
    // Se não encontrou dados em nenhum endpoint, retornar dados simulados
    if (!roulettesData) {
      console.log('[rouletteApi] ⚠️ Nenhum endpoint de roletas funcionou, usando dados simulados');
      return mockRoulettes;
    }

    // Para cada roleta, usar os dados como estão
    const roulettesWithNumbers = roulettesData.map((roleta: any) => {
      try {
        const id = roleta.id;
        
        // Verificar se a roleta já tem números incluídos
        if (roleta.numero && Array.isArray(roleta.numero)) {
          console.log(`[rouletteApi] Roleta: ${roleta.nome}, ID: ${id}, Números já incluídos: ${roleta.numero.length}`);
          
          // Limitar a quantidade de números retornados
          const limitedNumbers = roleta.numero.slice(0, limit);
          
          // Retornar a roleta com os números já incluídos
          return {
            ...roleta,
            id: id,
            numero: limitedNumbers
          };
        }
        
        console.log(`[rouletteApi] Roleta: ${roleta.nome}, ID: ${id}, Sem números incluídos`);
        
        // A roleta não tem números, retornar com array vazio
        return {
          ...roleta,
          id: id,
          numero: []
        };
      } catch (error) {
        console.error(`[rouletteApi] Erro ao processar números para roleta ${roleta.nome || 'desconhecida'}:`, error);
        
        // Mesmo em caso de erro, retornar a roleta, mas com array de números vazio
        return {
          ...roleta,
          numero: []
        };
      }
    });

    // Armazenar em cache para requisições futuras
    cache[cacheKey] = {
      data: roulettesWithNumbers,
      timestamp: Date.now()
    };
    
    console.log(`[rouletteApi] ✅ Obtidas ${roulettesWithNumbers.length} roletas com seus números`);
    return roulettesWithNumbers;
  } catch (error) {
    console.error('[rouletteApi] Erro global ao buscar roletas:', error);
    return mockRoulettes; // Retornar dados simulados em caso de erro
  }
};

/**
 * Busca uma roleta específica por ID e inclui seus números mais recentes
 */
export const fetchRouletteWithNumbers = async (roletaId: string, limit = 20): Promise<any | null> => {
  try {
    // Verificar se o usuário tem permissão antes de carregar dados detalhados
    console.log(`[rouletteApi] Verificando permissões para acessar dados detalhados da roleta ${roletaId}...`);
    const hasAccess = await canAccessDetailedData();
    
    if (!hasAccess) {
      console.log(`[rouletteApi] ❌ Requisição de números para roleta ${roletaId} bloqueada: usuário sem plano adequado`);
      console.log(`[rouletteApi] Retornando dados simulados para demonstração`);
      // Retornar dados simulados para o ID específico
      return mockRoulettes.find(r => r.id === 'mock-1') || mockRoulettes[0];
    }
    
    console.log(`[rouletteApi] ✅ Permissão concedida, buscando dados completos da roleta ${roletaId}`);
    
    // Verificar cache
    const cacheKey = `roulette_with_numbers_${roletaId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[rouletteApi] Usando dados em cache para roleta ${roletaId} com números`);
      return cache[cacheKey].data;
    }

    // Tentar buscar a roleta específica primeiro (endpoint prioritário)
    try {
      console.log(`[rouletteApi] Tentando buscar roleta diretamente em /api/roulette/${roletaId}`);
      const response = await axios.get(`/api/roulette/${roletaId}`);
      
      if (response.data && !Array.isArray(response.data)) {
        // Resposta direta da roleta
        const roleta = response.data;
        
        // Verificar se a roleta já tem números incluídos
        let numbers = [];
        if (roleta.numero && Array.isArray(roleta.numero)) {
          // Limitar a quantidade de números retornados
          numbers = roleta.numero.slice(0, limit);
        }
        
        // Montar o objeto final
        const roletaWithNumbers = {
          ...roleta,
          numero: numbers
        };
        
        // Armazenar em cache para requisições futuras
        cache[cacheKey] = {
          data: roletaWithNumbers,
          timestamp: Date.now()
        };
        
        console.log(`[rouletteApi] ✅ Roleta específica encontrada: ${roleta.nome}, ID: ${roleta.id}, Números obtidos: ${numbers.length}`);
        return roletaWithNumbers;
      }
    } catch (directError) {
      console.log(`[rouletteApi] ❌ Não foi possível buscar a roleta diretamente: ${directError.message}`);
      // Continuar com a estratégia de buscar todas as roletas
    }

    // Tentar diferentes endpoints para buscar todas as roletas
    console.log(`[rouletteApi] Tentando encontrar roleta ${roletaId} através da lista completa de roletas`);
    
    // Buscar todas as roletas e encontrar a desejada
    const allRoulettes = await fetchRoulettesWithNumbers(limit);
    const roleta = allRoulettes.find((r: any) => r.id === roletaId);
    
    if (roleta) {
      console.log(`[rouletteApi] ✅ Roleta ${roletaId} encontrada na lista completa`);
      
      // Armazenar em cache para requisições futuras
      cache[cacheKey] = {
        data: roleta,
        timestamp: Date.now()
      };
      
      return roleta;
    }
    
    console.log(`[rouletteApi] ❌ Roleta com ID ${roletaId} não encontrada`);
    return mockRoulettes.find(r => r.id === 'mock-1') || mockRoulettes[0];
  } catch (error) {
    console.error(`[rouletteApi] Erro global ao buscar roleta ${roletaId}:`, error);
    return mockRoulettes.find(r => r.id === 'mock-1') || mockRoulettes[0]; // Retornar dados simulados em caso de erro
  }
};

// Função para injetar o contexto de assinatura (chamada pelo SubscriptionContext)
export const setSubscriptionContext = (context: { hasFeatureAccess: (featureId: string) => Promise<boolean> }) => {
  subscriptionContext = context;
  console.log('[rouletteApi] Contexto de assinatura configurado com sucesso');
}; 