const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Nome de usuário é obrigatório'],
    unique: true,
    trim: true,
    minlength: [3, 'Nome de usuário deve ter no mínimo 3 caracteres'],
    maxlength: [30, 'Nome de usuário não pode ter mais de 30 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor, forneça um email válido']
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Senha é obrigatória apenas se não tiver googleId
    },
    minlength: [6, 'Senha deve ter no mínimo 6 caracteres']
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  profilePicture: {
    type: String
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
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

// Atualiza o updatedAt antes de salvar
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Apenas criptografa a senha se ela foi modificada ou é nova
  if (!this.isModified('password') || !this.password) return next();
  
  // Criptografa a senha
  bcrypt.hash(this.password, 10, (err, hash) => {
    if (err) return next(err);
    this.password = hash;
    next();
  });
});

// Método para comparar senha
UserSchema.methods.comparePassword = function(candidatePassword) {
  if (!this.password) return Promise.resolve(false);
  
  return new Promise((resolve, reject) => {
    bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
      if (err) return reject(err);
      resolve(isMatch);
    });
  });
};

module.exports = mongoose.model('User', UserSchema); 