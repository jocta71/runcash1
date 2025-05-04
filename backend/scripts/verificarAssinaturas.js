const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '../.env' });

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb+srv://admin:9QxHD8h0BLzZE7p2@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority';
  const client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });

  try {
    console.log('Conectando ao MongoDB...');
    await client.connect();
    console.log('Conectado ao MongoDB');
    
    const db = client.db('runcash');
    
    // Verificar todas as assinaturas ativas
    console.log(`\n==== VERIFICANDO TODAS AS ASSINATURAS ATIVAS ====`);
    const activeSubscriptions = await db.collection('userSubscriptions')
      .find({ 
        status: 'active',
        pendingFirstPayment: false
      })
      .toArray();
    
    console.log(`Total de assinaturas ativas: ${activeSubscriptions.length}`);
    
    // Verificar todos os usuários com customerId
    const users = await db.collection('users')
      .find({
        $or: [
          { customerId: { $exists: true, $ne: null } },
          { asaasCustomerId: { $exists: true, $ne: null } }
        ]
      })
      .toArray();
    
    console.log(`Total de usuários com customerId: ${users.length}`);
    
    // Mapear customerIds para usuários
    const customerIdToUserMap = {};
    users.forEach(user => {
      const customerId = user.customerId || user.asaasCustomerId;
      if (customerId) {
        customerIdToUserMap[customerId] = user;
      }
    });
    
    // Verificar associações entre assinaturas e usuários
    console.log(`\n==== ANÁLISE DE ASSOCIAÇÕES ====`);
    
    // Contar tipos de situações
    let assinaturasComUsuario = 0;
    let assinaturasSemUsuario = 0;
    let usuariosComAssinatura = 0;
    let usuariosSemAssinatura = 0;
    
    // Verificar assinaturas sem usuário
    const assinaturasSemUsuarioList = activeSubscriptions.filter(sub => !sub.userId);
    assinaturasSemUsuario = assinaturasSemUsuarioList.length;
    
    if (assinaturasSemUsuarioList.length > 0) {
      console.log(`\n==== ASSINATURAS ATIVAS SEM USUÁRIO VINCULADO (${assinaturasSemUsuarioList.length}) ====`);
      assinaturasSemUsuarioList.forEach((sub, index) => {
        console.log(`\nAssinatura #${index + 1}:`);
        console.log('- ID:', sub._id);
        console.log('- CustomerId:', sub.customerId);
        console.log('- Status:', sub.status);
        
        // Verificar se existe usuário com este customerId
        const matchedUser = customerIdToUserMap[sub.customerId];
        if (matchedUser) {
          console.log(`⚠️ Existe usuário com este customerId que deveria estar vinculado:`);
          console.log('- User ID:', matchedUser._id);
          console.log('- Email:', matchedUser.email);
        }
      });
    }
    
    // Verificar assinaturas com usuário
    const assinaturasComUsuarioList = activeSubscriptions.filter(sub => sub.userId);
    assinaturasComUsuario = assinaturasComUsuarioList.length;
    
    if (assinaturasComUsuarioList.length > 0) {
      console.log(`\n==== ASSINATURAS ATIVAS COM USUÁRIO VINCULADO (${assinaturasComUsuarioList.length}) ====`);
      for (const sub of assinaturasComUsuarioList) {
        console.log(`\nAssinatura com userId ${sub.userId}:`);
        console.log('- ID:', sub._id);
        console.log('- CustomerId:', sub.customerId);
        console.log('- Status:', sub.status);
        
        // Verificar se o usuário existe
        try {
          const userId = sub.userId.toString();
          const user = await db.collection('users').findOne({ 
            _id: new ObjectId(userId) 
          });
          
          if (user) {
            console.log('✅ Usuário encontrado:');
            console.log('- Email:', user.email);
            console.log('- CustomerId do usuário:', user.customerId || user.asaasCustomerId);
            
            // Verificar se o customerId está correto
            if ((user.customerId !== sub.customerId) && (user.asaasCustomerId !== sub.customerId)) {
              console.log('⚠️ INCONSISTÊNCIA: CustomerId do usuário não corresponde ao da assinatura');
            }
          } else {
            console.log('❌ Usuário não encontrado na base de dados');
          }
        } catch (err) {
          console.log('❌ Erro ao verificar usuário:', err.message);
        }
      }
    }
    
    // Estatísticas gerais
    console.log(`\n==== ESTATÍSTICAS GERAIS ====`);
    console.log(`Total de assinaturas ativas: ${activeSubscriptions.length}`);
    console.log(`- Com usuário vinculado: ${assinaturasComUsuario}`);
    console.log(`- Sem usuário vinculado: ${assinaturasSemUsuario}`);
    
    console.log(`\nTotal de usuários com customerId: ${users.length}`);
    console.log(`Total de customerIds distintos: ${Object.keys(customerIdToUserMap).length}`);
    
    // Verificar o usuário problemático específico
    const problematicCustomerId = 'cus_000006678365';
    console.log(`\n==== VERIFICAÇÃO ESPECÍFICA: ${problematicCustomerId} ====`);
    
    const specificSubscription = await db.collection('userSubscriptions')
      .findOne({ customerId: problematicCustomerId });
      
    if (specificSubscription) {
      console.log('Assinatura encontrada:');
      console.log('- ID:', specificSubscription._id);
      console.log('- Status:', specificSubscription.status);
      console.log('- UserId:', specificSubscription.userId || 'Não definido');
      console.log('- PendingFirstPayment:', specificSubscription.pendingFirstPayment);
      
      if (specificSubscription.userId) {
        try {
          const user = await db.collection('users').findOne({ 
            _id: new ObjectId(specificSubscription.userId) 
          });
          
          if (user) {
            console.log('Usuário vinculado:');
            console.log('- Email:', user.email);
            console.log('- CustomerId:', user.customerId || user.asaasCustomerId);
          } else {
            console.log('❌ Usuário não encontrado');
          }
        } catch (err) {
          console.log('❌ Erro ao verificar usuário:', err.message);
        }
      }
    } else {
      console.log('❌ Nenhuma assinatura encontrada com este customerId');
      
      // Verificar se existe usuário com este customerId
      const user = await db.collection('users').findOne({
        $or: [
          { customerId: problematicCustomerId },
          { asaasCustomerId: problematicCustomerId }
        ]
      });
      
      if (user) {
        console.log('⚠️ Existe usuário com este customerId:');
        console.log('- ID:', user._id);
        console.log('- Email:', user.email);
      } else {
        console.log('❌ Nenhum usuário encontrado com este customerId');
      }
    }
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

main(); 