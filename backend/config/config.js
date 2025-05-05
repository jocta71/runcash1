/**
 * Configurações globais da aplicação
 */

module.exports = {
  // Configurações gerais
  port: process.env.PORT || 5000,
  
  // Configurações do JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'runcash-jwt-secret-2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  },
  
  // Configurações do MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash',
    dbName: process.env.MONGODB_DB_NAME || 'runcash'
  },
  
  // Configurações de autenticação
  auth: {
    tokenExpiration: process.env.TOKEN_EXPIRATION || '30d'
  },
  
  // Configurações do Asaas
  asaas: {
    apiKey: process.env.ASAAS_API_KEY || '',
    apiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3'
  }
}; 