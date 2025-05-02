/**
 * Script para criar planos de assinatura no MongoDB
 * Execute este script para inicializar ou atualizar os planos disponíveis
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// URL de conexão MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:password@runcash.example.mongodb.net/";

// Definição dos planos de assinatura
const PLANS = [
  {
    name: 'Básico',
    price: 29.90,
    cycle: 'MONTHLY',
    description: 'Acesso a recursos essenciais para iniciantes',
    features: [
      'Acesso a todas as roletas',
      'Dados históricos (últimos 100 números)',
      'Estatísticas básicas'
    ],
    active: true,
    asaasCode: 'basic',
    limits: {
      roletas: 100,
      historico: 100,
      analises: 'basic'
    }
  },
  {
    name: 'Profissional',
    price: 49.90,
    cycle: 'MONTHLY',
    description: 'Para usuários sérios que buscam mais análises',
    features: [
      'Todos os recursos do plano Básico',
      'Dados históricos (últimos 500 números)',
      'Estatísticas avançadas',
      'Alertas de oportunidades',
      'Suporte prioritário'
    ],
    active: true,
    featured: true,
    asaasCode: 'pro',
    limits: {
      roletas: 500,
      historico: 500,
      analises: 'advanced'
    }
  },
  {
    name: 'Premium',
    price: 89.90,
    cycle: 'MONTHLY',
    description: 'Experiência completa para profissionais',
    features: [
      'Todos os recursos do plano Profissional',
      'Dados históricos completos',
      'Análise preditiva avançada',
      'Acesso à API',
      'Suporte VIP 24/7'
    ],
    active: true,
    asaasCode: 'premium',
    limits: {
      roletas: -1, // ilimitado
      historico: -1, // ilimitado
      analises: 'premium'
    }
  }
];

/**
 * Função principal que insere ou atualiza os planos no MongoDB
 */
async function setupSubscriptionPlans() {
  let client;
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    const db = client.db();
    const plansCollection = db.collection('subscription_plans');
    
    // Para cada plano na lista de planos
    for (const plan of PLANS) {
      // Verificar se o plano já existe pelo código Asaas
      const existingPlan = await plansCollection.findOne({ asaasCode: plan.asaasCode });
      
      if (existingPlan) {
        // Atualizar plano existente
        await plansCollection.updateOne(
          { asaasCode: plan.asaasCode },
          { $set: { 
              ...plan,
              updatedAt: new Date()
            } 
          }
        );
        console.log(`Plano '${plan.name}' atualizado com sucesso`);
      } else {
        // Inserir novo plano
        await plansCollection.insertOne({
          ...plan,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Plano '${plan.name}' criado com sucesso`);
      }
    }
    
    console.log('Todos os planos foram configurados com sucesso');
    
    // Listar planos ativos
    const activePlans = await plansCollection.find({ active: true }).toArray();
    console.log(`\nPlanos ativos (${activePlans.length}):`);
    activePlans.forEach(plan => {
      console.log(`- ${plan.name}: R$ ${plan.price.toFixed(2)}/${plan.cycle.toLowerCase()}`);
    });
    
  } catch (error) {
    console.error('Erro ao configurar planos de assinatura:', error);
  } finally {
    // Fechar conexão com o MongoDB
    if (client) {
      await client.close();
      console.log('Conexão com MongoDB encerrada');
    }
  }
}

// Executar a função
setupSubscriptionPlans(); 