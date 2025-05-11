// Arquivo modificado para funcionar sem fazer requisições à API

// Removidas importações de axios e definição de API_URL que não são mais necessárias
// import axios from 'axios';
// const API_URL = `${import.meta.env.VITE_API_URL || ''}/api/strategies`;

// Log de inicialização
console.log('Serviço de estratégias inicializado em modo offline');

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
      // Método modificado para retornar uma estratégia de sistema simulada
      // sem fazer requisição à API
      console.log('Chamada à API de estratégias desativada, retornando estratégia de sistema simulada');
      
      // Criar uma estratégia de sistema padrão
      const systemStrategy: Strategy = {
        _id: 'system-strategy-default',
        name: 'Estratégia Padrão do Sistema',
        description: 'Estratégia padrão configurada para detecção de repetições e alternância de cores',
        isPublic: true,
        isSystem: true,
        userId: 'system',
        rules: {
          detectRepetitions: true,
          checkParity: true,
          colorSequence: true,
          detectDozens: false,
          detectColumns: false
        },
        terminalsConfig: {
          useDefaultTerminals: true,
          customTerminals: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return [systemStrategy];
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
      // Método modificado para retornar uma estratégia simulada
      console.log(`Chamada à API de estratégias desativada para ID ${id}`);
      
      // Obter a estratégia simulada do método getStrategies
      const strategies = await this.getStrategies();
      
      // Retornar a estratégia se o ID corresponder, caso contrário retornar a primeira
      const strategy = strategies.find(s => s._id === id) || strategies[0];
      return strategy;
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
      // Método modificado para simular a criação de estratégia
      console.log(`Chamada à API de estratégias desativada. Simulando criação de estratégia: ${strategy.name}`);
      
      // Criar uma nova estratégia simulada
      const newStrategy: Strategy = {
        _id: `custom-${Date.now()}`,
        userId: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...strategy
      };
      
      return newStrategy;
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
      // Método modificado para simular a atualização de estratégia
      console.log(`Chamada à API de estratégias desativada. Simulando atualização da estratégia ${id}`);
      
      // Obter a estratégia existente
      const existingStrategy = await this.getStrategy(id);
      if (!existingStrategy) {
        return null;
      }
      
      // Atualizar a estratégia
      const updatedStrategy: Strategy = {
        ...existingStrategy,
        ...strategy,
        updatedAt: new Date().toISOString()
      };
      
      return updatedStrategy;
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
      // Método modificado para simular a exclusão de estratégia
      console.log(`Chamada à API de estratégias desativada. Simulando exclusão da estratégia ${id}`);
      
      // Simulando sucesso na exclusão
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
      // Método modificado para simular a associação de estratégia sem fazer requisição à API
      console.log(`Chamada à API de estratégias desativada. Simulando associação da estratégia ${strategyId} à roleta ${roletaId}`);
      
      // Obter a estratégia do sistema simulada
      const strategies = await this.getStrategies();
      const strategy = strategies.find(s => s._id === strategyId) || strategies[0];
      
      // Criar um objeto de associação simulado
      const rouletteStrategy: RouletteStrategy = {
        _id: `rs-${roletaId}-${strategyId}`,
        userId: 'system',
        roletaId,
        roletaNome,
        strategyId: strategy,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return rouletteStrategy;
    } catch (error) {
      console.error(`Erro ao associar estratégia ${strategyId} à roleta ${roletaId}:`, error);
      return null;
    }
  }

  /**
   * Obter a estratégia associada a uma roleta
   */
  async getRouletteStrategy(roletaId: string): Promise<RouletteStrategy | null> {
    // Método modificado para retornar null diretamente sem fazer chamada à API
    console.log(`Chamada à API de estratégias desativada para roleta ${roletaId}`);
    return null;
  }

  // Novo método para obter a estratégia do sistema (simulada offline)
  static async getSystemStrategy(): Promise<Strategy | null> {
    console.log('[StrategyService] Obtendo estratégia do sistema simulada (modo offline)');
    
    // Criar uma estratégia de sistema simulada
    const systemStrategy: Strategy = {
      _id: 'system-strategy',
      name: 'Estratégia do Sistema',
      description: 'Estratégia padrão do sistema (modo offline)',
      isPublic: true,
      isSystem: true,
      userId: 'system',
      rules: [
        {
          type: 'repetition',
          value: 2,
          active: true
        },
        {
          type: 'parity_alternation',
          value: 3,
          active: true
        },
        {
          type: 'color_sequence',
          value: 3,
          active: true
        }
      ],
      terminalsConfig: {
        useDefaultTerminals: true,
        customTerminals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return systemStrategy;
  }
}

export default new StrategyService();
export type { Strategy, RouletteStrategy }; 