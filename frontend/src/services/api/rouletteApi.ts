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
   * @deprecated Este método está depreciado. Use UnifiedRouletteClient para dados em tempo real.
   * @returns Resposta da API com roletas ou erro
   */
  async fetchAllRoulettes(): Promise<ApiResponse<any[]>> {
    try {
      console.warn('[API] DEPRECIADO: fetchAllRoulettes - Considere usar UnifiedRouletteClient.getInstance().getAllRoulettes() para dados em tempo real');
      console.log('[API] Buscando dados de roletas através do UnifiedRouletteClient');
      
      // Importar dinamicamente o UnifiedRouletteClient para evitar dependência circular
      const UnifiedRouletteClientModule = await import('../../services/UnifiedRouletteClient');
      const UnifiedRouletteClient = UnifiedRouletteClientModule.default;
      
      try {
        // Usar o cliente unificado para obter dados de roletas
        const unifiedClient = UnifiedRouletteClient.getInstance();
        const roulettes = await unifiedClient.getAllRoulettes();
        
        console.log(`[API] ✅ Obtidas ${roulettes.length} roletas do UnifiedRouletteClient`);
        
        // Processar cada roleta para garantir consistência
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
        console.warn('[API] Erro ao obter dados do UnifiedRouletteClient, tentando endpoint tradicional:', primaryError);
        
        // Fallback para o endpoint tradicional se o UnifiedRouletteClient falhar
        const fallbackResponse = await axios.get(ENDPOINTS.ROULETTES);
        
        if (!fallbackResponse.data) {
          console.error('[API] Resposta inválida do endpoint fallback:', fallbackResponse.data);
          return {
            error: true,
            code: 'INVALID_RESPONSE',
            message: 'Resposta inválida da API no endpoint alternativo',
            statusCode: fallbackResponse.status
          };
        }
        
        // Extrair dados da resposta fallback
        const fallbackRoulettes = Array.isArray(fallbackResponse.data) 
          ? fallbackResponse.data 
          : (fallbackResponse.data.data ? fallbackResponse.data.data : []);
        
        console.log(`[API] ✅ Obtidas ${fallbackRoulettes.length} roletas do endpoint fallback`);
        
        // Processar cada roleta para extrair campos relevantes
        const processedRoulettes = fallbackRoulettes.map((roulette: any) => {
          // Garantir que temos o campo roleta_id em cada objeto
          if (!roulette.roleta_id && roulette._id) {
            const numericId = getNumericId(roulette._id);
            console.log(`[API] Adicionando roleta_id=${numericId} para roleta UUID=${roulette._id}`);
            roulette.roleta_id = numericId;
          }
          return roulette;
        });
        
        return {
          error: false,
          data: processedRoulettes
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
      
      const response = await axios.get(`${ENDPOINTS.ROULETTE_HISTORY}/${encodeURIComponent(rouletteName)}`);
      
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