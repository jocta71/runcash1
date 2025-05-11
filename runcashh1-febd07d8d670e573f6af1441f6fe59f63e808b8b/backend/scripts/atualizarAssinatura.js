const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// URL de conexão do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Atualiza a assinatura para vincular ao usuário correto
 */
async function atualizarAssinatura() {
  const client = new MongoClient(url, { useUnifiedTopology: true });

  try {
    console.log('Conectando ao MongoDB...');
    await client.connect();
    console.log('Conectado ao MongoDB');

    const db = client.db(dbName);
    
    // Dados específicos
    const userEmail = 'teste12354@teste12354.com';
    const customerId = 'cus_000006678324';
    
    console.log('==== ATUALIZANDO VÍNCULO DE ASSINATURA ====');
    
    // 1. Encontrar usuário
    const user = await db.collection('users').findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ Usuário não encontrado!');
      return;
    }
    
    console.log(`✅ Usuário encontrado: ${user._id}`);
    
    // 2. Encontrar assinatura
    const subscription = await db.collection('userSubscriptions').findOne({
      customerId: customerId
    });
    
    if (!subscription) {
      console.log('❌ Assinatura não encontrada!');
      return;
    }
    
    console.log(`✅ Assinatura encontrada: ${subscription._id}`);
    console.log(`- Status atual: ${subscription.status}`);
    console.log(`- PendingFirstPayment: ${subscription.pendingFirstPayment}`);
    console.log(`- UserId atual: ${subscription.userId || 'Não definido'}`);
    
    // 3. Atualizar a assinatura com o userId correto
    const updateResult = await db.collection('userSubscriptions').updateOne(
      { _id: subscription._id },
      { 
        $set: { 
          userId: user._id.toString()
        } 
      }
    );
    
    console.log(`Atualização realizada: ${updateResult.modifiedCount > 0 ? '✅ SIM' : '❌ NÃO'}`);
    
    // 4. Verificar se o usuário também tem o customerId correto
    if (user.customerId !== customerId || user.asaasCustomerId !== customerId) {
      console.log('Atualizando customerId do usuário...');
      
      const userUpdateResult = await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            customerId: customerId,
            asaasCustomerId: customerId
          } 
        }
      );
      
      console.log(`Usuário atualizado: ${userUpdateResult.modifiedCount > 0 ? '✅ SIM' : '❌ NÃO'}`);
    } else {
      console.log('✅ CustomerId do usuário já está correto.');
    }
    
    // 5. Verificar resultado final
    const updatedSubscription = await db.collection('userSubscriptions').findOne({
      _id: subscription._id
    });
    
    console.log('\nResultado final:');
    console.log(`- ID da assinatura: ${updatedSubscription._id}`);
    console.log(`- Status: ${updatedSubscription.status}`);
    console.log(`- PendingFirstPayment: ${updatedSubscription.pendingFirstPayment}`);
    console.log(`- UserId: ${updatedSubscription.userId || 'Não definido'}`);
    console.log(`- CustomerId: ${updatedSubscription.customerId}`);
    
    console.log('\n==== VÍNCULO ATUALIZADO COM SUCESSO ====');
    
  } catch (error) {
    console.error('Erro ao atualizar assinatura:', error);
  } finally {
    await client.close();
    console.log('Conexão com MongoDB fechada');
  }
}

// Executar o script
atualizarAssinatura().catch(console.error); 