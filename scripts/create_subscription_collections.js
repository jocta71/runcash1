/**
 * Script para criar as coleções necessárias para o sistema de assinaturas
 * Baseado na integração com Asaas
 */

import { MongoClient } from 'mongodb';

// Configuração MongoDB (usar a mesma string de conexão do seu projeto)
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = process.env.DB_NAME || "runcash"; // Usando o nome do banco de dados explicitamente

async function setupSubscriptionCollections() {
  console.log('Conectando ao MongoDB...');
  
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Conexão estabelecida com sucesso!');
    
    const db = client.db(DB_NAME);
    console.log(`Usando banco de dados: ${DB_NAME}`);
    
    // Listar coleções existentes
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('Coleções existentes:', collectionNames.join(', ') || 'Nenhuma coleção encontrada');

    // 1. Gerenciar coleção de assinaturas de usuários
    console.log('\nConfigurando coleção de assinaturas de usuários...');
    
    if (collectionNames.includes('userSubscriptions')) {
      console.log('Coleção userSubscriptions já existe');
      
      // Verificar se deseja recriar a coleção (apenas em ambiente de desenvolvimento)
      if (process.env.NODE_ENV === 'development') {
        try {
          // Remover índices existentes
          await db.collection('userSubscriptions').dropIndexes();
          console.log('Índices da coleção userSubscriptions removidos');
        } catch (error) {
          console.log('Não foi possível remover índices:', error.message);
        }
      }
    } else {
      await db.createCollection('userSubscriptions');
      console.log('✅ Coleção userSubscriptions criada com sucesso!');
    }
    
    // Adicionar índices para a coleção de assinaturas
    await db.collection('userSubscriptions').createIndexes([
      { key: { userId: 1 }, name: 'userId_idx' },
      { key: { asaasCustomerId: 1 }, name: 'asaasCustomerId_idx' },
      { key: { asaasSubscriptionId: 1 }, unique: true, name: 'asaasSubscriptionId_idx' },
      { key: { status: 1 }, name: 'status_idx' }
    ]);
    
    console.log('✅ Índices adicionados à coleção userSubscriptions');
    
    // 2. Gerenciar coleção para controle de webhooks processados (idempotência)
    console.log('\nConfigurando coleção para controle de idempotência...');
    
    if (collectionNames.includes('processedWebhooks')) {
      console.log('Coleção processedWebhooks já existe');
      
      // Verificar se deseja recriar a coleção (apenas em ambiente de desenvolvimento)
      if (process.env.NODE_ENV === 'development') {
        try {
          // Remover índices existentes
          await db.collection('processedWebhooks').dropIndexes();
          console.log('Índices da coleção processedWebhooks removidos');
        } catch (error) {
          console.log('Não foi possível remover índices:', error.message);
        }
      }
    } else {
      await db.createCollection('processedWebhooks');
      console.log('✅ Coleção processedWebhooks criada com sucesso!');
    }
    
    // Adicionar índices para a coleção de webhooks processados
    // Evitando conflitos - usando apenas o índice TTL que também será usado para pesquisa normal
    await db.collection('processedWebhooks').createIndexes([
      { key: { eventId: 1 }, unique: true, name: 'eventId_idx' },
      // Índice TTL único para controle de expiração e pesquisa
      { 
        key: { processedAt: 1 }, 
        name: 'processedAt_ttl_idx', 
        expireAfterSeconds: 2592000 // 30 dias
      }
    ]);
    
    console.log('✅ Índices adicionados à coleção processedWebhooks');
    
    // Listar todas as coleções para verificar
    const updatedCollections = await db.listCollections().toArray();
    console.log('\n📋 Coleções disponíveis no banco de dados:');
    updatedCollections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Esquema de exemplo para documentos de assinatura
    const exampleSubscription = {
      userId: 'user_123',
      asaasCustomerId: 'cus_123456',
      asaasSubscriptionId: 'sub_123456',
      status: 'ACTIVE',
      planType: 'PRO',
      nextDueDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('\nEsquema de exemplo para documentos de assinatura:');
    console.log(JSON.stringify(exampleSubscription, null, 2));
    
    // Verificar os índices criados na coleção processedWebhooks
    const webhookIndexes = await db.collection('processedWebhooks').listIndexes().toArray();
    console.log('\nÍndices na coleção processedWebhooks:');
    webhookIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Verificar os índices criados na coleção userSubscriptions
    const userSubIndexes = await db.collection('userSubscriptions').listIndexes().toArray();
    console.log('\nÍndices na coleção userSubscriptions:');
    userSubIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\n🎉 Setup de coleções concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a criação das coleções:', error);
  } finally {
    await client.close();
    console.log('Conexão com o MongoDB encerrada');
  }
}

// Executar setup
setupSubscriptionCollections()
  .then(() => console.log('Script finalizado'))
  .catch(err => console.error('Erro ao executar script:', err)); 