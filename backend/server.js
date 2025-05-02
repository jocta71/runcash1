// Rotas de Assinatura
const subscriptionRoutes = require('./api/subscription/routes');
app.use('/api/subscription', subscriptionRoutes);

// Rota de reconstrução de assinatura
const subscriptionRebuildRoutes = require('./api/subscription/rebuild');
app.use('/api/subscription', subscriptionRebuildRoutes);

// Rota para webhooks do Asaas
const asaasWebhookRoutes = require('./api/webhooks/asaas');
app.use('/api/webhooks/asaas', asaasWebhookRoutes); 