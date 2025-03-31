import axios from 'axios';

// Definição da URL da API usando apenas variáveis de ambiente
const API_URL = `${import.meta.env.VITE_API_URL || ''}/api/strategies`;

// Log para depuração da URL da API
console.log('API URL configurada:', API_URL);

interface Strategy {
  _id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  isSystem: boolean;
  userId: string;
  rules: Record<string, any>;
  terminalsConfig: {
    useDefaultTerminals: boolean;
    customTerminals: number[];
  };
  createdAt: string;
  updatedAt: string;
}

interface RouletteStrategy {
  _id: string;
  userId: string;
  roletaId: string;
  roletaNome: string;
  strategyId: Strategy;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serviço para gerenciar estratégias
 */
class StrategyService {
  /**
   * Obter todas as estratégias disponíveis para o usuário
   */
  async getStrategies(): Promise<Strategy[]> {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Erro ao obter estratégias:', error);
      return [];
    }
  }

  /**
   * Obter uma estratégia específica
   */
  async getStrategy(id: string): Promise<Strategy | null> {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.data;
    } catch (error) {
      console.error(`Erro ao obter estratégia ${id}:`, error);
      return null;
    }
  }

  /**
   * Criar uma nova estratégia
   */
  async createStrategy(strategy: Omit<Strategy, '_id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Strategy | null> {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(API_URL, strategy, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Erro ao criar estratégia:', error);
      return null;
    }
  }

  /**
   * Atualizar uma estratégia existente
   */
  async updateStrategy(id: string, strategy: Partial<Strategy>): Promise<Strategy | null> {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_URL}/${id}`, strategy, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data.data;
    } catch (error) {
      console.error(`Erro ao atualizar estratégia ${id}:`, error);
      return null;
    }
  }

  /**
   * Excluir uma estratégia
   */
  async deleteStrategy(id: string): Promise<boolean> {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return true;
    } catch (error) {
      console.error(`Erro ao excluir estratégia ${id}:`, error);
      return false;
    }
  }

  /**
   * Associar uma estratégia a uma roleta
   */
  async assignStrategy(roletaId: string, roletaNome: string, strategyId: string): Promise<RouletteStrategy | null> {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/assign`,
        { roletaId, roletaNome, strategyId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error(`Erro ao associar estratégia ${strategyId} à roleta ${roletaId}:`, error);
      return null;
    }
  }

  /**
   * Obter a estratégia associada a uma roleta
   */
  async getRouletteStrategy(roletaId: string): Promise<RouletteStrategy | null> {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/roulette/${roletaId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Nenhuma estratégia associada, não é um erro
        return null;
      }
      console.error(`Erro ao obter estratégia da roleta ${roletaId}:`, error);
      return null;
    }
  }
}

export default new StrategyService();
export type { Strategy, RouletteStrategy }; 