// Removendo a importação do mapeamento canônico que pode estar filtrando roletas
// import { mapToCanonicalRouletteId } from './rouletteService';
import axios from 'axios';

// Cache para otimizar as requisições
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minuto em milissegundos

/**
 * Busca todas as roletas e inclui os números mais recentes para cada uma.
 * Esta API combina os dados que normalmente seriam buscados separadamente.
 */
export const fetchRoulettesWithNumbers = async (limit = 20): Promise<any[]> => {
  try {
    // Verificar cache
    const cacheKey = `roulettes_with_numbers_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log('[API] Usando dados em cache para roletas com números');
      return cache[cacheKey].data;
    }

    console.log('[API] Requisições para /api/roulettes desativadas, usando dados mockados');
    
    // Dados mockados de roletas
    const mockRoulettes = [
      {
        id: '1',
        nome: 'Roleta Europeia VIP',
        status: 'online',
        provider: 'Evolution',
        numero: Array.from({length: limit}, (_, i) => ({
          numero: Math.floor(Math.random() * 37),
          cor: i % 2 === 0 ? 'vermelho' : 'preto',
          timestamp: new Date(Date.now() - i * 60000).toISOString()
        }))
      },
      {
        id: '2',
        nome: 'Roleta Brasileira',
        status: 'online',
        provider: 'Pragmatic Play',
        numero: Array.from({length: limit}, (_, i) => ({
          numero: Math.floor(Math.random() * 37),
          cor: i % 3 === 0 ? 'vermelho' : (i % 3 === 1 ? 'preto' : 'verde'),
          timestamp: new Date(Date.now() - i * 60000).toISOString()
        }))
      },
      {
        id: '3',
        nome: 'Lightning Roulette',
        status: 'online',
        provider: 'Evolution',
        numero: Array.from({length: limit}, (_, i) => ({
          numero: Math.floor(Math.random() * 37),
          cor: i % 2 === 0 ? 'vermelho' : 'preto',
          timestamp: new Date(Date.now() - i * 60000).toISOString()
        }))
      }
    ];

    // Armazenar em cache para requisições futuras
    cache[cacheKey] = {
      data: mockRoulettes,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Mockadas ${mockRoulettes.length} roletas com seus números`);
    return mockRoulettes;
  } catch (error) {
    console.error('[API] Erro ao processar dados mockados:', error);
    return [];
  }
};

/**
 * Busca uma roleta específica por ID e inclui seus números mais recentes
 */
export const fetchRouletteWithNumbers = async (roletaId: string, limit = 20): Promise<any | null> => {
  try {
    // Verificar cache
    const cacheKey = `roulette_with_numbers_${roletaId}_${limit}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[API] Usando dados em cache para roleta ${roletaId} com números`);
      return cache[cacheKey].data;
    }

    console.log(`[API] Requisições para /api/roulettes desativadas, usando dados mockados para roleta ${roletaId}`);
    
    // Gerar nome baseado no ID
    const nomes = {
      '1': 'Roleta Europeia VIP',
      '2': 'Roleta Brasileira',
      '3': 'Lightning Roulette'
    };
    
    // Mockado de roleta específica
    const mockRoleta = {
      id: roletaId,
      nome: nomes[roletaId as keyof typeof nomes] || `Roleta ${roletaId}`,
      status: 'online',
      provider: 'Evolution',
      numero: Array.from({length: limit}, (_, i) => ({
        numero: Math.floor(Math.random() * 37),
        cor: i % 2 === 0 ? 'vermelho' : 'preto',
        timestamp: new Date(Date.now() - i * 60000).toISOString()
      }))
    };
    
    // Armazenar em cache para requisições futuras
    cache[cacheKey] = {
      data: mockRoleta,
      timestamp: Date.now()
    };
    
    console.log(`[API] ✅ Mockada roleta: ${mockRoleta.nome}, ID: ${roletaId}, Números gerados: ${limit}`);
    return mockRoleta;
  } catch (error) {
    console.error(`[API] Erro ao processar dados mockados para roleta ${roletaId}:`, error);
    return null;
  }
}; 