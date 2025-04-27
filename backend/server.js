// Rotas
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/roulettes', require('./routes/rouletteRoutes'));
app.use('/api/estrategias', require('./routes/estrategiaRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes')); 