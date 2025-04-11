const { MongoClient } = require('mongodb');

// Configuração MongoDB
const MONGODB_URI = 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';

// Definição das roletas
const ROLETAS = [
  { id: '2010016', nome: 'Immersive Roulette' },
  { id: '2010017', nome: 'Auto-Roulette' },
  { id: '2010096', nome: 'Speed Auto Roulette' },
  { id: '2010065', nome: 'Bucharest Auto-Roulette' },
  { id: '2380335', nome: 'Brazilian Mega Roulette' },
  { id: '2010098', nome: 'Auto-Roulette VIP' }
];

// Função para determinar a cor do número da roleta
function determinarCorNumero(numero) {
  if (numero === 0) return 'verde';
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
}

// Função para gerar números aleatórios para uma roleta
function gerarNumerosRoleta(roletaId, roletaNome, quantidade = 20) {
  const numeros = [];
  for (let i = 0; i < quantidade; i++) {
    const numero = Math.floor(Math.random() * 37); // 0-36
    const timestamp = new Date(Date.now() - i * 120000); // Cada número com 2 minutos de diferença
    
    numeros.push({
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      numero: numero,
      cor: determinarCorNumero(numero),
      timestamp: timestamp
    });
  }
  return numeros;
}

async function criarColecoes() {
  let client;
  
  try {
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    console.log('Conexão estabelecida com sucesso!');
    const db = client.db();
    
    // Verificar se as coleções existem
    const colecoes = await db.listCollections().toArray();
    const colecaoNomes = colecoes.map(col => col.name);
    
    console.log('Coleções existentes:', colecaoNomes);
    
    // Criar coleção roletas se não existir
    if (!colecaoNomes.includes('roletas')) {
      console.log('Criando coleção roletas...');
      await db.createCollection('roletas');
      console.log('Coleção roletas criada!');
    }
    
    // Criar coleção roleta_numeros se não existir
    if (!colecaoNomes.includes('roleta_numeros')) {
      console.log('Criando coleção roleta_numeros...');
      await db.createCollection('roleta_numeros');
      console.log('Coleção roleta_numeros criada!');
    }
    
    // Inserir dados nas coleções
    const roletasCollection = db.collection('roletas');
    const numerosCollection = db.collection('roleta_numeros');
    
    // Limpar dados existentes
    console.log('Limpando dados existentes...');
    await roletasCollection.deleteMany({});
    await numerosCollection.deleteMany({});
    
    // Inserir roletas
    console.log('Inserindo roletas...');
    await roletasCollection.insertMany(ROLETAS);
    
    // Inserir números para cada roleta
    console.log('Inserindo números para cada roleta...');
    for (const roleta of ROLETAS) {
      const numeros = gerarNumerosRoleta(roleta.id, roleta.nome, 50);
      await numerosCollection.insertMany(numeros);
      console.log(`Inseridos ${numeros.length} números para ${roleta.nome}`);
    }
    
    console.log('Operação concluída com sucesso!');
    
  } catch (erro) {
    console.error('Erro:', erro);
  } finally {
    if (client) {
      await client.close();
      console.log('Conexão com o MongoDB fechada');
    }
  }
}

// Executar a função principal
criarColecoes(); 