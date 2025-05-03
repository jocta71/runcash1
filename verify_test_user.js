const { MongoClient, ObjectId } = require('mongodb');

// Informações do token
const USER_ID = "68158fb0d4c439794856fd8b";
const USER_EMAIL = "joctasaopaulino@gmail.com";

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

async function verifyTestUser() {
  let client;

  try {
    console.log("\n=== Verificação Detalhada do Usuário ===");
    console.log(`ID do Usuário: ${USER_ID}`);
    console.log(`Email do Usuário: ${USER_EMAIL}`);

    // Conectar ao MongoDB
    console.log("\nConectando ao MongoDB...");
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log("✅ Conectado ao MongoDB com sucesso");
    
    const db = client.db(MONGODB_DB_NAME);
    
    // 1. Verificar usuário
    console.log("\n1. Buscando usuário nas seguintes formas:");
    console.log("   - Por _id como ObjectId");
    console.log("   - Por id como string");
    console.log("   - Por email");
    
    let user = null;
    
    try {
      user = await db.collection('users').findOne({ _id: new ObjectId(USER_ID) });
      if (user) {
        console.log("✅ Usuário encontrado pelo _id!");
      }
    } catch (err) {
      console.log(`❌ Erro ao buscar por ObjectId: ${err.message}`);
    }
    
    if (!user) {
      user = await db.collection('users').findOne({ id: USER_ID });
      if (user) {
        console.log("✅ Usuário encontrado pelo id (string)!");
      }
    }
    
    if (!user) {
      user = await db.collection('users').findOne({ email: USER_EMAIL });
      if (user) {
        console.log("✅ Usuário encontrado pelo email!");
      }
    }
    
    if (user) {
      console.log("\nDetalhes do usuário:");
      console.log(JSON.stringify(user, null, 2));
      
      // Verificar campos customerId
      if (user.customerId) {
        console.log(`\nCustomerId encontrado: ${user.customerId}`);
      } else if (user.asaasCustomerId) {
        console.log(`\nAsaasCustomerId encontrado: ${user.asaasCustomerId}`);
      } else {
        console.log("\n⚠️ Usuário não possui customerId nem asaasCustomerId");
      }
    } else {
      console.log("❌ Usuário não encontrado em nenhuma forma");
    }
    
    // 2. Verificar assinatura diretamente
    console.log("\n2. Verificando assinatura em userSubscriptions:");
    console.log("   - Pelo userId exato");
    
    const subscription = await db.collection('userSubscriptions').findOne({ userId: USER_ID });
    
    if (subscription) {
      console.log("✅ Assinatura encontrada pelo userId!");
      console.log("\nDetalhes da assinatura:");
      console.log(JSON.stringify(subscription, null, 2));
      
      if (subscription.status === "active") {
        console.log("\n🎉 ASSINATURA ESTÁ ATIVA!");
      } else {
        console.log(`\n⚠️ Status da assinatura: ${subscription.status} (não ativa)`);
      }
    } else {
      console.log("❌ Assinatura não encontrada pelo userId exato");
      
      // Verificar todas as assinaturas
      console.log("\n3. Listando todas as assinaturas em userSubscriptions:");
      const allSubscriptions = await db.collection('userSubscriptions').find({}).limit(5).toArray();
      
      console.log(`Total de assinaturas: ${await db.collection('userSubscriptions').countDocuments({})}`);
      console.log("Exemplos de assinaturas (5 primeiras):");
      console.log(JSON.stringify(allSubscriptions, null, 2));
      
      // Mostrar schema
      if (allSubscriptions.length > 0) {
        console.log("\nCampos disponíveis em uma assinatura:");
        console.log(Object.keys(allSubscriptions[0]));
      }
    }
    
    // 3. Verificar assinatura old-style
    if (user && (user.customerId || user.asaasCustomerId)) {
      const customerId = user.customerId || user.asaasCustomerId;
      console.log(`\n4. Verificando assinatura em subscriptions pelo customer_id: ${customerId}`);
      
      const oldStyleSubscription = await db.collection('subscriptions').findOne({ customer_id: customerId });
      
      if (oldStyleSubscription) {
        console.log("✅ Assinatura old-style encontrada!");
        console.log("\nDetalhes da assinatura old-style:");
        console.log(JSON.stringify(oldStyleSubscription, null, 2));
        
        if (oldStyleSubscription.status === "active") {
          console.log("\n🎉 ASSINATURA OLD-STYLE ESTÁ ATIVA!");
        } else {
          console.log(`\n⚠️ Status da assinatura old-style: ${oldStyleSubscription.status} (não ativa)`);
        }
      } else {
        console.log("❌ Assinatura old-style não encontrada");
      }
    }
    
    // 4. Verificar pagamentos recentes
    console.log("\n5. Verificando pagamentos recentes:");
    const recentPayment = await db.collection('payments').findOne({
      userId: USER_ID,
      status: { $in: ["CONFIRMED", "RECEIVED", "ACTIVE"] },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }  // últimos 30 dias
    });
    
    if (recentPayment) {
      console.log("✅ Pagamento recente encontrado!");
      console.log("\nDetalhes do pagamento:");
      console.log(JSON.stringify(recentPayment, null, 2));
    } else {
      console.log("❌ Nenhum pagamento recente encontrado");
      
      // Verificar todos os pagamentos
      console.log("\nVerificando todos os pagamentos para este usuário:");
      const allPayments = await db.collection('payments').find({ userId: USER_ID }).limit(5).toArray();
      
      if (allPayments.length > 0) {
        console.log(`Total de pagamentos: ${await db.collection('payments').countDocuments({ userId: USER_ID })}`);
        console.log("Exemplos de pagamentos (5 primeiros):");
        console.log(JSON.stringify(allPayments, null, 2));
      } else {
        console.log("Nenhum pagamento encontrado para este usuário");
      }
    }
    
    // 5. Verificar coleções
    console.log("\n6. Coleções disponíveis no banco de dados:");
    const collections = await db.listCollections().toArray();
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
  } catch (error) {
    console.error("Erro durante a verificação:", error);
  } finally {
    if (client) {
      await client.close();
      console.log("\nConexão com MongoDB fechada");
    }
  }
}

// Executar verificação
verifyTestUser(); 