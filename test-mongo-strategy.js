/**
 * Script de teste para verificar a conexão com MongoDB e salvar/ler estratégias
 * Execute com: node test-mongo-strategy.js
 */

const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// String de conexão do MongoDB
const MONGO_URI = 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const DB_NAME = 'runcash';

// Definir o Schema da Strategy (igual ao arquivo models/Strategy.js)
const StrategySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome da estratégia é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  conditions: {
    type: Array,
    required: [true, 'Pelo menos uma condição é obrigatória'],
    validate: {
      validator: function(conditions) {
        console.log(`[Teste] Validando condições: ${conditions?.length} condições`);
        return conditions && conditions.length > 0;
      },
      message: 'Adicione pelo menos uma condição à sua estratégia'
    }
  },
  roletaId: {
    type: String,
    required: false,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Adicionar hooks para log
StrategySchema.pre('save', function(next) {
  console.log(`[Teste] Pré-save hook: ${this.name}`);
  this.updatedAt = Date.now();
  next();
});

StrategySchema.post('save', function(doc) {
  console.log(`[Teste] Pós-save hook: Estratégia salva com ID ${doc._id}`);
});

// Criar o modelo
const Strategy = mongoose.models.Strategy || mongoose.model('Strategy', StrategySchema);

// Função para testar com a API do MongoDB nativa
async function testWithMongoClient() {
  console.log('\n----- TESTE COM MONGO CLIENT -----');
  const testId = uuidv4().substring(0, 8); // Identificador único para o teste
  const client = new MongoClient(MONGO_URI);
  
  try {
    console.log('Conectando ao MongoDB com MongoClient...');
    await client.connect();
    console.log('Conexão estabelecida!');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('strategies');
    
    // Dados de exemplo
    const testStrategy = {
      name: `Estratégia de Teste - MongoClient ${testId}`,
      conditions: [
        { id: '1', type: 'color', operator: 'equals', value: 'red' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('Salvando estratégia de teste...');
    console.time('save-mongo-client');
    const result = await collection.insertOne(testStrategy);
    console.timeEnd('save-mongo-client');
    
    if (result.acknowledged) {
      console.log(`Estratégia salva com sucesso! ID: ${result.insertedId}`);
      
      // Verificar se foi realmente salva
      console.log('Verificando se a estratégia foi salva...');
      const savedStrategy = await collection.findOne({ _id: result.insertedId });
      
      if (savedStrategy) {
        console.log('✅ SUCESSO: Estratégia encontrada no banco!');
        console.log('Dados salvos:', savedStrategy);
      } else {
        console.log('❌ ERRO: Estratégia não encontrada após inserção!');
      }
    } else {
      console.log('❌ ERRO: Falha ao salvar estratégia');
    }
    
  } catch (error) {
    console.error('❌ ERRO durante teste com MongoClient:', error);
  } finally {
    console.log('Fechando conexão...');
    await client.close();
    console.log('Conexão fechada!');
  }
}

// Função para testar com o Mongoose
async function testWithMongoose() {
  console.log('\n----- TESTE COM MONGOOSE -----');
  const testId = uuidv4().substring(0, 8);
  
  try {
    console.log('Conectando ao MongoDB com Mongoose...');
    await mongoose.connect(MONGO_URI, {
      dbName: DB_NAME
    });
    console.log('Conexão Mongoose estabelecida!');
    
    // Dados de exemplo
    const testStrategy = new Strategy({
      name: `Estratégia de Teste - Mongoose ${testId}`,
      conditions: [
        { id: '1', type: 'color', operator: 'equals', value: 'black' }
      ]
    });
    
    console.log('Salvando estratégia com Mongoose...');
    console.time('save-mongoose');
    const savedStrategy = await testStrategy.save();
    console.timeEnd('save-mongoose');
    
    console.log(`Estratégia salva com Mongoose! ID: ${savedStrategy._id}`);
    
    // Verificar se foi realmente salva
    console.log('Verificando se a estratégia foi salva...');
    const foundStrategy = await Strategy.findById(savedStrategy._id);
    
    if (foundStrategy) {
      console.log('✅ SUCESSO: Estratégia encontrada no banco com Mongoose!');
      console.log('Dados salvos:', foundStrategy.toObject());
    } else {
      console.log('❌ ERRO: Estratégia não encontrada após inserção com Mongoose!');
    }
    
  } catch (error) {
    console.error('❌ ERRO durante teste com Mongoose:', error);
  } finally {
    console.log('Fechando conexão Mongoose...');
    await mongoose.disconnect();
    console.log('Conexão Mongoose fechada!');
  }
}

// Função para listar todas as estratégias existentes
async function listExistingStrategies() {
  console.log('\n----- LISTANDO ESTRATÉGIAS EXISTENTES -----');
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('strategies');
    
    const count = await collection.countDocuments();
    console.log(`Total de estratégias no banco: ${count}`);
    
    if (count > 0) {
      console.log('\nÚltimas 5 estratégias:');
      const strategies = await collection.find().sort({ createdAt: -1 }).limit(5).toArray();
      strategies.forEach((strategy, index) => {
        console.log(`\n[${index + 1}] ID: ${strategy._id}`);
        console.log(`    Nome: ${strategy.name}`);
        console.log(`    Condições: ${strategy.conditions?.length || 0}`);
        console.log(`    Criado em: ${strategy.createdAt}`);
      });
    }
  } catch (error) {
    console.error('Erro ao listar estratégias:', error);
  } finally {
    await client.close();
  }
}

// Executar todos os testes
async function runAllTests() {
  try {
    console.log('======= INICIANDO TESTES DE MONGODB =======');
    console.log(`URI: ${MONGO_URI}`);
    console.log(`Database: ${DB_NAME}`);
    console.log('===========================================');
    
    // Primeiro, vamos listar o que já existe
    await listExistingStrategies();
    
    // Teste com MongoClient (driver nativo)
    await testWithMongoClient();
    
    // Teste com Mongoose
    await testWithMongoose();
    
    // Listar novamente após os testes
    await listExistingStrategies();
    
    console.log('\n✅ TODOS OS TESTES CONCLUÍDOS!');
    
  } catch (error) {
    console.error('\n❌ ERRO GERAL NOS TESTES:', error);
  }
}

// Executar os testes
runAllTests(); 