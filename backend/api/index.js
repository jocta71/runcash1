const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/runcash';
let db = null;

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    db = client.db();
    return db;
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
    return null;
  }
}

// Iniciar conexão com MongoDB
connectToMongoDB();

// Import our REST API routes
const restRoutes = require('./routes/restApi');
// Import our Events API routes
const eventsRoutes = require('./routes/eventsApi');
// Import strategies API routes
const strategiesRoutes = require('./routes/strategies');
// Import error handler middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3002;
// Simplificando: usando '*' para permitir todas as origens
// Podemos adicionar restrições mais tarde quando o app for público
const CORS_ORIGIN = '*';
// Mantendo a constante API_KEY para uso futuro
const API_KEY = process.env.API_KEY || 'runcash-default-key';

// Configuração CORS mais robusta
app.use(cors({
  origin: ['https://runcash5.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 
                 'ngrok-skip-browser-warning', 'bypass-tunnel-reminder', 'cache-control', 'pragma'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware adicional para garantir que CORS funcione
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning, bypass-tunnel-reminder, cache-control, pragma');
  
  // Permitir credenciais
  res.header('Access-Control-Allow-Credentials', true);
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware
app.use(express.json());

/* 
// Middleware para verificar API key - DESATIVADO TEMPORARIAMENTE
// Adicionaremos novamente quando o aplicativo for público
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // Pular verificação de API key para o endpoint de health check
  if (req.path === '/api/health') {
    return next();
  }
  
  // Verificar se a API key foi fornecida e é válida
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'API key inválida ou não fornecida' });
  }
  
  next();
};

// Aplicar middleware de API key a todas as rotas
app.use(apiKeyMiddleware);
*/

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "https://evzqzghxuttctbxgohpx.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;

// Verificar se as variáveis de ambiente obrigatórias estão definidas
if (!supabaseKey) {
  console.error('ERRO: SUPABASE_KEY não está definida!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Use our REST API routes
app.use('/api/rest', restRoutes);

// Use our Events API routes
app.use('/api/events', eventsRoutes);

// Use our Strategies API routes
app.use('/api/strategies', strategiesRoutes);

// Endpoint para obter dados das roletas
app.get('/api/roletas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('roletas')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar roletas:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados das roletas' });
    }
    
    // Garantir que os números mais recentes apareçam primeiro em cada roleta
    const formattedData = data.map(roleta => ({
      ...roleta,
      // Garantir que numeros seja sempre um array, mesmo se for null
      numeros: Array.isArray(roleta.numeros) ? roleta.numeros : [],
      // Calcular win rate
      win_rate: roleta.vitorias + roleta.derrotas > 0 
        ? ((roleta.vitorias / (roleta.vitorias + roleta.derrotas)) * 100).toFixed(1) + '%' 
        : 'N/A'
    }));
    
    return res.json(formattedData);
  } catch (err) {
    console.error('Erro na API:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para obter apenas o número mais recente de cada roleta
// Importante: este endpoint deve vir antes do endpoint com parâmetro :id
app.get('/api/roletas/latest', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('roletas')
      .select('id, nome, numeros, estado_estrategia, numero_gatilho, vitorias, derrotas, sugestao_display, updated_at')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar roletas:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados das roletas' });
    }
    
    // Extrair apenas o número mais recente de cada roleta e incluir dados da estratégia
    const latestNumbers = data.map(roleta => ({
      id: roleta.id,
      nome: roleta.nome,
      numero_recente: Array.isArray(roleta.numeros) && roleta.numeros.length > 0 ? roleta.numeros[0] : null,
      estado_estrategia: roleta.estado_estrategia || 'NEUTRAL',
      numero_gatilho: roleta.numero_gatilho || -1,
      vitorias: roleta.vitorias || 0,
      derrotas: roleta.derrotas || 0,
      win_rate: roleta.vitorias + roleta.derrotas > 0 
        ? ((roleta.vitorias / (roleta.vitorias + roleta.derrotas)) * 100).toFixed(1) + '%' 
        : 'N/A',
      sugestao_display: roleta.sugestao_display || '',
      updated_at: roleta.updated_at
    }));
    
    return res.json(latestNumbers);
  } catch (err) {
    console.error('Erro na API:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para obter dados de uma roleta específica
app.get('/api/roletas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('roletas')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error(`Erro ao buscar roleta ${id}:`, error);
      return res.status(500).json({ error: `Erro ao buscar dados da roleta ${id}` });
    }
    
    // Garantir que numeros seja sempre um array, mesmo se for null
    const formattedData = {
      ...data,
      numeros: Array.isArray(data.numeros) ? data.numeros : [],
      // Calcular win rate
      win_rate: data.vitorias + data.derrotas > 0 
        ? ((data.vitorias / (data.vitorias + data.derrotas)) * 100).toFixed(1) + '%' 
        : 'N/A'
    };
    
    return res.json(formattedData);
  } catch (err) {
    console.error('Erro na API:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint GET para o webhook (para verificação do Stripe)
app.get('/api/webhook', (req, res) => {
  res.json({ status: 'Webhook endpoint ativo. Use POST para eventos do Stripe.' });
});

// Rota para criar uma sessão de checkout do Stripe
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    console.log('Recebida solicitação para criar sessão de checkout:', req.body);
    const { planId, userId } = req.body;
    
    if (!planId || !userId) {
      console.error('planId ou userId não fornecidos');
      return res.status(400).json({ error: 'planId e userId são obrigatórios' });
    }
    
    // Buscar informações do plano no banco de dados ou usar um mapeamento fixo
    const planPriceMap = {
      'free': { priceId: null, amount: 0 },
      'basic': { priceId: 'price_1R0UgNGLEdW1oQ9Eu2YWBi3Y', amount: 1990 }, // R$ 19,90
      'pro': { priceId: 'price_1R0UgNGLEdW1oQ9Eu2YWBi3Y', amount: 4990 }, // R$ 49,90
      'premium': { priceId: 'price_1R0UgNGLEdW1oQ9Eu2YWBi3Y', amount: 9990 }, // R$ 99,90
    };
    
    const planInfo = planPriceMap[planId];
    
    if (!planInfo) {
      console.error(`Plano inválido: ${planId}`);
      return res.status(400).json({ error: 'Plano inválido' });
    }
    
    console.log(`Informações do plano ${planId}:`, planInfo);
    
    // Se for o plano gratuito, crie/atualize a assinatura diretamente
    if (planId === 'free') {
      // Verificar se já existe uma assinatura
      const { data: existingSubscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
        
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 é o código para "nenhum resultado encontrado"
        console.error('Erro ao buscar assinatura existente:', fetchError);
        return res.status(500).json({ error: 'Erro ao buscar assinatura existente', details: fetchError });
      }
      
      if (existingSubscription) {
        // Atualizar assinatura existente
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            plan_id: 'free',
            plan_type: 'FREE',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSubscription.id);
          
        if (updateError) {
          return res.status(500).json({ error: 'Erro ao atualizar assinatura', details: updateError });
        }
      } else {
        // Criar nova assinatura
        const { error: insertError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_id: 'free',
            plan_type: 'FREE',
            start_date: new Date().toISOString(),
            status: 'active'
          });
          
        if (insertError) {
          return res.status(500).json({ error: 'Erro ao criar assinatura', details: insertError });
        }
      }
      
      return res.json({ success: true, redirectUrl: '/payment-success?free=true' });
    }
    
    // Para planos pagos, criar uma sessão de checkout do Stripe
    try {
      console.log('Criando sessão de checkout do Stripe com:', {
        modo: 'subscription',
        priceId: planInfo.priceId,
        userId,
        planId
      });
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: planInfo.priceId, // Usar o ID do preço real do Stripe
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.headers.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/payment-canceled`,
        client_reference_id: userId,
        metadata: {
          userId,
          planId
        }
      });
      
      console.log('Sessão de checkout criada com sucesso:', {
        sessionId: session.id,
        url: session.url
      });
      
      res.json({ url: session.url, sessionId: session.id });
    } catch (stripeError) {
      console.error('Erro ao criar sessão de checkout do Stripe:', stripeError);
      return res.status(500).json({ 
        error: 'Erro ao criar sessão de checkout', 
        details: stripeError.message,
        code: stripeError.code || 'unknown'
      });
    }
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    res.status(500).json({ error: 'Erro ao criar sessão de checkout', details: error.message });
  }
});

// Webhook para processar eventos do Stripe
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Tratar eventos específicos
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata.userId;
      const planId = session.metadata.planId;
      
      if (!userId || !planId) {
        console.error('Metadados incompletos na sessão:', session);
        return res.status(400).json({ error: 'Metadados incompletos' });
      }
      
      try {
        // Verificar se já existe uma assinatura
        const { data: existingSubscription, error: fetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();
          
        const planTypeMap = {
          'basic': 'BASIC',
          'pro': 'PRO',
          'premium': 'PREMIUM'
        };
        
        const subscriptionData = {
          plan_id: planId,
          plan_type: planTypeMap[planId],
          payment_provider: 'stripe',
          payment_id: session.subscription,
          status: 'active',
          start_date: new Date().toISOString(),
          next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 dias
          updated_at: new Date().toISOString()
        };
        
        if (existingSubscription) {
          // Atualizar assinatura existente
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(subscriptionData)
            .eq('id', existingSubscription.id);
            
          if (updateError) {
            console.error('Erro ao atualizar assinatura:', updateError);
          }
        } else {
          // Criar nova assinatura
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              ...subscriptionData
            });
            
          if (insertError) {
            console.error('Erro ao criar assinatura:', insertError);
          }
        }
      } catch (error) {
        console.error('Erro ao processar assinatura:', error);
      }
      break;
    }
    
    case 'invoice.payment_succeeded': {
      // Atualizar a data do próximo pagamento
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      
      try {
        // Buscar a assinatura pelo ID do Stripe
        const { data: subscription, error: fetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('payment_id', subscriptionId)
          .single();
          
        if (fetchError || !subscription) {
          console.error('Assinatura não encontrada:', fetchError);
          break;
        }
        
        // Atualizar a data do próximo pagamento
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            next_billing_date: new Date(invoice.lines.data[0].period.end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);
          
        if (updateError) {
          console.error('Erro ao atualizar data do próximo pagamento:', updateError);
        }
      } catch (error) {
        console.error('Erro ao processar pagamento de fatura:', error);
      }
      break;
    }
    
    case 'customer.subscription.deleted': {
      // Cancelar a assinatura
      const subscription = event.data.object;
      
      try {
        // Buscar a assinatura pelo ID do Stripe
        const { data: dbSubscription, error: fetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('payment_id', subscription.id)
          .single();
          
        if (fetchError || !dbSubscription) {
          console.error('Assinatura não encontrada:', fetchError);
          break;
        }
        
        // Atualizar o status da assinatura
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            end_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', dbSubscription.id);
          
        if (updateError) {
          console.error('Erro ao cancelar assinatura:', updateError);
        }
      } catch (error) {
        console.error('Erro ao processar cancelamento de assinatura:', error);
      }
      break;
    }
  }
  
  res.json({ received: true });
});

// Error handler middleware (must be after all routes)
app.use(errorHandler);

// Verificar se a API está funcionando
app.get('/', (req, res) => {
  res.json({ status: 'API online', version: '1.0.0' });
});

// Endpoint de diagnóstico para debbuging
app.get('/api', (req, res) => {
  res.json({ status: 'API routes accessible', routes: 'Available at /api/roulettes, /api/numbers, etc' });
});

// Garantir que a rota /api/roulettes funcione
app.get('/api/roulettes', async (req, res) => {
  try {
    console.log('[API] Requisição recebida para /api/roulettes');
    
    // Obter o parâmetro limit da query string ou usar um valor padrão
    const numbersLimit = req.query.limit ? parseInt(req.query.limit) : 20;
    console.log(`[API] Parâmetro limit: ${numbersLimit}`);
    
    // Implementação alternativa caso não exista controlador ou MongoDB não esteja conectado
    if (!db) {
      console.log('[API] MongoDB não conectado, retornando dados simulados');
      return res.json([
        { id: '1', nome: 'Roleta Simulada 1', numero: [] },
        { id: '2', nome: 'Roleta Simulada 2', numero: [] }
      ]);
    }
    
    // Buscar roletas diretamente
    const roulettes = await db.collection('roletas').find({}).toArray();
    console.log(`[API] Encontradas ${roulettes.length} roletas`);
    
    let roletasCollection = 'roletas';
    let roletas = roulettes;
    
    if (roulettes.length === 0) {
      // Tentar coleção alternativa
      console.log('[API] Nenhuma roleta encontrada na coleção "roletas", tentando "roulettes"...');
      const altRoulettes = await db.collection('roulettes').find({}).toArray();
      
      if (altRoulettes.length > 0) {
        console.log(`[API] Encontradas ${altRoulettes.length} roletas na coleção "roulettes"`);
        roletasCollection = 'roulettes';
        roletas = altRoulettes;
      }
    }
    
    // Array para armazenar as promessas de busca de números
    const fetchPromises = [];
    
    // Para cada roleta, criar uma promessa para buscar os números mais recentes
    roletas.forEach((roleta) => {
      const originalId = roleta.id || roleta._id;
      // Converter UUID para ID canônico
      const id = mapToCanonicalId(originalId.toString());
      
      const promise = db.collection('roleta_numeros')
        .find({ roleta_id: id.toString() })
        .sort({ timestamp: -1 })
        .limit(numbersLimit)
        .toArray()
        .then(numeros => {
          console.log(`[API] Encontrados ${numeros.length} números para roleta ${id} (original: ${originalId})`);
          return { 
            roletaId: originalId, // Manter o ID original para mapeamento
            canonicalId: id, // Adicionar o ID canônico para referência
            numeros: numeros.map(n => ({
              numero: n.numero,
              roleta_id: n.roleta_id,
              roleta_nome: n.roleta_nome,
              cor: n.cor || determinarCorNumero(n.numero),
              timestamp: n.timestamp || n.created_at || n.criado_em
            }))
          };
        })
        .catch(error => {
          console.error(`[API] Erro ao buscar números para roleta ${id}:`, error);
          return { roletaId: originalId, canonicalId: id, numeros: [] };
        });
      
      fetchPromises.push(promise);
    });
    
    // Aguardar todas as promessas de busca de números
    const numerosResults = await Promise.all(fetchPromises);
    
    // Criar um mapa de ID da roleta para seus números
    const numerosMap = {};
    numerosResults.forEach(result => {
      numerosMap[result.roletaId] = result.numeros;
    });
    
    // Formatar roletas para uniformidade, incluindo os números
    const formattedRoulettes = roletas.map(r => {
      const id = r.id || r._id;
      const canonicalId = mapToCanonicalId(id.toString());
      
      return {
        id: id,
        canonical_id: canonicalId, // Adicionar ID canônico para referência
        nome: r.nome || r.name,
        // Incluir os números buscados ou usar um array vazio como fallback
        numero: numerosMap[id] || [],
        estado_estrategia: r.estado_estrategia || "NEUTRAL",
        vitorias: r.vitorias || 0,
        derrotas: r.derrotas || 0,
        win_rate: (r.vitorias || 0) + (r.derrotas || 0) > 0 ? `${((r.vitorias || 0) / ((r.vitorias || 0) + (r.derrotas || 0)) * 100).toFixed(1)}%` : "N/A",
        updated_at: r.updated_at || new Date().toISOString()
      };
    });
    
    return res.json(formattedRoulettes);
  } catch (error) {
    console.error('[API] Erro ao buscar roletas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar roletas', details: error.message });
  }
});

// Endpoint para obter números de uma roleta específica por ID
app.get('/api/roulette-numero/:id', async (req, res) => {
  try {
    let { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const skip = req.query.skip ? parseInt(req.query.skip) : 0;
    
    console.log(`[API] Requisição recebida para /api/roulette-numero/${id} (limit: ${limit}, skip: ${skip})`);

    // Converter UUID para ID canônico
    const canonicalId = mapToCanonicalId(id);
    if (canonicalId !== id) {
      console.log(`[API] UUID ${id} convertido para ID canônico ${canonicalId}`);
      id = canonicalId;
    }
    
    console.log(`[API] Buscando dados para ID canônico ${id}`);

    // Verificar se MongoDB está conectado
    if (!db) {
      console.error('[API] Erro: db não está inicializado');
      return res.status(500).json({ 
        error: 'Erro interno ao buscar números', 
        details: 'Conexão com MongoDB não foi estabelecida' 
      });
    }

    try {
      // Buscar na coleção roleta_numeros
      console.log(`[API] Buscando números para roleta ${id} no MongoDB...`);
      const numeros = await db.collection('roleta_numeros')
        .find({ roleta_id: id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      if (numeros.length === 0) {
        console.log(`[API] Nenhum número encontrado para roleta ${id}`);
        
        // Verificar se a roleta existe
        const roleta = await db.collection('roletas').findOne({ 
          $or: [
            { _id: id },
            { id: id }
          ]
        });
        
        if (!roleta) {
          console.log(`[API] Roleta ID ${id} não encontrada`);
          return res.status(404).json({ 
            error: 'Roleta não encontrada', 
            details: `Nenhuma roleta encontrada com ID ${id}` 
          });
        }
        
        return res.json([]); // Retornar array vazio, não é erro
      }

      console.log(`[API] Encontrados ${numeros.length} números para roleta ${id}`);
      
      // Formatar os números para garantir consistência
      const formattedNumbers = numeros.map(n => ({
        numero: n.numero,
        roleta_id: n.roleta_id,
        roleta_nome: n.roleta_nome,
        cor: n.cor || determinarCorNumero(n.numero),
        timestamp: n.timestamp || n.created_at || n.criado_em
      }));
      
      return res.json(formattedNumbers);
    } catch (dbError) {
      console.error('[API] Erro ao consultar MongoDB:', dbError);
      return res.status(500).json({ 
        error: 'Erro ao consultar banco de dados', 
        details: dbError.message 
      });
    }
  } catch (error) {
    console.error(`[API] Erro ao buscar números para roleta ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erro interno ao buscar números', 
      details: error.message 
    });
  }
});

// Função para mapear UUIDs para IDs canônicos
function mapToCanonicalId(uuid) {
  // Remover traços para normalização
  const normalizedUuid = uuid.replace(/-/g, '').toLowerCase();
  
  // Mapeamento direto de UUIDs para IDs canônicos
  const uuidToCanonicalMap = {
    // Brazilian Mega Roulette
    '7d3c2c9f2850f642861f5bb4daf1806a': '2380335',
    '7d3c2c9f-2850-f642-861f-5bb4daf1806a': '2380335',
    
    // Speed Auto Roulette
    '18bdc4ead884c47ad33f27a268a4eead': '2010096',
    '18bdc4ea-d884-c47a-d33f-27a268a4eead': '2010096',
    
    // Bucharest Auto-Roulette
    'e3345af9e3879412209ce793fe73e520': '2010065',
    'e3345af9-e387-9412-209c-e793fe73e520': '2010065',
    
    // Auto-Roulette VIP
    '419aa56cbcff67d2f424a6501bac4a36': '2010098',
    '419aa56c-bcff-67d2-f424-a6501bac4a36': '2010098',
    
    // Immersive Roulette
    '4cf27e482b9db58e7dcc48264c51d639': '2010016',
    '4cf27e48-2b9d-b58e-7dcc-48264c51d639': '2010016',
    
    // Auto-Roulette (Ruleta Automática)
    'f27dd03e5282fc78961c6375cef91565': '2010017',
    'f27dd03e-5282-fc78-961c-6375cef91565': '2010017'
  };
  
  // Verificar se o UUID existe diretamente no mapeamento
  if (uuidToCanonicalMap[uuid]) {
    console.log(`[API] Convertendo UUID ${uuid} para ID canônico ${uuidToCanonicalMap[uuid]}`);
    return uuidToCanonicalMap[uuid];
  }
  
  // Verificar se o UUID normalizado existe no mapeamento
  if (uuidToCanonicalMap[normalizedUuid]) {
    console.log(`[API] Convertendo UUID normalizado ${normalizedUuid} para ID canônico ${uuidToCanonicalMap[normalizedUuid]}`);
    return uuidToCanonicalMap[normalizedUuid];
  }
  
  // Se não encontrou correspondência, tenta verificar se o próprio UUID já é um ID canônico
  const canonicalIds = ['2010016', '2380335', '2010065', '2010096', '2010017', '2010098'];
  if (canonicalIds.includes(uuid)) {
    console.log(`[API] UUID ${uuid} já é um ID canônico, usando diretamente`);
    return uuid;
  }
  
  // Tenta usar como ID direto se for numérico
  if (/^\d+$/.test(uuid)) {
    console.log(`[API] UUID ${uuid} é numérico, assumindo que é um ID canônico`);
    return uuid;
  }
  
  // Se tudo falhar, retorna o ID original
  console.warn(`[API] ⚠️ Não foi possível converter UUID ${uuid} para ID canônico - usando original`);
  return uuid;
}

// Função auxiliar para determinar a cor de um número da roleta
function determinarCorNumero(numero) {
  if (numero === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
}

// Endpoint para obter números de uma roleta específica por ID - versão alternativa com nome no plural (para compatibilidade)
app.get('/api/roulette-numbers/:id', async (req, res) => {
  // Endpoint desativado para forçar uso da nova API
  console.log(`[API] Acesso ao endpoint desativado /api/roulette-numbers/${req.params.id}`);
  return res.status(404).json({ 
    error: 'Endpoint desativado', 
    message: 'Este endpoint foi removido. Por favor, use /api/roulette-numero/:id em vez disso.',
    code: 'ENDPOINT_DEPRECATED'
  });
});

// 404 handler for any routes not found
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
