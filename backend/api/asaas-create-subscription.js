// Proxy para redirecionar para a implementação na pasta payment
const asaasCreateSubscription = require('./payment/asaas-create-subscription');

module.exports = asaasCreateSubscription; 