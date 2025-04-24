// Removendo a importação do mapeamento canônico que pode estar filtrando roletas
// import { mapToCanonicalRouletteId } from './rouletteService';
import { PlanType } from '@/types/plans';
import axios from 'axios';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

// Referência para o contexto de assinatura (injetado externamente pelo contexto)
let subscriptionContext: { hasFeatureAccess: (featureId: string) => Promise<boolean> } | null = null;

// Função utilitária para verificar se o usuário pode acessar dados detalhados
const canAccessDetailedData = async (): Promise<boolean> => {
  // Se o contexto não foi injetado, negar acesso por segurança
  if (!subscriptionContext) {
    console.warn('[rouletteApi] Contexto de assinatura não definido, negando acesso por padrão');
    return false;
  }
  
  try {
    // Verificar se o usuário tem acesso à feature específica
    const hasAccess = await subscriptionContext.hasFeatureAccess('view_roulette_cards');
    console.log(`[rouletteApi] Acesso a dados detalhados de roletas: ${hasAccess ? 'Permitido' : 'Negado'}`);
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
    const hasAccess = await canAccessDetailedData();
    if (!hasAccess) {
      console.log('[rouletteApi] Requisição de números bloqueada: usuário sem acesso autorizado');
      // Retornar apenas os dados básicos sem números
      return []; // Ou retornar dados mockados básicos
    }
    
    // Verificar cache
    const cacheKey = `roulettes_with_numbers_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log('[rouletteApi] Usando dados em cache para roletas com números');
      return cache[cacheKey].data;
    }

    // Passo 1: Buscar todas as roletas disponíveis
    console.log('[rouletteApi] Buscando roletas e seus números');
    try {
      const roulettesResponse = await axios.get('/api/roulettes');
      
      if (!roulettesResponse.data || !Array.isArray(roulettesResponse.data)) {
        console.error('[rouletteApi] Resposta inválida da API de roletas');
        return [];
      }

      // Passo 2: Para cada roleta, usar os dados como estão - sem mapeamento para ID canônico
      const roulettesWithNumbers = roulettesResponse.data.map((roleta: any) => {
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
              id: id,  // Manter o ID original
              numero: limitedNumbers
            };
          }
          
          console.log(`[rouletteApi] Roleta: ${roleta.nome}, ID: ${id}, Sem números incluídos`);
          
          // A roleta não tem números, retornar com array vazio
          return {
            ...roleta,
            id: id,  // Manter o ID original
            numero: []
          };
        } catch (error) {
          console.error(`[rouletteApi] Erro ao processar números para roleta ${roleta.nome}:`, error);
          
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
      
      console.log(`[rouletteApi] Obtidas ${roulettesWithNumbers.length} roletas com seus números`);
      return roulettesWithNumbers;
    } catch (error) {
      console.error('[rouletteApi] Erro ao buscar roletas:', error);
      return [];
    }
  } catch (error) {
    console.error('[rouletteApi] Erro ao verificar permissões ou buscar roletas:', error);
    return [];
  }
};

/**
 * Busca uma roleta específica por ID e inclui seus números mais recentes
 */
export const fetchRouletteWithNumbers = async (roletaId: string, limit = 20): Promise<any | null> => {
  try {
    // Verificar se o usuário tem permissão antes de carregar dados detalhados
    const hasAccess = await canAccessDetailedData();
    if (!hasAccess) {
      console.log(`[rouletteApi] Requisição de números para roleta ${roletaId} bloqueada: usuário sem acesso autorizado`);
      return null; // Ou retornar dados mockados básicos
    }
    
    // Verificar cache
    const cacheKey = `roulette_with_numbers_${roletaId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[rouletteApi] Usando dados em cache para roleta ${roletaId} com números`);
      return cache[cacheKey].data;
    }

    try {
      // Buscar todas as roletas para encontrar a desejada
      const roulettesResponse = await axios.get('/api/roulettes');
      
      if (!roulettesResponse.data || !Array.isArray(roulettesResponse.data)) {
        console.error('[rouletteApi] Resposta inválida da API de roletas');
        return null;
      }
      
      // Encontrar a roleta pelo ID original
      const roleta = roulettesResponse.data.find((r: any) => r.id === roletaId);
      
      if (!roleta) {
        console.error(`[rouletteApi] Roleta com ID ${roletaId} não encontrada`);
        return null;
      }
      
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
      
      console.log(`[rouletteApi] Roleta: ${roleta.nome}, ID: ${roleta.id}, Números obtidos: ${numbers.length}`);
      return roletaWithNumbers;
    } catch (error) {
      console.error(`[rouletteApi] Erro ao buscar roleta ${roletaId}:`, error);
      return null;
    }
  } catch (error) {
    console.error(`[rouletteApi] Erro ao verificar permissões ou buscar roleta ${roletaId}:`, error);
    return null;
  }
};

// Função para injetar o contexto de assinatura (chamada pelo SubscriptionContext)
export const setSubscriptionContext = (context: { hasFeatureAccess: (featureId: string) => Promise<boolean> }) => {
  subscriptionContext = context;
  console.log('[rouletteApi] Contexto de assinatura configurado com sucesso');
}; 