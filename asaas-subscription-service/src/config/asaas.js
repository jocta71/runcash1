const axios = require('axios');

// Configuração base para requisições à API do Asaas
const asaasApi = axios.create({
  baseURL: process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3',
  headers: {
    'Content-Type': 'application/json',
    'access_token': process.env.ASAAS_API_KEY
  }
});

// Função para verificar a assinatura do webhook
const verifyWebhookSignature = (req) => {
  // Em produção, implemente a verificação da assinatura do webhook
  // usando o ASAAS_WEBHOOK_SECRET para garantir que a requisição é legítima
  
  // Exemplo simples para ambientes de desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Em produção, verifique headers ou payload assinado
  // const signature = req.headers['asaas-signature'];
  // return validateSignature(signature, req.body, process.env.ASAAS_WEBHOOK_SECRET);
  
  return true; // Temporário, substitua pela implementação real
};

module.exports = {
  asaasApi,
  verifyWebhookSignature
}; 