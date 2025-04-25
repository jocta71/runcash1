import axios from 'axios';
import { API_URL } from '../../config';
import { getAuthToken } from '../../utils/auth';

export class RouletteRepository {
  static async fetchAllRoulettes() {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Tentativa de buscar roletas sem autenticação');
        return [];
      }

      const response = await axios.get(`${API_URL}/roulettes`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.data || [];
    } catch (error) {
      this.handleApiError(error, 'Erro ao buscar roletas');
      // Se for erro 403, retorna array vazio
      if (error.response && error.response.status === 403) {
        console.log('Acesso à API de roletas bloqueado - Assinatura necessária');
        return [];
      }
      throw error;
    }
  }

  static async fetchAllRoulettesWithNumbers() {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Tentativa de buscar roletas com números sem autenticação');
        return [];
      }

      console.log('Usando endpoint alternativo para buscar roletas com números');
      const response = await axios.get(`${API_URL}/roulettes`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const processedData = (response.data.data || []).map(roulette => {
        if (!roulette.numero || !Array.isArray(roulette.numero)) {
          roulette.numero = [];
        }
        if (!roulette.lastNumbers || !Array.isArray(roulette.lastNumbers)) {
          roulette.lastNumbers = [...(roulette.numero || [])];
        }
        return roulette;
      });

      return processedData;
    } catch (error) {
      this.handleApiError(error, 'Erro ao buscar roletas com números');
      // Se for erro 403, retorna array vazio
      if (error.response && error.response.status === 403) {
        console.log('Acesso à API de roletas com números bloqueado - Assinatura necessária');
        return [];
      }
      throw error;
    }
  }

  static async fetchBasicRouletteInfo() {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Tentativa de buscar informações básicas sem autenticação');
        return [];
      }

      console.log('Usando endpoint alternativo para buscar informações básicas');
      const response = await axios.get(`${API_URL}/roulettes`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const basicData = (response.data.data || []).map(roulette => ({
        id: roulette.id || roulette._id,
        nome: roulette.nome || roulette.name || 'Roleta sem nome',
        name: roulette.name || roulette.nome || 'Roleta sem nome',
        estado_estrategia: roulette.estado_estrategia || 'NEUTRAL',
        vitorias: roulette.vitorias || 0,
        derrotas: roulette.derrotas || 0
      }));

      return basicData;
    } catch (error) {
      this.handleApiError(error, 'Erro ao buscar informações básicas das roletas');
      return [];
    }
  }

  static async fetchRouletteDetails(id) {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Tentativa de buscar detalhes da roleta sem autenticação');
        return null;
      }

      const response = await axios.get(`${API_URL}/roulettes/detailed/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.data || null;
    } catch (error) {
      this.handleApiError(error, `Erro ao buscar detalhes da roleta ${id}`);
      // Se for erro 403, retorna null
      if (error.response && error.response.status === 403) {
        console.log(`Acesso à API de detalhes da roleta ${id} bloqueado - Assinatura necessária`);
        return null;
      }
      throw error;
    }
  }

  static async fetchRouletteHistorical(id, limit = 1000) {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Tentativa de buscar histórico da roleta sem autenticação');
        return [];
      }

      const response = await axios.get(`${API_URL}/roulettes/historical/${id}?limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.data || [];
    } catch (error) {
      this.handleApiError(error, `Erro ao buscar histórico da roleta ${id}`);
      // Se for erro 403, retorna array vazio
      if (error.response && error.response.status === 403) {
        console.log(`Acesso à API de histórico da roleta ${id} bloqueado - Assinatura necessária`);
        return [];
      }
      throw error;
    }
  }

  static async fetchRouletteStats(id) {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Tentativa de buscar estatísticas da roleta sem autenticação');
        return null;
      }

      const response = await axios.get(`${API_URL}/roulettes/stats/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.data || null;
    } catch (error) {
      this.handleApiError(error, `Erro ao buscar estatísticas da roleta ${id}`);
      // Se for erro 403, retorna null
      if (error.response && error.response.status === 403) {
        console.log(`Acesso à API de estatísticas da roleta ${id} bloqueado - Assinatura necessária`);
        return null;
      }
      throw error;
    }
  }

  static async fetchRouletteProviders() {
    try {
      const response = await axios.get(`${API_URL}/roulettes/public/providers`);
      return response.data.data || [];
    } catch (error) {
      this.handleApiError(error, 'Erro ao buscar provedores de roletas');
      return [];
    }
  }

  static handleApiError(error, defaultMessage) {
    if (error.response) {
      // O servidor respondeu com um status diferente de 2xx
      console.error(`${defaultMessage}: ${error.response.status} - ${error.response.data.message || 'Erro desconhecido'}`);
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error(`${defaultMessage}: Sem resposta do servidor`);
    } else {
      // Ocorreu um erro ao configurar a requisição
      console.error(`${defaultMessage}: ${error.message}`);
    }
  }
} 