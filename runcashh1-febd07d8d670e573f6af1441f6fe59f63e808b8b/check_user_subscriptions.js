const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão ao MongoDB
const url = "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
// Nome do banco de dados
const dbName = 'runcash';

// Dados relevantes
const userId = '68158fb0d4c439794856fd8b';
const customerId = 'cus_000006648482';

async function checkUserSubscriptions() {
  const client = new MongoClient(url);
  
  try {
    // Conectar ao servidor MongoDB
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso');
    
    // Selecionar o banco de dados
    const db = client.db(dbName);
    
    // Verificar a coleção userSubscriptions pelo user_id
    console.log(`\n1. Verificando userSubscriptions pelo user_id: ${userId}`);
    const userSubscriptions = await db.collection('userSubscriptions').find({ user_id: userId }).toArray();
    
    if (userSubscriptions.length === 0) {
      console.log('Nenhum registro encontrado na coleção userSubscriptions para este usuário');
    } else {
      console.log(`${userSubscriptions.length} registro(s) encontrado(s):`);
      console.log(JSON.stringify(userSubscriptions, null, 2));
    }
    
    // Verificar a coleção userSubscriptions pelo customer_id
    console.log(`\n2. Verificando userSubscriptions pelo customer_id: ${customerId}`);
    const subscriptionsByCustomerId = await db.collection('userSubscriptions').find({ customer_id: customerId }).toArray();
    
    if (subscriptionsByCustomerId.length === 0) {
      console.log('Nenhum registro encontrado na coleção userSubscriptions com este customer_id');
    } else {
      console.log(`${subscriptionsByCustomerId.length} registro(s) encontrado(s):`);
      console.log(JSON.stringify(subscriptionsByCustomerId, null, 2));
    }
    
    // Verificar se existem registros ativos
    console.log(`\n3. Verificando registros ativos na coleção userSubscriptions`);
    const activeUserSubscriptions = await db.collection('userSubscriptions').find({ status: 'active' }).toArray();
    
    if (activeUserSubscriptions.length === 0) {
      console.log('Nenhum registro ativo encontrado na coleção userSubscriptions');
    } else {
      console.log(`${activeUserSubscriptions.length} registro(s) ativo(s) encontrado(s):`);
      console.log(JSON.stringify(activeUserSubscriptions, null, 2));
    }
    
    // Verificar o esquema da coleção
    console.log(`\n4. Verificando esquema da coleção userSubscriptions`);
    if (userSubscriptions.length > 0) {
      console.log('Campos encontrados:');
      console.log(Object.keys(userSubscriptions[0]));
    } else {
      // Se não houver documentos, podemos tentar achar qualquer documento na coleção
      const anyDocument = await db.collection('userSubscriptions').findOne();
      if (anyDocument) {
        console.log('Campos encontrados em um documento qualquer:');
        console.log(Object.keys(anyDocument));
      } else {
        console.log('Coleção vazia ou inexistente.');
      }
    }
    
  } catch (err) {
    console.error('Erro ao executar a operação:', err);
  } finally {
    // Fechar a conexão
    await client.close();
    console.log('\nConexão com MongoDB fechada');
  }
}

checkUserSubscriptions(); 