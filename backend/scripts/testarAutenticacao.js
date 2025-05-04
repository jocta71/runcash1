const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// URL de conexão do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Simula o processo de verificação de assinatura
 */
async function testarAutenticacao() {
  const client = new MongoClient(url, { useUnifiedTopology: true });

  try {
    console.log('Conectando ao MongoDB...');
    await client.connect();
    console.log('Conectado ao MongoDB');

    const db = client.db(dbName);
    
    // Dados do usuário específico da imagem - usando email para evitar problemas com ObjectId
    const userEmail = 'teste12354@teste12354.com';
    const customerId = 'cus_000006678324';
    
    console.log('==== TESTE DE AUTENTICAÇÃO ====');
    console.log(`Testando usuário com email: ${userEmail}`);
    
    // 1. Verificar se o usuário existe
    const user = await db.collection('users').findOne({ 
      email: userEmail
    });
    
    if (!user) {
      console.log('❌ Usuário não encontrado!');
      return;
    }
    
    const userId = user._id.toString();
    
    console.log('✅ Usuário encontrado');
    console.log(`- ID: ${userId}`);
    console.log(`- Nome/Username: ${user.username || user.name || 'N/A'}`);
    console.log(`- Email: ${user.email || 'N/A'}`);
    console.log(`- asaasCustomerId: ${user.asaasCustomerId || 'Não definido'}`);
    console.log(`- customerId: ${user.customerId || 'Não definido'}`);
    
    // 2. Verificar se existem assinaturas para este customerId
    const customerIdToUse = user.customerId || user.asaasCustomerId;
    
    if (customerIdToUse) {
      console.log(`\nBuscando assinaturas para customerId: ${customerIdToUse}`);
      
      const subscription = await db.collection('userSubscriptions').findOne({
        customerId: customerIdToUse
      });
      
      if (subscription) {
        console.log('✅ Assinatura encontrada:');
        console.log(`- ID: ${subscription._id}`);
        console.log(`- Status: ${subscription.status}`);
        console.log(`- PendingFirstPayment: ${subscription.pendingFirstPayment}`);
        console.log(`- Valor: ${subscription.value}`);
        console.log(`- Próximo pagamento: ${subscription.nextDueDate}`);
        console.log(`- UserId: ${subscription.userId || 'Não vinculado'}`);
        
        // 3. Simular a verificação usada no middleware de subscriptionCheck
        const temAssinaturaAtiva = await simularVerificacaoAssinatura(db, userId);
        console.log(`\nVerificação de assinatura ativa: ${temAssinaturaAtiva ? '✅ SIM' : '❌ NÃO'}`);
        
        if (!temAssinaturaAtiva) {
          console.log('Motivo da falha:');
          // Verificar se a assinatura está ativa mas pendingFirstPayment é true
          if (subscription.status === 'active' && subscription.pendingFirstPayment === true) {
            console.log('- Status é "active" mas pendingFirstPayment ainda é true');
          } else if (subscription.status !== 'active') {
            console.log(`- Status não é "active" (atual: ${subscription.status})`);
          }
        }
      } else {
        console.log('❌ Nenhuma assinatura encontrada para este customerId');
      }
    } else {
      console.log('❌ Usuário não possui customerId ou asaasCustomerId');
    }
    
    // 4. Verificar assinaturas por userId diretamente
    console.log('\nVerificando assinaturas vinculadas diretamente ao userId...');
    const userIdSubscription = await db.collection('userSubscriptions').findOne({
      userId: userId
    });
    
    if (userIdSubscription) {
      console.log('✅ Assinatura vinculada ao userId encontrada:');
      console.log(`- ID: ${userIdSubscription._id}`);
      console.log(`- Status: ${userIdSubscription.status}`);
      console.log(`- CustomerId: ${userIdSubscription.customerId}`);
    } else {
      console.log('❌ Nenhuma assinatura vinculada diretamente ao userId');
    }
    
    // 5. Verificar pagamentos
    console.log('\nVerificando pagamentos...');
    const pagamentos = await db.collection('payments').find({
      customerId: customerIdToUse
    }).toArray();
    
    if (pagamentos.length > 0) {
      console.log(`✅ ${pagamentos.length} pagamentos encontrados:`);
      pagamentos.forEach((pagamento, index) => {
        console.log(`\nPagamento ${index + 1}:`);
        console.log(`- ID: ${pagamento._id}`);
        console.log(`- Valor: ${pagamento.value}`);
        console.log(`- Data: ${pagamento.paymentDate}`);
        console.log(`- Status: ${pagamento.status}`);
      });
    } else {
      console.log('❌ Nenhum pagamento encontrado para este customerId');
    }
    
    console.log('\n==== FIM DO TESTE DE AUTENTICAÇÃO ====');
    
  } catch (error) {
    console.error('Erro ao executar teste de autenticação:', error);
  } finally {
    await client.close();
    console.log('Conexão com MongoDB fechada');
  }
}

/**
 * Simula a verificação de assinatura usada no middleware
 */
async function simularVerificacaoAssinatura(db, userId) {
  try {
    // Buscar usuário para obter o customerId ou asaasCustomerId
    let user;
    try {
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    } catch (error) {
      // Se o ID não é um ObjectId válido, tentar buscar de outra forma
      user = await db.collection('users').findOne({ _id: userId });
    }
    
    // Se encontramos o usuário e ele tem customerId ou asaasCustomerId, verificamos por esse método
    if (user) {
      // Determinar qual campo usar para o ID do cliente
      const customerIdField = user.customerId ? 'customerId' : (user.asaasCustomerId ? 'asaasCustomerId' : null);
      const customerIdValue = user.customerId || user.asaasCustomerId;
      
      if (customerIdValue) {
        // Buscar assinatura ativa pelo customerId ou asaasCustomerId
        const subscription = await db.collection('userSubscriptions').findOne({
          customerId: customerIdValue,
          status: 'active',
          pendingFirstPayment: false
        });
        
        if (subscription) {
          return true;
        }
      }
    }
    
    // Método alternativo: verificar se há uma relação direta na coleção userSubscriptions
    const userIdSubscription = await db.collection('userSubscriptions').findOne({
      userId: userId,
      status: 'active',
      pendingFirstPayment: false
    });
    
    if (userIdSubscription) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return false;
  }
}

// Executar o script
testarAutenticacao().catch(console.error); 