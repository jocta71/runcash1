import axios from 'axios';
import { ENDPOINTS, getFullUrl } from './endpoints';
import { getNumericId } from '../data/rouletteTransformer';
// Importar dados mockados
import mockRouletteData from '../../assets/data/mockRoulettes.json';
import { mockRouletteData as utilsMockRouletteData } from '../../utils/mock/roulette-data';

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
   * @deprecated Use UnifiedRouletteClient para dados em tempo real
   */
  async fetchAllRoulettes() {
    console.warn('⚠️ ATENÇÃO: fetchAllRoulettes() está depreciado. ' +
      'Use UnifiedRouletteClient.getInstance().getAllRoulettes() para dados em tempo real.');

    try {
      // Tentar usar o UnifiedRouletteClient se disponível
      try {
        const { default: UnifiedRouletteClient } = await import('../../services/UnifiedRouletteClient');
        const client = UnifiedRouletteClient.getInstance();
        
        // Forçar conexão ao stream se possível
        client.connectStream();
        
        // Aguardar alguns milissegundos para dar tempo do cliente receber dados
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Obter roletas do cliente unificado
        const roulettes = client.getAllRoulettes();
        
        if (roulettes && Array.isArray(roulettes) && roulettes.length > 0) {
          console.log(`Retornando ${roulettes.length} roletas do UnifiedRouletteClient`);
          return roulettes;
        } else {
          console.warn('Nenhuma roleta disponível no UnifiedRouletteClient, tentando API direta...');
        }
      } catch (clientError) {
        console.error('Erro ao usar UnifiedRouletteClient:', clientError);
      }
      
      // Tentar a API direta como fallback se o cliente falhou
      const url = getFullUrl(ENDPOINTS.HISTORICAL.ALL_ROULETTES);
      console.log(`Buscando roletas de ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.error('Erro de autenticação ao buscar roletas:', response.status);
          throw new Error('Erro de autenticação. Verifique suas credenciais.');
        }
        
        if (response.status === 404) {
          console.warn('Endpoint não encontrado, usando dados simulados como fallback');
          return utilsMockRouletteData;
        }
        
        throw new Error(`Erro ao buscar roletas: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !Array.isArray(data)) {
        console.warn('Formato de resposta inválido, usando dados simulados');
        return utilsMockRouletteData;
      }
      
      if (data.length === 0) {
        console.warn('Nenhuma roleta retornada pela API, usando dados simulados');
        return utilsMockRouletteData;
      }
      
      return data;
    } catch (error) {
      console.error('Erro ao buscar roletas:', error);
      
      // Em caso de erro, retornar dados simulados
      console.log('Retornando dados simulados devido a erro na API');
      return utilsMockRouletteData;
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