/**
 * Configurações para a API do Asaas
 */
const config = {
  apiKey: process.env.ASAAS_API_KEY,
  apiUrl: process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3',
  webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
  
  // Configurações de assinatura
  subscriptionConfig: {
    billingType: 'CREDIT_CARD', // BOLETO, CREDIT_CARD, PIX
    nextDueDate: null, // Será preenchido dinamicamente
    value: 39.90, // Valor da assinatura
    cycle: 'MONTHLY', // WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
    description: 'Assinatura RunCash - Acesso Premium',
    maxPayments: 0, // 0 = ilimitado
    discount: {
      value: 0, // Valor do desconto
      dueDateLimitDays: 0 // Limite de dias para o desconto ser aplicado
    },
    fine: {
      value: 0 // Valor da multa
    },
    interest: {
      value: 0 // Valor de juros
    }
  },
  
  // Configurações de notificação
  notificationConfig: {
    enabled: true,
    invoiceUrl: true,
    emailEnabledForProvider: true,
    smsEnabledForProvider: false
  }
};

module.exports = config; 