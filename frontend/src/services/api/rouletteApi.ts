import axios from 'axios';
import { ENDPOINTS } from './endpoints';
import { getNumericId } from '../data/rouletteTransformer';
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
        // Obter UnifiedRouletteClient
        const { default: UnifiedRouletteClient } = await import('../UnifiedRouletteClient');
        const client = UnifiedRouletteClient.getInstance();
        
        // Verificar se o cliente tem o método getStatus
        let isConnected = false;
        try {
          if (typeof client.getStatus === 'function') {
            const status = client.getStatus();
            isConnected = status.isStreamConnected;
          } else {
            console.warn('[API] Método getStatus não disponível no UnifiedRouletteClient');
          }
        } catch (statusError) {
          console.warn('[API] Erro ao verificar status do cliente:', statusError);
        }
        
        // Garantir que o cliente está conectado ao stream, se o método connectStream existir
        if (!isConnected && typeof client.connectStream === 'function') {
          try {
            client.connectStream();
          } catch (connectError) {
            console.warn('[API] Erro ao conectar ao stream:', connectError);
          }
        }
        
        // Verificar se o método getAllRoulettes existe
        if (typeof client.getAllRoulettes !== 'function') {
          throw new Error('Método getAllRoulettes não disponível no UnifiedRouletteClient');
        }
        
        // Obter roletas do cache do cliente
        const roulettes = client.getAllRoulettes();
        
        // Se não tivermos roletas, lançar erro para usar o fallback
        if (!roulettes || roulettes.length === 0) {
          console.warn('[API] Nenhuma roleta disponível no UnifiedRouletteClient');
          return {
            error: true,
            code: 'NO_DATA_AVAILABLE',
            message: 'Sem dados disponíveis. Tente novamente mais tarde.',
            statusCode: 503
          };
        }
        
        // Processar roletas
        const processedRoulettes = roulettes.map((roulette: any) => {
          // Garantir que temos o campo roleta_id em cada objeto
          if (!roulette.roleta_id && roulette._id) {
            const numericId = getNumericId(roulette._id);
            roulette.roleta_id = numericId;
          }
          return roulette;
        });
        
        return {
          error: false,
          data: processedRoulettes
        };
      } catch (primaryError) {
        console.error('[API] Erro ao obter dados do UnifiedRouletteClient:', primaryError);
        
        // Tentar usar dados mockados como último recurso
        try {
          console.warn('[API] Usando dados mockados como fallback');
          return {
            error: false,
            data: mockRouletteData
          };
        } catch (mockError) {
          console.error('[API] Erro ao usar dados mockados:', mockError);
        }
        
        // Retornar erro se tudo falhar
        return {
          error: true,
          code: 'NO_DATA_AVAILABLE',
          message: 'Sem dados disponíveis. Tente novamente mais tarde.',
          statusCode: 503
        };
      }
    } catch (error: any) {
      console.error('[API] Erro ao buscar roletas:', error);
      
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
        // Extrair código e mensagem específicos do erro
        const errorCode = error.response.data?.code || 'SUBSCRIPTION_REQUIRED';
        const errorMessage = error.response.data?.message || 'Você precisa de uma assinatura ativa para acessar este recurso';
        
        return {
          error: true,
          code: errorCode,
          message: errorMessage,
          statusCode: 403
        };
      }
      
      // Tentar usar dados mockados como último recurso
      try {
        console.warn('[API] Usando dados mockados como último recurso');
        return {
          error: false,
          data: mockRouletteData
        };
      } catch (mockError) {
        console.error('[API] Erro ao usar dados mockados:', mockError);
      }
      
      // Outros erros
      return {
        error: true,
        code: 'FETCH_ERROR',
        message: error.response?.data?.message || error.message || 'Erro ao buscar roletas',
        statusCode: error.response?.status || 500
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
      // Converter para ID numérico para normalização
      const numericId = getNumericId(id);
      
      // Buscar todas as roletas e filtrar localmente
      const allRoulettes = await this.fetchAllRoulettes();
      
      // Verificar se houve erro na busca de todas as roletas
      if (allRoulettes.error) {
        return allRoulettes;
      }
      
      // Buscar com prioridade pelo campo roleta_id
      const roulette = allRoulettes.data.find((r: any) => 
        r.roleta_id === numericId || 
        r.id === numericId || 
        r._id === id
      );
      
      if (roulette) {
        console.log(`[API] ✅ Roleta encontrada: ${roulette.nome || roulette.name}`);
        return {
          error: false,
          data: roulette
        };
      }
      
      console.warn(`[API] ❌ Roleta com ID ${numericId} não encontrada`);
      return {
        error: true,
        code: 'ROULETTE_NOT_FOUND',
        message: `Roleta com ID ${numericId} não encontrada`,
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
      
      // Converter para ID numérico para normalização
      const numericId = getNumericId(id);
      
      // Buscar dados da roleta que já incluem a estratégia
      const rouletteResponse = await this.fetchRouletteById(numericId);
      
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
      
      console.log(`[API] ✅ Estratégia obtida para roleta ${numericId}`);
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