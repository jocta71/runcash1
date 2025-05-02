// Configuração de rotas da API
// Rotas de Assinatura
const subscriptionRoutes = require('./api/subscription/routes');
app.use('/api/subscription', subscriptionRoutes);

// Rota de reconstrução de assinatura
const subscriptionRebuildRoutes = require('./api/subscription/rebuild');
app.use('/api/subscription', subscriptionRebuildRoutes);

// Importar outras rotas
const authRoutes = require('./api/auth');
const userRoutes = require('./api/user');
const checkoutRoutes = require('./api/checkout');

// Rota para webhooks do Asaas
const asaasWebhookRoutes = require('./api/webhooks/asaas');

// Configurar rotas
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/webhooks/asaas', asaasWebhookRoutes); 