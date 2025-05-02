const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Esquema para o modelo de Usuário
 * Se o modelo já existir, esta definição será ignorada
 */
const UserSchema = new Schema({
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  planType: {
    type: String,
    enum: ['FREE', 'BASIC', 'PREMIUM', 'PRO'],
    default: 'FREE'
  },
  planStatus: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'CANCELED'],
    default: 'INACTIVE',
    index: true
  },
  avatar: String,
  googleId: String,
  billingInfo: {
    asaasId: {
      type: String,
      index: true
    },
    documentNumber: String,
    address: {
      street: String,
      number: String,
      complement: String,
      neighborhood: String,
      city: String,
      state: String,
      postalCode: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Garantir que o esquema seja registrado apenas uma vez
let User;
try {
  // Tentar obter modelo existente
  User = mongoose.model('User');
  console.log('[MODEL] Modelo User já existente obtido');
} catch (e) {
  // Criar novo modelo se não existir
  User = mongoose.model('User', UserSchema);
  console.log('[MODEL] Modelo User registrado');
}

module.exports = User; 