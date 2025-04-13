const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serializar usuário para a sessão
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserializar usuário a partir da sessão
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Verificar se as credenciais do Google estão disponíveis
const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

// Configurar estratégia Google OAuth apenas se as credenciais estiverem disponíveis
if (googleClientID && googleClientSecret) {
  console.log('Configurando autenticação Google OAuth...');
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientID,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackURL,
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Verificar se o usuário já existe no banco de dados
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // Atualizar informações do usuário existente
            user.lastLogin = Date.now();
            await user.save();
            return done(null, user);
          }

          // Verificar se já existe um usuário com o mesmo email
          const existingUser = await User.findOne({ email: profile.emails[0].value });
          
          if (existingUser) {
            // Conectar conta Google com usuário existente
            existingUser.googleId = profile.id;
            existingUser.profilePicture = profile.photos[0].value;
            existingUser.lastLogin = Date.now();
            await existingUser.save();
            return done(null, existingUser);
          }

          // Criar novo usuário com dados do Google
          const username = profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
          
          const newUser = await User.create({
            username: username,
            email: profile.emails[0].value,
            googleId: profile.id,
            profilePicture: profile.photos[0].value,
            lastLogin: Date.now()
          });

          return done(null, newUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
} else {
  console.warn('Credenciais Google OAuth não encontradas. Autenticação Google desabilitada.');
}

module.exports = passport; 