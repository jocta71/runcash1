const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// URL de conexão do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * Script para criar o usuário faltante com o customerId correto
 */
async function createMissingUser() {
  const client = new MongoClient(url, { useUnifiedTopology: true });

  try {
    console.log('Conectando ao MongoDB...');
    await client.connect();
    console.log('Conectado ao MongoDB');

    const db = client.db(dbName);
    
    // Dados do usuário específico - Usando o ID diretamente da imagem
    // Note: o formato correto deve ser uma string de 24 caracteres hexadecimais
    // Vamos verificar primeiramente se o usuário existe pelo email
    const email = 'teste12354@teste12354.com';
    const customerId = 'cus_000006678324';
    
    // Verificar se o usuário já existe pelo email
    const existingUser = await db.collection('users').findOne({ email: email });
    
    if (existingUser) {
      console.log('Usuário encontrado pelo email. Atualizando customerId...');
      
      // Atualizar o usuário com o customerId correto
      const updateResult = await db.collection('users').updateOne(
        { email: email },
        { 
          $set: { 
            customerId: customerId,
            asaasCustomerId: customerId, // Manter ambos os campos por compatibilidade
            lastUpdated: new Date()
          } 
        }
      );
      
      console.log(`Usuário atualizado: ${updateResult.modifiedCount > 0 ? 'Sim' : 'Não'}`);
      console.log(`ID do usuário: ${existingUser._id}`);
    } else {
      console.log('Criando novo usuário...');
      
      // Criar novo usuário com o email especificado
      const newUser = {
        username: 'teste12354',
        email: 'teste12354@teste12354.com',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', // Hash de senha fictício
        customerId: customerId,
        asaasCustomerId: customerId, // Manter ambos os campos por compatibilidade
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 0
      };
      
      // Inserir o usuário
      const insertResult = await db.collection('users').insertOne(newUser);
      console.log(`Usuário criado: ${insertResult.acknowledged ? 'Sim' : 'Não'}`);
      console.log(`ID do usuário: ${insertResult.insertedId}`);
    }
    
    // Verificar a assinatura
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
      
      // Obter usuário atualizado
      const updatedUser = await db.collection('users').findOne({ email: email });
      
      if (updatedUser && !subscription.userId) {
        console.log('Adicionando userId à assinatura...');
        
        const updateSubscriptionResult = await db.collection('userSubscriptions').updateOne(
          { _id: subscription._id },
          { $set: { userId: updatedUser._id.toString() } }
        );
        
        console.log(`Assinatura atualizada: ${updateSubscriptionResult.modifiedCount > 0 ? 'Sim' : 'Não'}`);
      }
    }
    
    console.log('Operação concluída com sucesso!');
    
  } catch (error) {
    console.error('Erro ao executar script:', error);
  } finally {
    await client.close();
    console.log('Conexão com MongoDB fechada');
  }
}

// Executar o script
createMissingUser().catch(console.error); 