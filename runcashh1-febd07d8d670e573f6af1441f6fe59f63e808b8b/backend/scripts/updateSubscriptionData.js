const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// URL de conexão do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Script para atualizar informações de customerId nos usuários com base nas assinaturas existentes
 */
async function updateSubscriptionData() {
  const client = new MongoClient(url, { useUnifiedTopology: true });

  try {
    console.log('Conectando ao MongoDB...');
    await client.connect();
    console.log('Conectado ao MongoDB');

    const db = client.db(dbName);
    
    // 1. Obter todas as assinaturas e userSubscriptions
    console.log('Obtendo assinaturas existentes...');
    const subscriptions = await db.collection('subscriptions').find({}).toArray();
    console.log(`Encontradas ${subscriptions.length} assinaturas no banco`);
    
    const userSubscriptions = await db.collection('userSubscriptions').find({}).toArray();
    console.log(`Encontradas ${userSubscriptions.length} userSubscriptions no banco`);
    
    // 2. Contar usuários sem customerId
    const totalUsers = await db.collection('users').countDocuments({});
    const usersWithoutCustomerId = await db.collection('users').countDocuments({ customerId: { $exists: false } });
    console.log(`Total de usuários: ${totalUsers}`);
    console.log(`Usuários sem customerId: ${usersWithoutCustomerId}`);
    
    // 3. Atualizar customerId nos usuários
    console.log('Atualizando customerId nos usuários...');
    let updatedCount = 0;
    
    // Para cada userSubscription, encontrar o usuário correspondente e atualizar o customerId
    for (const subscription of userSubscriptions) {
      if (subscription.customerId) {
        // Procurar por email, nome ou outro campo identificador em userSubscriptions
        // Neste caso, precisamos atualizar manualmente os IDs
        
        console.log(`Processando assinatura para customerId: ${subscription.customerId}`);
        console.log(`Status: ${subscription.status}, Valor: ${subscription.value}`);
        
        // Opcionalmente, podemos verificar no Asaas o email do cliente e usar isso para encontrar o usuário
        // Aqui estamos apenas atualizando um registro para demonstração
        const updateResult = await db.collection('users').updateOne(
          { email: 'admin@example.com' }, // Ajustar para o email correto do usuário
          { 
            $set: { 
              customerId: subscription.customerId,
              lastUpdated: new Date()
            } 
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          updatedCount++;
          console.log(`Usuário com email admin@example.com atualizado com customerId ${subscription.customerId}`);
        }
      }
    }
    
    console.log(`Atualizados ${updatedCount} usuários com customerId`);
    
    // 4. Verificar assinaturas ativas
    console.log('Verificando assinaturas ativas...');
    const activeSubscriptions = await db.collection('userSubscriptions').countDocuments({ 
      status: 'active',
      pendingFirstPayment: false
    });
    console.log(`Assinaturas ativas: ${activeSubscriptions}`);
    
    console.log('Script finalizado com sucesso!');
    
  } catch (error) {
    console.error('Erro ao executar script:', error);
  } finally {
    await client.close();
    console.log('Conexão com MongoDB fechada');
  }
}

/**
 * Verificar e corrigir assinatura para um usuário específico
 */
async function verificarUsuarioEspecifico() {
  const client = new MongoClient(url, { useUnifiedTopology: true });

  try {
    console.log('Conectando ao MongoDB...');
    await client.connect();
    console.log('Conectado ao MongoDB');

    const db = client.db(dbName);
    
    // Definir os IDs específicos a verificar
    const userId = '6816b43bcf2a0e30e543a477';
    const customerId = 'cus_000006678324';
    
    console.log(`Verificando usuário específico: ${userId}`);
    
    // 1. Verificar se o usuário existe
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    console.log('Usuário encontrado:', user ? 'Sim' : 'Não');
    
    if (user) {
      console.log('Dados do usuário:');
      console.log(`- Nome: ${user.name || 'N/A'}`);
      console.log(`- Email: ${user.email || 'N/A'}`);
      console.log(`- CustomerId: ${user.customerId || 'Não definido'}`);
      
      // 2. Verificar userSubscription
      const subscription = await db.collection('userSubscriptions').findOne({ 
        customerId: customerId
      });
      
      console.log('Assinatura encontrada:', subscription ? 'Sim' : 'Não');
      
      if (subscription) {
        console.log('Dados da assinatura:');
        console.log(`- Status: ${subscription.status}`);
        console.log(`- PendingFirstPayment: ${subscription.pendingFirstPayment}`);
        console.log(`- Valor: ${subscription.value}`);
        console.log(`- Próximo pagamento: ${subscription.nextDueDate}`);
      }
      
      // 3. Corrigir customerId do usuário se necessário
      if (!user.customerId || user.customerId !== customerId) {
        console.log(`Atualizando customerId do usuário para: ${customerId}`);
        
        const updateResult = await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { customerId: customerId } }
        );
        
        console.log(`Atualização realizada: ${updateResult.modifiedCount > 0 ? 'Sim' : 'Não'}`);
      } else {
        console.log('CustomerId já está correto no documento do usuário.');
      }
      
      // 4. Verificar se a assinatura tem userId (relacionamento inverso)
      if (subscription && !subscription.userId) {
        console.log('Adicionando userId à assinatura para criar relação bidirecional');
        
        const updateSubscriptionResult = await db.collection('userSubscriptions').updateOne(
          { _id: subscription._id },
          { $set: { userId: userId } }
        );
        
        console.log(`Assinatura atualizada: ${updateSubscriptionResult.modifiedCount > 0 ? 'Sim' : 'Não'}`);
      }
      
      // 5. Simular uma verificação de assinatura para o usuário
      const hasActive = await db.collection('userSubscriptions').findOne({
        customerId: customerId,
        status: 'active',
        pendingFirstPayment: false
      });
      
      console.log(`Usuário tem assinatura ativa? ${hasActive ? 'Sim' : 'Não'}`);
    } else {
      console.log('Usuário não encontrado!');
    }
    
    console.log('Verificação concluída!');
    
  } catch (error) {
    console.error('Erro ao executar verificação:', error);
  } finally {
    await client.close();
    console.log('Conexão com MongoDB fechada');
  }
}

// Se o script foi chamado diretamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--verificar-usuario')) {
    verificarUsuarioEspecifico().catch(console.error);
  } else {
    updateSubscriptionData().catch(console.error);
  }
}

module.exports = {
  updateSubscriptionData,
  verificarUsuarioEspecifico
}; 