import axios from 'axios';
import { ENDPOINTS } from './endpoints';
import { getNumericId } from '../data/rouletteTransformer';
// Importar dados mockados e RequestThrottler
import mockRouletteData from '../../assets/data/mockRoulettes.json';
import { RequestThrottler } from '../utils/requestThrottler';

// Chave única para throttling da API de roletas
const ROULETTES_API_KEY = 'api_roulettes_all';
const ROULETTE_HISTORY_KEY = 'api_roulette_history'; // Nova chave para o histórico

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
   * Busca todas as roletas disponíveis respeitando o intervalo de polling
   * @returns Resposta da API com roletas ou erro
   */
  async fetchAllRoulettes(): Promise<ApiResponse<any[]>> {
    try {
      // Usar o RequestThrottler para gerenciar o intervalo entre requisições
      const result = await RequestThrottler.scheduleRequest(
        ROULETTES_API_KEY,
        async () => {
          console.log('[API] Buscando todas as roletas disponíveis');
          const response = await axios.get(ENDPOINTS.ROULETTES);
          
          if (!response.data) {
            throw new Error('Resposta inválida da API de roletas');
          }
          
          // Verificar se a resposta é um array diretamente ou está em um campo 'data'
          const roulettes = Array.isArray(response.data) 
            ? response.data 
            : (response.data.data ? response.data.data : []);
          
          console.log(`[API] ✅ Obtidas ${roulettes.length} roletas`);
          
          // Processar cada roleta para extrair campos relevantes
          return roulettes.map((roulette: any) => {
            // Garantir que temos o campo roleta_id em cada objeto
            if (!roulette.roleta_id && roulette._id) {
              const numericId = getNumericId(roulette._id);
              console.log(`[API] Adicionando roleta_id=${numericId} para roleta UUID=${roulette._id}`);
              roulette.roleta_id = numericId;
            }
            return roulette;
          });
        },
        false, // não forçar execução
        false, // usar cache quando disponível
        60000  // cache válido por 60 segundos
      );
      
      if (result) {
        return {
          error: false,
          data: result
        };
      }
      
      // Se o throttler retornar null, verificar se temos erro de cache
      throw new Error('Erro ao buscar dados de roletas');
      
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
      
      // Usar o RequestThrottler para gerenciar o intervalo entre requisições
      const result = await RequestThrottler.scheduleRequest(
        `${ROULETTE_HISTORY_KEY}_${rouletteName}`,
        async () => {
          const response = await axios.get(`${ENDPOINTS.ROULETTE_HISTORY}/${encodeURIComponent(rouletteName)}`);
          
          if (!response.data || !Array.isArray(response.data)) {
            throw new Error('Resposta inválida da API de histórico');
          }
          
          console.log(`[API] ✅ Obtidos ${response.data.length} números históricos`);
          return response.data;
        },
        false, // não forçar execução
        false, // usar cache quando disponível
        30000  // cache válido por 30 segundos (metade do tempo das roletas)
      );
      
      if (result) {
        return {
          error: false,
          data: result
        };
      }
      
      // Se o throttler retornar null, temos um erro
      throw new Error('Erro ao buscar histórico da roleta');
      
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