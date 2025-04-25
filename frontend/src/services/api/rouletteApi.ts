import axios from 'axios';
import { ENDPOINTS } from './endpoints';
import { getNumericId } from '../data/rouletteTransformer';
import { getAuthToken } from '../auth/authService';
import { RouletteType } from '../../types/roulette';

// Interface para representar a nova resposta da API
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  subscriptionRequired?: boolean;
  limitedData?: boolean;
}

/**
 * Cliente de API para comunicação com os endpoints de roleta
 */
export const RouletteApi = {
  /**
   * Obtém os cabeçalhos de autorização
   * @returns Objeto com cabeçalhos para requisições autenticadas
   */
  getAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  /**
   * Busca todas as roletas disponíveis
   * @param withLimit Número máximo de registros (somente com assinatura)
   * @returns Array de objetos de roleta
   */
  async fetchAllRoulettes(withLimit?: number) {
    console.log('Fetching all roulettes');
    try {
      // Construir URL baseada nos parâmetros
      let url = '/api/roulettes';
      if (withLimit) {
        url += `?limit=${withLimit}`;
      }

      // Fazer a requisição com headers de autenticação
      const response = await axios.get<ApiResponse<RouletteType[]>>(url, {
        headers: this.getAuthHeaders()
      });

      // Verificar se a resposta tem o formato esperado
      if (response.data && 'success' in response.data) {
        // Resposta no novo formato com info de assinatura
        const apiResponse = response.data;
        
        if (apiResponse.subscriptionRequired) {
          console.warn('Acesso limitado: assinatura necessária para acesso completo às roletas');
          // Retornar dados limitados se disponíveis
          if (apiResponse.limitedData && apiResponse.data) {
            return apiResponse.data;
          }
          return [];
        }
        
        return apiResponse.data || [];
      } else if (Array.isArray(response.data)) {
        // Formato antigo - array direto
        return response.data;
      }
      
      console.error('Resposta inválida ao buscar roletas:', response.data);
      return [];
    } catch (error) {
      console.error('Error fetching roulettes:', error);
      return [];
    }
  },

  /**
   * Busca uma roleta específica pelo ID
   * @param id ID da roleta a ser buscada
   * @returns Objeto da roleta encontrada ou null
   */
  async fetchRouletteById(id: string) {
    console.log(`Fetching roulette with id: ${id}`);
    try {
      const response = await axios.get<ApiResponse<RouletteType>>(`/api/roulettes/${id}`, {
        headers: this.getAuthHeaders()
      });

      // Verificar se a resposta tem o formato esperado
      if (response.data && 'success' in response.data) {
        const apiResponse = response.data;
        
        if (apiResponse.subscriptionRequired) {
          console.warn('Acesso limitado: assinatura necessária para acesso a esta roleta');
          return null;
        }
        
        return apiResponse.data || null;
      } else {
        // Formato antigo - objeto direto
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching roulette with id ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Busca a estratégia atual para uma roleta
   * @param id ID da roleta
   * @returns Objeto de estratégia ou null
   */
  async fetchRouletteStrategy(id: string) {
    console.log(`Fetching current strategy for roulette: ${id}`);
    try {
      const response = await axios.get<ApiResponse<any>>(`/api/strategies/${id}/current`, {
        headers: this.getAuthHeaders()
      });

      // Verificar se a resposta tem o formato esperado
      if (response.data && 'success' in response.data) {
        const apiResponse = response.data;
        
        if (apiResponse.subscriptionRequired) {
          console.warn('Acesso limitado: assinatura necessária para acesso às estratégias');
          return null;
        }
        
        return apiResponse.data || null;
      } else {
        // Formato antigo - objeto direto
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching current strategy for roulette ${id}:`, error);
      return null;
    }
  },
  
  /**
   * Busca o histórico de números de uma roleta específica
   * @param rouletteName Nome da roleta
   * @returns Array com até 1000 números históricos
   */
  async fetchRouletteHistory(rouletteName: string) {
    console.log(`Fetching historical numbers for roulette: ${rouletteName}`);
    try {
      const response = await axios.get<ApiResponse<any[]>>(`/api/roulettes/${encodeURIComponent(rouletteName)}/numbers?limit=1000`, {
        headers: this.getAuthHeaders()
      });

      // Verificar se a resposta tem o formato esperado
      if (response.data && 'success' in response.data) {
        const apiResponse = response.data;
        
        if (apiResponse.subscriptionRequired) {
          console.warn('Acesso limitado: assinatura necessária para acesso ao histórico completo');
          // Retornar dados limitados se disponíveis
          if (apiResponse.limitedData && apiResponse.data) {
            return apiResponse.data;
          }
          return [];
        }
        
        return apiResponse.data || [];
      } else if (Array.isArray(response.data)) {
        // Formato antigo - array direto
        return response.data;
      }
      
      console.error('Resposta inválida ao buscar números da roleta:', response.data);
      return [];
    } catch (error) {
      console.error(`Error fetching numbers for roulette ${rouletteName}:`, error);
      return [];
    }
  }
}; 