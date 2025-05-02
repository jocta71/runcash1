/**
 * Script para criar a estratégia padrão do sistema
 * Esta estratégia contém as regras que estavam embutidas no scraper
 * Executar com: node create-system-strategy.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb');

// URL de conexão do MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/runcash';

// Modelo de Estratégia
const StrategySchema = new mongoose.Schema({
  name: String,
  description: String,
  isPublic: Boolean,
  isSystem: Boolean,
  userId: mongoose.Schema.Types.ObjectId,
  rules: Object,
  terminalsConfig: Object,
  createdAt: Date,
  updatedAt: Date
});

const Strategy = mongoose.model('Strategy', StrategySchema);

// Configuração da estratégia padrão do sistema
const systemStrategy = {
  name: "Estratégia Padrão do Sistema",
  description: "Estratégia original do RunCash que identifica repetições, padrões de paridade e sequências de cores nas roletas.",
  isPublic: true,
  isSystem: true,
  userId: new ObjectId("000000000000000000000001"), // ID especial para o usuário do sistema
  rules: {
    detectarRepeticoes: true,
    verificarParidade: true,
    verificarCores: true,
    analisarDezenas: false,
    analisarColunas: false
  },
  terminalsConfig: {
    useDefaultTerminals: true,
    customTerminals: []
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

async function createSystemStrategy() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB com sucesso');

    // Verificar se já existe uma estratégia do sistema
    const existingStrategy = await Strategy.findOne({ isSystem: true });
    
    if (existingStrategy) {
      console.log('Uma estratégia do sistema já existe:', existingStrategy.name);
      console.log('Atualizando a estratégia existente...');
      
      // Atualizar a estratégia existente
      const updatedStrategy = await Strategy.findByIdAndUpdate(
        existingStrategy._id,
        {
          ...systemStrategy,
          updatedAt: new Date()
        },
        { new: true }
      );
      
      console.log('Estratégia do sistema atualizada com sucesso:', updatedStrategy.name);
    } else {
      // Criar nova estratégia do sistema
      const newStrategy = await Strategy.create(systemStrategy);
      console.log('Estratégia do sistema criada com sucesso:', newStrategy.name);
      console.log('ID da estratégia:', newStrategy._id);
    }

    // Conectar diretamente ao MongoDB para buscar registros da coleção estrategia_historico_novo
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();

    // Buscar todos os registros da coleção estrategia_historico_novo para preservar os dados
    const historicos = await db.collection('estrategia_historico_novo').find({}).toArray();
    console.log(`Encontrados ${historicos.length} registros de histórico de estratégias`);

    // Fechar conexão
    await mongoose.disconnect();
    await client.close();
    
    console.log('Operação concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao criar a estratégia do sistema:', error);
  }
}

// Executar a função
createSystemStrategy(); 