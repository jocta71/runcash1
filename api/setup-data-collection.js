// Script para criar uma coleção de exemplo e adicionar dados de números para roletas
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB || 'roletas_db';
const client = new MongoClient(uri);

// ID da roleta para criar e adicionar dados
const ROLETA_ID = '2010011'; // Deutsches Roulette
const TOTAL_NUMEROS = 100;   // Quantidade de números a serem gerados

// Cores da roleta
const CORES = {
  0: "verde",
  32: "vermelho", 15: "vermelho", 19: "vermelho", 7: "vermelho", 
  26: "vermelho", 14: "vermelho", 22: "vermelho", 31: "vermelho", 
  5: "vermelho", 17: "vermelho", 29: "vermelho", 36: "vermelho", 
  12: "vermelho", 24: "vermelho", 1: "vermelho", 3: "vermelho", 
  9: "vermelho", 18: "vermelho", 21: "vermelho", 23: "vermelho", 
  25: "vermelho", 27: "vermelho", 30: "vermelho", 34: "vermelho",
  2: "preto", 4: "preto", 6: "preto", 8: "preto", 10: "preto", 
  11: "preto", 13: "preto", 16: "preto", 20: "preto", 28: "preto", 
  33: "preto", 35: "preto", 8: "preto", 10: "preto", 11: "preto", 
  13: "preto", 17: "preto", 20: "preto", 22: "preto", 24: "preto", 
  26: "preto", 28: "preto", 29: "preto", 31: "preto", 33: "preto", 35: "preto"
};

// Gera um número aleatório da roleta (0-36)
function gerarNumeroAleatorio() {
  return Math.floor(Math.random() * 37);
}

// Gera um timestamp aleatório nas últimas 24 horas
function gerarTimestampAleatorio() {
  const agora = new Date();
  const horasAleatorias = Math.floor(Math.random() * 24);
  const minutosAleatorios = Math.floor(Math.random() * 60);
  const segundosAleatorios = Math.floor(Math.random() * 60);
  
  agora.setHours(agora.getHours() - horasAleatorias);
  agora.setMinutes(minutosAleatorios);
  agora.setSeconds(segundosAleatorios);
  
  return agora;
}

async function main() {
  try {
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso!');
    
    const db = client.db(dbName);
    
    // Verifica se a coleção já existe
    const collections = await db.listCollections({ name: ROLETA_ID }).toArray();
    if (collections.length > 0) {
      console.log(`A coleção ${ROLETA_ID} já existe. Excluindo...`);
      await db.collection(ROLETA_ID).drop();
    }
    
    // Criar a coleção para a roleta
    await db.createCollection(ROLETA_ID);
    console.log(`Coleção ${ROLETA_ID} criada com sucesso!`);
    
    // Gerar documentos com números aleatórios
    const numerosDocs = [];
    for (let i = 0; i < TOTAL_NUMEROS; i++) {
      const numero = gerarNumeroAleatorio();
      const timestamp = gerarTimestampAleatorio();
      
      numerosDocs.push({
        numero: numero,
        cor: CORES[numero] || "indefinido", // Obtém a cor com base no número
        timestamp: timestamp,
        criado_em: timestamp
      });
    }
    
    // Inserir os documentos na coleção
    const resultado = await db.collection(ROLETA_ID).insertMany(numerosDocs);
    console.log(`${resultado.insertedCount} números inseridos na coleção ${ROLETA_ID}!`);
    
    // Criar um índice por timestamp para consultas mais rápidas
    await db.collection(ROLETA_ID).createIndex({ timestamp: -1 });
    console.log(`Índice criado por timestamp na coleção ${ROLETA_ID}`);
    
    // Verificar os primeiros documentos inseridos
    const amostra = await db.collection(ROLETA_ID).find().sort({ timestamp: -1 }).limit(5).toArray();
    console.log('Amostra dos últimos 5 números inseridos:');
    amostra.forEach(doc => {
      console.log(`Número: ${doc.numero}, Cor: ${doc.cor}, Timestamp: ${doc.timestamp}`);
    });
    
  } catch (error) {
    console.error('Erro ao configurar a coleção:', error);
  } finally {
    await client.close();
    console.log('Conexão fechada');
  }
}

main(); 