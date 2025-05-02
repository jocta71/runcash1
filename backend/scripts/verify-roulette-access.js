/**
 * Script para verificar o acesso de um usuário ao serviço de roletas
 * Útil para debug e confirmação do funcionamento da API
 * 
 * Uso: node scripts/verify-roulette-access.js --email=usuario@exemplo.com
 * ou   node scripts/verify-roulette-access.js --id=623f7a2b91a3f254e1d7b3c4
 */

const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');

// Configurações
const CONNECTION_STRING = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const DATABASE_NAME = 'runcash';

// Analisar argumentos
const args = process.argv.slice(2);
let userId = null;
let userEmail = null;

for (const arg of args) {
  if (arg.startsWith('--id=')) {
    userId = arg.split('=')[1];
  } else if (arg.startsWith('--email=')) {
    userEmail = arg.split('=')[1];
  }
}

if (!userId && !userEmail) {
  console.error('Uso: node verify-roulette-access.js --email=exemplo@email.com');
  console.error('  ou: node verify-roulette-access.js --id=623f7a2b91a3f254e1d7b3c4');
  process.exit(1);
}

// Conectar ao MongoDB e verificar acesso
async function checkAccess() {
  let client;
  
  try {
    console.log('Conectando ao MongoDB...');
    client = await MongoClient.connect(CONNECTION_STRING);
    
    console.log(`Conexão estabelecida com ${DATABASE_NAME}`);
    const db = client.db(DATABASE_NAME);
    
    // Encontrar usuário
    let user;
    if (userId) {
      try {
        user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      } catch (e) {
        console.error('ID de usuário inválido. Certifique-se que é um ObjectId válido.');
        return;
      }
    } else if (userEmail) {
      user = await db.collection('users').findOne({ email: userEmail });
    }
    
    if (!user) {
      console.error('Usuário não encontrado.');
      return;
    }
    
    console.log('\n===== INFORMAÇÕES DO USUÁRIO =====');
    console.log(`ID: ${user._id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Nome: ${user.name || '(não definido)'}`);
    console.log(`Status do plano: ${user.planStatus || 'INACTIVE'}`);
    console.log(`Tipo do plano: ${user.planType || 'FREE'}`);
    
    // Verificar assinatura
    const subscription = await db.collection('subscriptions').findOne({
      user_id: user._id.toString(),
      status: { $in: ['active', 'ACTIVE', 'ativa'] }
    });
    
    console.log('\n===== STATUS DA ASSINATURA =====');
    if (subscription) {
      console.log('Assinatura: ATIVA');
      console.log(`Plano: ${subscription.plan_id || '(não definido)'}`);
      console.log(`Data de criação: ${subscription.createdAt || '(não definida)'}`);
    } else {
      console.log('Assinatura: NÃO ENCONTRADA ou INATIVA');
    }
    
    // Determinar acesso com base no status do plano e assinatura
    const hasActivePlan = user.planStatus === 'ACTIVE';
    const hasActiveSubscription = !!subscription;
    const hasAccess = hasActivePlan || hasActiveSubscription;
    
    console.log('\n===== ACESSO ÀS ROLETAS =====');
    console.log(`Acesso concedido: ${hasAccess ? 'SIM' : 'NÃO'}`);
    console.log(`Plano ativo: ${hasActivePlan ? 'SIM' : 'NÃO'}`);
    console.log(`Assinatura ativa: ${hasActiveSubscription ? 'SIM' : 'NÃO'}`);
    
    if (hasAccess) {
      console.log('\n✅ USUÁRIO TEM ACESSO AO SERVIÇO DE ROLETAS');
    } else {
      console.log('\n❌ USUÁRIO NÃO TEM ACESSO AO SERVIÇO DE ROLETAS');
    }
    
  } catch (error) {
    console.error('Erro ao verificar acesso:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nConexão com o MongoDB fechada.');
    }
  }
}

// Executar
checkAccess()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Erro não tratado:', error);
    process.exit(1);
  }); 