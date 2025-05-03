const { MongoClient, ObjectId } = require('mongodb');

// Informações do token
const USER_ID = "68158fb0d4c439794856fd8b";
const USER_EMAIL = "joctasaopaulino@gmail.com";
const ASAAS_CUSTOMER_ID = "cus_000006648482";

// Configuração do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

async function createAlternativeSubscription() {
  let client;

  try {
    console.log("\n=== Criando Assinatura Alternativa ===");
    console.log(`ID do Usuário: ${USER_ID}`);
    console.log(`Email do Usuário: ${USER_EMAIL}`);
    console.log(`ID do Cliente Asaas: ${ASAAS_CUSTOMER_ID}`);

    // Conectar ao MongoDB
    console.log("\nConectando ao MongoDB...");
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log("✅ Conectado ao MongoDB com sucesso");
    
    const db = client.db(MONGODB_DB_NAME);
    
    // 1. Criar assinatura alternativa na coleção userSubscriptions
    console.log("\n1. Criando nova assinatura alternativa em userSubscriptions:");
    
    const newSubscription = {
      userId: USER_ID,
      asaasCustomerId: ASAAS_CUSTOMER_ID,
      asaasSubscriptionId: "sub_alternate_format",
      status: "active",
      planType: "pro",
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Daqui a 30 dias
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log("Detalhes da nova assinatura:");
    console.log(JSON.stringify(newSubscription, null, 2));
    
    const result = await db.collection('userSubscriptions').insertOne(newSubscription);
    console.log(`✅ Assinatura alternativa criada com ID: ${result.insertedId}`);
    
    // 2. Criar uma versão com userId como string (para testar outras verificações)
    console.log("\n2. Criando assinatura com userId como string:");
    
    const stringIdSubscription = {
      userId: USER_ID.toString(), // Garantir que é string
      asaasCustomerId: ASAAS_CUSTOMER_ID,
      asaasSubscriptionId: "sub_string_id_format",
      status: "active",
      planType: "pro",
      nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Daqui a 30 dias
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const resultString = await db.collection('userSubscriptions').insertOne(stringIdSubscription);
    console.log(`✅ Assinatura com userId string criada com ID: ${resultString.insertedId}`);
    
    // 3. Validar se podemos encontrar as assinaturas
    console.log("\n3. Verificando se as assinaturas podem ser encontradas:");
    
    const foundSubscription = await db.collection('userSubscriptions').findOne({ _id: result.insertedId });
    console.log(`Assinatura 1: ${foundSubscription ? 'Encontrada ✅' : 'Não encontrada ❌'}`);
    
    const foundStringSubscription = await db.collection('userSubscriptions').findOne({ _id: resultString.insertedId });
    console.log(`Assinatura 2: ${foundStringSubscription ? 'Encontrada ✅' : 'Não encontrada ❌'}`);
    
    // 4. Encontrar pelo userId
    console.log("\n4. Buscando assinaturas pelo userId:");
    
    const subscriptionsByUserId = await db.collection('userSubscriptions').find({ 
      userId: USER_ID,
      status: "active"
    }).toArray();
    
    console.log(`Assinaturas encontradas pelo userId exato: ${subscriptionsByUserId.length}`);
    
    // 5. Salvar ID das assinaturas para facilitar testes futuros
    console.log("\n=== Resumo das Assinaturas Criadas ===");
    console.log(`Assinatura 1 ID: ${result.insertedId}`);
    console.log(`Assinatura 2 ID: ${resultString.insertedId}`);
    console.log("\nUse estes IDs para referência em testes futuros.");
    
  } catch (error) {
    console.error("Erro durante a criação de assinaturas:", error);
  } finally {
    if (client) {
      await client.close();
      console.log("\nConexão com MongoDB fechada");
    }
  }
}

// Executar criação
createAlternativeSubscription(); 