// Endpoint de criação de cliente usando MongoDB para Vercel
const axios = require('axios');
const { MongoClient } = require('mongodb');

// Redirecionador para a criação de clientes no Asaas
const redirector = require('./api-redirector');

module.exports = redirector; 