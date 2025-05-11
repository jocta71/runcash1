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
          // Extrair informações do perfil Google
          const email = profile.emails[0].value;
          const googleId = profile.id;
          const profilePicture = profile.photos[0].value;
          
          // Extrair nome e sobrenome do perfil
          let firstName = '';
          let lastName = '';
          
          if (profile.name) {
            firstName = profile.name.givenName || '';
            lastName = profile.name.familyName || '';
          } else {
            // Fallback: tentar extrair do displayName
            const nameParts = profile.displayName.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          }
          
          console.log('Dados do perfil Google:', {
            email,
            googleId,
            displayName: profile.displayName,
            firstName,
            lastName
          });

          // Verificar se o usuário já existe no banco de dados
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // Atualizar informações do usuário existente
            user.lastLogin = Date.now();
            user.firstName = firstName || user.firstName;
            user.lastName = lastName || user.lastName;
            user.profilePicture = profilePicture;
            await user.save();
            return done(null, user);
          }

          // Verificar se já existe um usuário com o mesmo email
          const existingUser = await User.findOne({ email });
          
          if (existingUser) {
            // Conectar conta Google com usuário existente
            existingUser.googleId = googleId;
            existingUser.profilePicture = profilePicture;
            existingUser.firstName = firstName || existingUser.firstName;
            existingUser.lastName = lastName || existingUser.lastName;
            existingUser.lastLogin = Date.now();
            await existingUser.save();
            return done(null, existingUser);
          }

          // Criar novo usuário com dados do Google
          const username = profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
          
          const newUser = await User.create({
            username: username,
            email: email,
            googleId: googleId,
            profilePicture: profilePicture,
            firstName: firstName,
            lastName: lastName,
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