/**
 * Configurações gerais do sistema
 */

require('dotenv').config();

module.exports = {
  // Configurações do JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'runcashh1-api-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // Configurações do banco de dados
  database: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash',
    name: process.env.MONGODB_DB_NAME || 'runcash'
  },
  
  // Configurações do Asaas
  asaas: {
    apiKey: process.env.ASAAS_API_KEY || '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmE4NzkxZDA3LTdiNzAtNDVkZC04ZWZjLTk0ZWJkODI1ZWIyNzo6JGFhY2hfZDVjODRmZjAtOGU4Ny00MWE5LWI4MGMtMWQ5MjBhOWI3YWYz',
    apiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3',
    environment: process.env.ASAAS_ENVIRONMENT || 'sandbox'
  },
  
  // Configurações do frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'https://runcashh11.vercel.app'
  }
}; 