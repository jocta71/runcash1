import axios from 'axios';
import { ENDPOINTS } from './endpoints';
import { getNumericId } from '../data/rouletteTransformer';

/**
 * Cliente de API para comunicação com os endpoints de roleta
 */
export const RouletteApi = {
  /**
   * Busca todas as roletas disponíveis (dados básicos, sem números)
   * @returns Array de objetos de roleta com informações básicas
   */
  async fetchAllRoulettes() {
    try {
      console.log('[API] Buscando dados básicos das roletas disponíveis');
      
      // Usar o novo endpoint otimizado para dados básicos
      const response = await axios.get(`${ENDPOINTS.ROULETTES}/basic`);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[API] Resposta inválida da API de roletas:', response.data);
        return [];
      }
      
      console.log(`[API] ✅ Obtidas ${response.data.length} roletas (dados básicos)`);
      
      // Processar cada roleta para garantir campos necessários
      const processedRoulettes = response.data.map((roulette: any) => {
        // Garantir que temos o campo roleta_id em cada objeto
        if (!roulette.roleta_id && roulette.id) {
          const numericId = getNumericId(roulette.id);
          roulette.roleta_id = numericId;
        }
        return roulette;
      });
      
      return processedRoulettes;
    } catch (error) {
      console.error('[API] Erro ao buscar roletas:', error);
      return [];
    }
  },
  
  /**
   * Busca todas as roletas com suporte a paginação e modo de dados
   * @param page Número da página (opcional, padrão 1)
   * @param limit Limite de itens por página (opcional, padrão 100)
   * @param mode Modo de dados ('basic' ou 'full', padrão 'full')
   * @returns Dados das roletas com informações de paginação
   */
  async fetchRoulettesWithPagination(page = 1, limit = 100, mode = 'full') {
    try {
      console.log(`[API] Buscando roletas paginadas (página ${page}, limit ${limit}, modo ${mode})`);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        mode,
        includeMeta: 'true'
      });
      
      const url = `${ENDPOINTS.ROULETTES}?${params.toString()}`;
      console.log(`[API] URL de requisição: ${url}`);
      
      const response = await axios.get(url);
      
      if (!response.data) {
        console.error('[API] Resposta inválida da API de roletas paginadas');
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
      
      console.log(`[API] ✅ Obtidos dados paginados (${response.data.data?.length || 0} itens)`);
      return response.data;
    } catch (error) {
      console.error('[API] Erro ao buscar roletas paginadas:', error);
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  },
  
  /**
   * Busca apenas os números de uma roleta específica (otimizado)
   * @param id ID da roleta
   * @param page Página a ser buscada
   * @param limit Limite de itens por página
   * @returns Objeto com números e informações de paginação
   */
  async fetchRouletteNumbers(id: string, page = 1, limit = 50) {
    try {
      if (!id) {
        console.warn('[API] ID da roleta não fornecido para buscar números');
        return { numbers: [], total: 0, page, totalPages: 0 };
      }
      
      console.log(`[API] Buscando números da roleta ${id} (página ${page}, limit ${limit})`);
      
      // Converter para ID numérico para normalização
      const numericId = getNumericId(id);
      
      // Usar novo endpoint otimizado de números por roleta
      const url = `${ENDPOINTS.ROULETTES}/${numericId}/numbers?page=${page}&limit=${limit}`;
      const response = await axios.get(url);
      
      if (!response.data || !response.data.numbers) {
        console.warn(`[API] Resposta inválida para números da roleta ${numericId}`);
        return { numbers: [], total: 0, page, totalPages: 0 };
      }
      
      console.log(`[API] ✅ Obtidos ${response.data.numbers.length} números para roleta ${numericId}`);
      return response.data;
    } catch (error) {
      console.error(`[API] Erro ao buscar números para roleta ${id}:`, error);
      return { numbers: [], total: 0, page, totalPages: 0 };
    }
  },
  
  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta
   * @returns Objeto com dados da roleta ou null
   */
  async fetchRouletteById(id: string) {
    try {
      if (!id) {
        console.warn('[API] ID não fornecido para buscar roleta');
        return null;
      }
      
      console.log(`[API] Buscando roleta com ID: ${id}`);
      
      // Primeiro, tentar obter dados básicos (mais rápido)
      const roulettes = await this.fetchAllRoulettes();
      const basicRoulette = roulettes.find(r => 
        r.id === id || r._id === id || getNumericId(r.id || '') === id
      );
      
      if (basicRoulette) {
        console.log(`[API] ✅ Roleta encontrada nos dados básicos: ${basicRoulette.nome || id}`);
        
        // Obter os números da roleta (separadamente)
        const numbersData = await this.fetchRouletteNumbers(id);
        
        // Combinar dados básicos com números
        return {
          ...basicRoulette,
          numero: numbersData.numbers,
          total_numeros: numbersData.total
        };
      }
      
      console.warn(`[API] Roleta ${id} não encontrada nos dados básicos, tentando busca direta`);
      
      // Fallback: tentar obter diretamente (compatibilidade)
      const numericId = getNumericId(id);
      const response = await axios.get(`${ENDPOINTS.ROULETTES}/${numericId}`);
      
      if (response.data) {
        console.log(`[API] ✅ Roleta obtida via endpoint direto: ${response.data.nome || id}`);
        return response.data;
      }
      
      console.warn(`[API] Roleta não encontrada para ID: ${id}`);
      return null;
    } catch (error) {
      console.error(`[API] Erro ao buscar roleta por ID ${id}:`, error);
      return null;
    }
  },

  /**
   * Busca a estratégia atual para uma roleta
   * @param id ID da roleta
   * @returns Objeto de estratégia ou null
   */
  async fetchRouletteStrategy(id: string) {
    try {
      console.log(`[API] Buscando estratégia para roleta ID: ${id}`);
      
      // Converter para ID numérico para normalização
      const numericId = getNumericId(id);
      
      // Buscar dados da roleta que já incluem a estratégia
      const roulette = await this.fetchRouletteById(numericId);
      
      if (!roulette) {
        console.warn(`[API] Roleta ${numericId} não encontrada para estratégia`);
        return null;
      }
      
      // Extrair dados da estratégia do objeto da roleta
      const strategy = {
        estado: roulette.estado_estrategia || 'NEUTRAL',
        numero_gatilho: roulette.numero_gatilho || null,
        terminais_gatilho: roulette.terminais_gatilho || [],
        vitorias: roulette.vitorias || 0,
        derrotas: roulette.derrotas || 0,
        sugestao_display: roulette.sugestao_display || ''
      };
      
      console.log(`[API] ✅ Estratégia obtida para roleta ${numericId}`);
      return strategy;
    } catch (error) {
      console.error(`[API] Erro ao buscar estratégia para roleta ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Busca o histórico de números de uma roleta específica
   * @param rouletteName Nome da roleta
   * @returns Array com até 1000 números históricos
   */
  async fetchRouletteHistory(rouletteName: string) {
    try {
      console.log(`[API] Buscando histórico para roleta: ${rouletteName}`);
      
      const response = await axios.get(`${ENDPOINTS.ROULETTE_HISTORY}/${encodeURIComponent(rouletteName)}`);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[API] Resposta inválida do histórico:', response.data);
        return [];
      }
      
      console.log(`[API] ✅ Obtidos ${response.data.length} números históricos`);
      return response.data;
    } catch (error) {
      console.error(`[API] Erro ao buscar histórico da roleta ${rouletteName}:`, error);
      return [];
    }
  }
}; 