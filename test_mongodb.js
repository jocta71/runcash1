const { MongoClient } = require('mongodb');

// Configuração MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";

async function testarConexao() {
  let client;
  
  try {
    console.log('Conectando ao MongoDB...');
    console.log(`URI: ${MONGODB_URI.replace(/:.*@/, ':****@')}`);
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    console.log('Conexão estabelecida com sucesso!');
    const db = client.db('runcash');
    
    // Listar coleções
    const colecoes = await db.listCollections().toArray();
    const nomeColecoes = colecoes.map(col => col.name);
    console.log('Coleções disponíveis:', nomeColecoes);
    
    // Verificar dados na coleção roleta_numeros
    const collection = db.collection('roleta_numeros');
    const count = await collection.countDocuments();
    console.log(`Total de documentos em roleta_numeros: ${count}`);
    
    if (count > 0) {
      // Mostrar alguns números recentes
      console.log('\nNúmeros mais recentes:');
      const numeros = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();
      
      numeros.forEach(num => {
        console.log(`${num.roleta_nome}: ${num.numero} (${num.cor}) - ${new Date(num.timestamp).toLocaleString()}`);
      });
      
      // Contagem por roleta
      console.log('\nContagem por roleta:');
      const porRoleta = await collection.aggregate([
        { $group: { _id: "$roleta_nome", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      porRoleta.forEach(r => {
        console.log(`${r._id}: ${r.count} números`);
      });
      
      // Verificar últimos números para cada roleta
      console.log('\nÚltimo número por roleta:');
      const ultimosPorRoleta = await collection.aggregate([
        { $sort: { timestamp: -1 } },
        { $group: { _id: "$roleta_nome", numero: { $first: "$numero" }, cor: { $first: "$cor" }, timestamp: { $first: "$timestamp" } } },
        { $sort: { _id: 1 } }
      ]).toArray();
      
      ultimosPorRoleta.forEach(r => {
        console.log(`${r._id}: ${r.numero} (${r.cor}) - ${new Date(r.timestamp).toLocaleString()}`);
      });
    } else {
      console.log('Não foram encontrados documentos na coleção roleta_numeros.');
    }
    
  } catch (erro) {
    console.error('Erro:', erro);
  } finally {
    if (client) {
      await client.close();
      console.log('\nConexão com o MongoDB fechada');
    }
  }
}

// Executar o teste
testarConexao(); 