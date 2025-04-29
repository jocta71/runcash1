// Configurar rotas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const rouletteRoutes = require('./routes/roulette.routes');
// Importar rotas de fallback para assinaturas
const subscriptionFallbackRoutes = require('./routes/subscriptionFallback');

// Registrar rotas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roulettes', rouletteMiddleware, rouletteRoutes);
// Registrar rotas de fallback para assinaturas
app.use('/api/subscription-fallback', subscriptionFallbackRoutes); 