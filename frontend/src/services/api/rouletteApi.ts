import axios from 'axios';
import { ENDPOINTS } from './endpoints';
import { fetchWithCorsSupport } from '@/utils/api-helpers';
// Remover a importação de getNumericId que não existe
// import { getNumericId } from '@/utils/rouletteUtils';
import { UnifiedRouletteClient } from '../UnifiedRouletteClient';

// Importar dados mockados
import mockRouletteData from '../../assets/data/mockRoulettes.json';

// Tipo para resposta de erro
interface ApiErrorResponse {
  error: boolean;
  code: string;
  message: string;
  statusCode: number;
}

// Tipo para resposta bem-sucedida
interface ApiSuccessResponse<T> {
  error: false;
  data: T;
}

// União de tipos para resposta da API
type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Cliente de API para comunicação com os endpoints de roleta
 */
export const RouletteApi = {
  /**
   * Busca todas as roletas disponíveis
   * @returns Resposta da API com as roletas ou erro
   */
  async fetchAllRoulettes(): Promise<ApiResponse<any[]>> {
    try {
      console.warn('[API] DEPRECIADO: fetchAllRoulettes - Considere usar UnifiedRouletteClient para dados em tempo real');
      console.log('[API] Buscando dados de roletas através do UnifiedRouletteClient');
      
      try {
        // Usar UnifiedRouletteClient importado estaticamente
        const client = UnifiedRouletteClient.getInstance();
        
        // Garantir que o cliente está conectado ao stream
        if (!client.getStatus().isStreamConnected) {
          client.connectStream();
        }
        
        // Obter roletas do cache do cliente
        const roulettes = client.getAllRoulettes();
        
        // Processar roletas (não precisa mais de getNumericId)
        const processedRoulettes = roulettes.map((roulette: any) => {
          // Usar o ID existente ou _id
          if (!roulette.roleta_id) {
            roulette.roleta_id = roulette.id || roulette._id; 
          }
          return roulette;
        });
        
        return {
          error: false,
          data: processedRoulettes
        };
      } catch (primaryError: any) { // Tipar o erro
        console.error('[API] Erro ao obter dados do UnifiedRouletteClient:', primaryError);
        
        // Retornar erro em vez de tentar endpoint alternativo
        return {
          error: true,
          code: 'NO_DATA_AVAILABLE',
          message: primaryError.message || 'Sem dados disponíveis. Tente novamente mais tarde.', // Usar mensagem do erro se disponível
          statusCode: 503
        };
      }
    } catch (error: any) { // Tipar o erro
      console.error('[API] Erro inesperado em fetchAllRoulettes:', error);
      return {
        error: true,
        code: 'UNEXPECTED_ERROR',
        message: error.message || 'Erro inesperado ao buscar roletas',
        statusCode: 500
      };
    }
  },

  /**
   * Busca os números mais recentes de uma roleta específica
   * @param rouletteId ID da roleta
   * @param limit Número máximo de resultados (padrão: 20)
   * @returns Resposta da API com os números ou erro
   */
  async fetchRecentNumbers(rouletteId: string, limit: number = 20): Promise<ApiResponse<any[]>> {
    try {
      // Usar rouletteId diretamente, sem getNumericId
      const client = UnifiedRouletteClient.getInstance();
      const roulette = client.getRouletteById(rouletteId); // Usar o ID original
      
      if (roulette && roulette.numeros) {
        // Limitar os números se necessário
        const numbers = roulette.numeros.slice(0, limit);
        return {
          error: false,
          data: numbers
        };
      } else {
        console.warn(`[API] Roleta ${rouletteId} não encontrada ou sem números no UnifiedRouletteClient`);
        // Retornar erro
        return {
          error: true,
          code: 'ROULETTE_NOT_FOUND_IN_CLIENT',
          message: `Roleta ${rouletteId} não encontrada ou sem dados no cliente SSE`,
          statusCode: 404
        };
      }
    } catch (error: any) {
      console.error(`[API] Erro ao buscar números para roleta ${rouletteId}:`, error);
      return {
        error: true,
        code: 'FETCH_ERROR',
        message: error.message || `Erro ao buscar números para roleta ${rouletteId}`,
        statusCode: 500
      };
    }
  },

  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta a ser buscada
   * @returns Resposta da API com a roleta ou erro
   */
  async fetchRouletteById(id: string): Promise<ApiResponse<any>> {
    try {
      console.log(`[API] Buscando roleta com ID: ${id}`);
      // Usar id diretamente, sem getNumericId
      const client = UnifiedRouletteClient.getInstance();
      const roulette = client.getRouletteById(id); // Usar o ID original
            
      if (roulette) {
        console.log(`[API] ✅ Roleta encontrada no UnifiedClient: ${roulette.nome || roulette.name}`);
        return {
          error: false,
          data: roulette
        };
      }
      
      console.warn(`[API] ❌ Roleta com ID ${id} não encontrada no UnifiedClient`);
      return {
        error: true,
        code: 'ROULETTE_NOT_FOUND_IN_CLIENT',
        message: `Roleta com ID ${id} não encontrada no cliente SSE`,
        statusCode: 404
      };
    } catch (error: any) {
      console.error(`[API] Erro ao buscar roleta ${id}:`, error);
      return {
        error: true,
        code: 'FETCH_ERROR',
        message: error.message || 'Erro ao buscar roleta',
        statusCode: 500
      };
    }
  },
  
  /**
   * Busca a estratégia atual para uma roleta
   * @param id ID da roleta
   * @returns Objeto de estratégia ou null
   */
  async fetchRouletteStrategy(id: string): Promise<ApiResponse<any>> {
    try {
      console.log(`[API] Buscando estratégia para roleta ID: ${id}`);
      
      // Usar id diretamente, sem getNumericId
      const rouletteResponse = await this.fetchRouletteById(id); // Usar o ID original
      
      if (rouletteResponse.error) {
        return rouletteResponse;
      }
      
      const roulette = rouletteResponse.data;
      
      // Extrair dados da estratégia do objeto da roleta
      const strategy = {
        estado: roulette.estado_estrategia || 'NEUTRAL',
        numero_gatilho: roulette.numero_gatilho || null,
        terminais_gatilho: roulette.terminais_gatilho || [],
        vitorias: roulette.vitorias || 0,
        derrotas: roulette.derrotas || 0,
        sugestao_display: roulette.sugestao_display || ''
      };
      
      console.log(`[API] ✅ Estratégia obtida para roleta ${id}`);
      return {
        error: false,
        data: strategy
      };
    } catch (error: any) {
      console.error(`[API] Erro ao buscar estratégia para roleta ${id}:`, error);
      return {
        error: true,
        code: 'FETCH_ERROR',
        message: error.message || 'Erro ao buscar estratégia da roleta',
        statusCode: 500
      };
    }
  },
  
  /**
   * Busca o histórico de números de uma roleta específica
   * @param rouletteName Nome da roleta
   * @returns Resposta da API com o histórico ou erro
   */
  async fetchRouletteHistory(rouletteName: string): Promise<ApiResponse<number[]>> {
    try {
      console.log(`[API] Buscando histórico para roleta: ${rouletteName}`);
      
      // Usar a URL diretamente em vez do objeto ENDPOINTS
      const response = await axios.get(`/api/roulettes/history/${encodeURIComponent(rouletteName)}`);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('[API] Resposta inválida do histórico:', response.data);
        return {
          error: true,
          code: 'INVALID_RESPONSE',
          message: 'Resposta inválida da API de histórico',
          statusCode: response.status
        };
      }
      
      console.log(`[API] ✅ Obtidos ${response.data.length} números históricos`);
      return {
        error: false,
        data: response.data
      };
    } catch (error: any) {
      console.error(`[API] Erro ao buscar histórico da roleta ${rouletteName}:`, error);
      
      // Verificar se é erro de autenticação
      if (error.response?.status === 401) {
        return {
          error: true,
          code: 'AUTH_REQUIRED',
          message: 'Autenticação necessária para acessar este recurso',
          statusCode: 401
        };
      }
      
      // Verificar se é erro de assinatura
      if (error.response?.status === 403) {
        const errorCode = error.response.data?.code || 'SUBSCRIPTION_REQUIRED';
        const errorMessage = error.response.data?.message || 'Você precisa de uma assinatura ativa para acessar este recurso';
        
        return {
          error: true,
          code: errorCode,
          message: errorMessage,
          statusCode: 403
        };
      }
      
      return {
        error: true,
        code: 'FETCH_ERROR',
        message: error.response?.data?.message || error.message || 'Erro ao buscar histórico da roleta',
        statusCode: error.response?.status || 500
      };
    }
  }
}; 