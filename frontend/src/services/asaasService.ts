import axios from 'axios';
import { API_URL } from '@/config/constants';

/**
 * Serviço para interação com as APIs do Asaas
 */
export const AsaasService = {
  /**
   * Verifica se o usuário tem um cliente Asaas associado
   * Se não tiver, cria um novo cliente
   */
  ensureCustomerExists: async (user: { id: string; username: string; email: string; asaasCustomerId?: string }) => {
    try {
      // Se o usuário já tem um customerID, verificar se existe no Asaas
      if (user.asaasCustomerId) {
        const checkResponse = await axios.get(`${API_URL}/api/asaas-find-customer?customerId=${user.asaasCustomerId}`);
        if (checkResponse.data.success) {
          console.log('[AsaasService] Cliente já existe no Asaas:', user.asaasCustomerId);
          return { 
            success: true, 
            customerId: user.asaasCustomerId 
          };
        } else {
          // Customer ID inválido, precisamos criar um novo
          console.log('[AsaasService] ID de cliente inválido, criando novo cliente...');
        }
      }

      // Criar novo cliente no Asaas
      const createResponse = await axios.post(`${API_URL}/api/asaas-create-customer`, {
        name: user.username,
        email: user.email,
        externalReference: user.id, // Referência ao ID do usuário no seu sistema
        cpfCnpj: '', // Adicione se tiver esse dado
        mobilePhone: '' // Adicione se tiver esse dado
      });

      if (createResponse.data.success && createResponse.data.id) {
        console.log('[AsaasService] Novo cliente criado no Asaas:', createResponse.data.id);
        return {
          success: true,
          customerId: createResponse.data.id,
          isNew: true
        };
      } else {
        throw new Error('Falha ao criar cliente no Asaas');
      }
    } catch (error) {
      console.error('[AsaasService] Erro ao verificar/criar cliente:', error);
      return {
        success: false,
        error: 'Não foi possível verificar ou criar o cliente no Asaas'
      };
    }
  },

  /**
   * Obtém as assinaturas de um cliente
   */
  getCustomerSubscriptions: async (customerId: string) => {
    try {
      const cacheKey = `_t=${Date.now()}`; // Evitar cache
      const response = await axios.get(
        `${API_URL}/api/asaas-find-subscription?customerId=${customerId}&${cacheKey}`
      );
      
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Erro ao buscar assinaturas:', error);
      return { success: false, error: 'Não foi possível obter as assinaturas' };
    }
  }
}; 