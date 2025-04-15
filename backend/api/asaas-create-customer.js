// Proxy para redirecionar para a implementação na pasta payment
const asaasCreateCustomer = require('./payment/asaas-create-customer');

module.exports = asaasCreateCustomer; 