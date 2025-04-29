const axios = require('axios');
const asaasConfig = require('../config/asaas.config');

/**
 * Serviço para interagir com a API do Asaas
 */
class AsaasService {
  constructor() {
    this.api = axios.create({
      baseURL: asaasConfig.apiUrl,
      headers: {
        'access_token': process.env.ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Interceptor para lidar com erros
    this.api.interceptors.response.use(
      response => response,
      error => {
        console.error('[Asaas API Error]', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Criar um novo cliente no Asaas
   * @param {Object} customerData - Dados do cliente
   * @returns {Promise<Object>} Cliente criado
   */
  async createCustomer(customerData) {
    try {
      const response = await this.api.post('/customers', {
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        mobilePhone: customerData.phone,
        cpfCnpj: customerData.cpfCnpj,
        postalCode: customerData.postalCode,
        address: customerData.address,
        addressNumber: customerData.addressNumber,
        complement: customerData.complement,
        province: customerData.province,
        externalReference: customerData.externalId || null,
        notificationDisabled: false
      });
      
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Error creating customer:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Atualizar um cliente existente no Asaas
   * @param {String} customerId - ID do cliente no Asaas
   * @param {Object} customerData - Dados atualizados do cliente
   * @returns {Promise<Object>} Cliente atualizado
   */
  async updateCustomer(customerId, customerData) {
    try {
      const response = await this.api.post(`/customers/${customerId}`, {
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        mobilePhone: customerData.phone,
        cpfCnpj: customerData.cpfCnpj,
        postalCode: customerData.postalCode,
        address: customerData.address,
        addressNumber: customerData.addressNumber,
        complement: customerData.complement,
        province: customerData.province,
        externalReference: customerData.externalId || null
      });
      
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Error updating customer:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Criar uma nova assinatura no Asaas
   * @param {String} customerId - ID do cliente no Asaas
   * @param {Object} subscriptionData - Dados da assinatura
   * @returns {Promise<Object>} Assinatura criada
   */
  async createSubscription(customerId, subscriptionData = {}) {
    try {
      // Usar configuração padrão e sobrescrever com dados fornecidos
      const config = { ...asaasConfig.subscriptionConfig, ...subscriptionData };
      
      // Se não foi fornecida uma próxima data de cobrança, usar hoje + 1 dia
      if (!config.nextDueDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        config.nextDueDate = tomorrow.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      }
      
      const response = await this.api.post('/subscriptions', {
        customer: customerId,
        billingType: config.billingType,
        nextDueDate: config.nextDueDate,
        value: config.value,
        cycle: config.cycle,
        description: config.description,
        maxPayments: config.maxPayments,
        
        // Configurações adicionais
        discount: config.discount,
        fine: config.fine,
        interest: config.interest,
        
        // Notificações
        externalReference: subscriptionData.externalReference || null
      });
      
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Error creating subscription:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Obter dados de uma assinatura
   * @param {String} subscriptionId - ID da assinatura no Asaas
   * @returns {Promise<Object>} Dados da assinatura
   */
  async getSubscription(subscriptionId) {
    try {
      const response = await this.api.get(`/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Error getting subscription:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Obter pagamentos de uma assinatura
   * @param {String} subscriptionId - ID da assinatura no Asaas
   * @returns {Promise<Array>} Lista de pagamentos
   */
  async getSubscriptionPayments(subscriptionId) {
    try {
      const response = await this.api.get(`/subscriptions/${subscriptionId}/payments`);
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Error getting subscription payments:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Cancelar uma assinatura
   * @param {String} subscriptionId - ID da assinatura no Asaas
   * @returns {Promise<Object>} Resultado da operação
   */
  async cancelSubscription(subscriptionId) {
    try {
      const response = await this.api.delete(`/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Error canceling subscription:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Gerar um link de pagamento
   * @param {String} customerId - ID do cliente no Asaas
   * @param {Object} paymentData - Dados do pagamento
   * @returns {Promise<Object>} Link de pagamento
   */
  async createPaymentLink(customerId, paymentData = {}) {
    try {
      // Data de vencimento padrão (7 dias a partir de hoje)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      
      const response = await this.api.post('/paymentLinks', {
        customer: customerId,
        billingType: paymentData.billingType || 'UNDEFINED',
        value: paymentData.value || asaasConfig.subscriptionConfig.value,
        dueDate: paymentData.dueDate || dueDate.toISOString().split('T')[0],
        description: paymentData.description || 'Pagamento RunCash',
        externalReference: paymentData.externalReference || null,
        
        // Configurações do link
        maxInstallmentCount: 1,
        showDescription: true,
        showNoteField: false,
        pendingPayment: true,
        expirationDate: paymentData.expirationDate || null,
        
        // Configuração para pagamento recorrente
        autoRegister: true,
        fine: paymentData.fine || 0,
        interest: paymentData.interest || 0
      });
      
      return response.data;
    } catch (error) {
      console.error('[AsaasService] Error creating payment link:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Verificar assinatura pelo token do webhook
   * @param {String} token - Token recebido no webhook
   * @returns {Boolean} Se o token é válido
   */
  verifyWebhookToken(token) {
    return token === asaasConfig.webhookToken;
  }
}

module.exports = new AsaasService(); 