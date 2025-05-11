/**
 * Controlador para a API Unificada de Roletas
 * Implementa os endpoints que retornam dados de todas as roletas em diferentes formatos
 */

const { encryptRouletteData } = require('./utils/crypto');
const { setupSSEHeaders } = require('./utils/stream');

/**
 * Retorna todas as roletas com seus números
 */
const getAllRoulettes = async (req, res) => {
  try {
    // Obter a instância do banco de dados do contexto da aplicação
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(500).json({
        error: 'Erro de banco de dados',
        message: 'Conexão com banco de dados indisponível'
      });
    }
    
    // Obter o limite de números da query ou usar padrão
    const numbersLimit = req.query.limit ? parseInt(req.query.limit) : 20;
    
    // Buscar todas as roletas
    const roletas = await db.collection('roletas').find({}).toArray();
    
    if (roletas.length === 0) {
      return res.json([]);
    }
    
    // Para cada roleta, buscar seus números
    const roletasComNumeros = await Promise.all(roletas.map(async (roleta) => {
      const nome = roleta.nome || 'Roleta sem nome';
      
      // Buscar números para esta roleta
      const numeros = await db.collection('roleta_numeros')
        .find({ roleta_nome: { $regex: new RegExp(nome, 'i') } })
        .sort({ timestamp: -1 })
        .limit(numbersLimit)
        .toArray();
      
      // Formatar números
      const formattedNumbers = numeros.map(n => ({
        numero: n.numero || n.number || n.value || 0,
        roleta_id: n.roleta_id || roleta._id.toString(),
        roleta_nome: n.roleta_nome || nome,
        cor: n.cor || determinarCorNumero(n.numero || n.number || n.value || 0),
        timestamp: n.timestamp || n.created_at || new Date().toISOString()
      }));
      
      // Retornar objeto formatado da roleta
      return {
        id: roleta._id.toString(),
        nome: nome,
        ativa: roleta.ativa || true,
        numero: formattedNumbers,
        estado_estrategia: roleta.estado_estrategia || "NEUTRAL",
        vitorias: roleta.vitorias || 0,
        derrotas: roleta.derrotas || 0,
        win_rate: calcularWinRate(roleta.vitorias || 0, roleta.derrotas || 0),
        updated_at: roleta.updated_at || (formattedNumbers.length > 0 ? formattedNumbers[0].timestamp : new Date().toISOString())
      };
    }));
    
    // Se a chave de cliente indicar que os dados devem ser criptografados
    if (req.dadosCriptografados) {
      // Criptografar cada roleta
      const roletasCriptografadas = await Promise.all(roletasComNumeros.map(async (roleta) => {
        const roletaClone = { ...roleta };
        
        // Criptografar cada número individualmente
        roletaClone.numero = await Promise.all(roleta.numero.map(async (num) => {
          return await encryptRouletteData(num);
        }));
        
        return roletaClone;
      }));
      
      return res.json(roletasCriptografadas);
    }
    
    // Caso contrário, retornar dados não criptografados
    return res.json(roletasComNumeros);
  } catch (error) {
    console.error('Erro ao buscar todas as roletas:', error);
    return res.status(500).json({
      error: 'Erro de servidor',
      message: 'Falha ao buscar dados das roletas'
    });
  }
};

/**
 * Retorna dados em formato compacto, apenas com os dados essenciais e último número
 */
const getCompactRoulettes = async (req, res) => {
  try {
    // Obter a instância do banco de dados do contexto da aplicação
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(500).json({
        error: 'Erro de banco de dados',
        message: 'Conexão com banco de dados indisponível'
      });
    }
    
    // Buscar todas as roletas
    const roletas = await db.collection('roletas').find({}).toArray();
    
    if (roletas.length === 0) {
      return res.json([]);
    }
    
    // Para cada roleta, buscar apenas seu último número
    const roletasCompactas = await Promise.all(roletas.map(async (roleta) => {
      const nome = roleta.nome || 'Roleta sem nome';
      
      // Buscar o último número para esta roleta
      const ultimoNumero = await db.collection('roleta_numeros')
        .find({ roleta_nome: { $regex: new RegExp(nome, 'i') } })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();
      
      const formattedNumber = ultimoNumero.length > 0 ? {
        numero: ultimoNumero[0].numero || ultimoNumero[0].number || ultimoNumero[0].value || 0,
        roleta_id: ultimoNumero[0].roleta_id || roleta._id.toString(),
        roleta_nome: ultimoNumero[0].roleta_nome || nome,
        cor: ultimoNumero[0].cor || determinarCorNumero(ultimoNumero[0].numero || ultimoNumero[0].number || ultimoNumero[0].value || 0),
        timestamp: ultimoNumero[0].timestamp || ultimoNumero[0].created_at || new Date().toISOString()
      } : null;
      
      // Se a chave de cliente indicar que os dados devem ser criptografados
      let dadoUltimoNumero = formattedNumber;
      if (req.dadosCriptografados && formattedNumber) {
        dadoUltimoNumero = await encryptRouletteData(formattedNumber);
      }
      
      // Retornar objeto compacto da roleta
      return {
        id: roleta._id.toString(),
        nome: nome,
        ativa: roleta.ativa || true,
        ultimo_numero: dadoUltimoNumero,
        total_numeros: await db.collection('roleta_numeros').countDocuments({ roleta_nome: { $regex: new RegExp(nome, 'i') } }),
        updated_at: roleta.updated_at || (formattedNumber ? formattedNumber.timestamp : new Date().toISOString())
      };
    }));
    
    return res.json(roletasCompactas);
  } catch (error) {
    console.error('Erro ao buscar roletas em formato compacto:', error);
    return res.status(500).json({
      error: 'Erro de servidor',
      message: 'Falha ao buscar dados compactos das roletas'
    });
  }
};

/**
 * Retorna um formato consolidado dos dados das roletas
 * Todos os números em uma lista única, ordenados por timestamp
 */
const getConsolidatedRoulettes = async (req, res) => {
  try {
    // Obter a instância do banco de dados do contexto da aplicação
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(500).json({
        error: 'Erro de banco de dados',
        message: 'Conexão com banco de dados indisponível'
      });
    }
    
    // Buscar todas as roletas para informações básicas
    const roletas = await db.collection('roletas').find({}).toArray();
    
    if (roletas.length === 0) {
      return res.json({
        roletas: [],
        numeros: [],
        total_numeros: 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Informações básicas das roletas
    const roletasInfo = roletas.map(roleta => ({
      id: roleta._id.toString(),
      nome: roleta.nome || 'Roleta sem nome',
      ativa: roleta.ativa || true
    }));
    
    // Buscar todos os números (limitados a 100 para performance)
    const numeros = await db.collection('roleta_numeros')
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    // Formatar números
    const formattedNumbers = numeros.map(n => ({
      numero: n.numero || n.number || n.value || 0,
      roleta_id: n.roleta_id,
      roleta_nome: n.roleta_nome,
      cor: n.cor || determinarCorNumero(n.numero || n.number || n.value || 0),
      timestamp: n.timestamp || n.created_at || new Date().toISOString()
    }));
    
    // Se a chave de cliente indicar que os dados devem ser criptografados
    let dadosNumeros = formattedNumbers;
    if (req.dadosCriptografados) {
      dadosNumeros = await Promise.all(formattedNumbers.map(async (num) => {
        return await encryptRouletteData(num);
      }));
    }
    
    // Estrutura da resposta consolidada
    const resposta = {
      roletas: roletasInfo,
      numeros: dadosNumeros,
      total_numeros: await db.collection('roleta_numeros').countDocuments({}),
      timestamp: new Date().toISOString()
    };
    
    return res.json(resposta);
  } catch (error) {
    console.error('Erro ao buscar roletas em formato consolidado:', error);
    return res.status(500).json({
      error: 'Erro de servidor',
      message: 'Falha ao buscar dados consolidados das roletas'
    });
  }
};

/**
 * Retorna todas as roletas em formato de eventos SSE
 */
const getRouletteEvents = async (req, res) => {
  try {
    // Obter a instância do banco de dados do contexto da aplicação
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(500).json({
        error: 'Erro de banco de dados',
        message: 'Conexão com banco de dados indisponível'
      });
    }
    
    // Definir cabeçalhos para resposta de texto plano
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Buscar todas as roletas
    const roletas = await db.collection('roletas').find({}).toArray();
    
    if (roletas.length === 0) {
      return res.send('event: update\nid: 0\ndata: []\n\n');
    }
    
    // Para cada roleta, criar um evento com seus dados
    let eventData = '';
    
    await Promise.all(roletas.map(async (roleta, index) => {
      const nome = roleta.nome || 'Roleta sem nome';
      
      // Buscar o último número para esta roleta
      const ultimoNumero = await db.collection('roleta_numeros')
        .find({ roleta_nome: { $regex: new RegExp(nome, 'i') } })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();
      
      // Dados da roleta para o evento
      const roletaData = {
        id: roleta._id.toString(),
        nome: nome,
        ativa: roleta.ativa || true,
        ultimo_numero: ultimoNumero.length > 0 ? {
          numero: ultimoNumero[0].numero || ultimoNumero[0].number || ultimoNumero[0].value || 0,
          roleta_id: ultimoNumero[0].roleta_id || roleta._id.toString(),
          roleta_nome: ultimoNumero[0].roleta_nome || nome,
          cor: ultimoNumero[0].cor || determinarCorNumero(ultimoNumero[0].numero || ultimoNumero[0].number || ultimoNumero[0].value || 0),
          timestamp: ultimoNumero[0].timestamp || ultimoNumero[0].created_at || new Date().toISOString()
        } : null,
        updated_at: roleta.updated_at || (ultimoNumero.length > 0 ? ultimoNumero[0].timestamp : new Date().toISOString()),
        timestamp: new Date().toISOString()
      };
      
      // Criptografar dados
      const tokenData = await encryptRouletteData(roletaData);
      
      // Adicionar evento para esta roleta
      eventData += `event: update\n`;
      eventData += `id: ${index + 1}\n`;
      eventData += `data: ${tokenData}\n\n`;
    }));
    
    // Enviar todos os eventos de uma vez
    return res.send(eventData);
  } catch (error) {
    console.error('Erro ao buscar eventos das roletas:', error);
    
    // Se os cabeçalhos ainda não foram enviados, retorna erro
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Erro de servidor',
        message: 'Falha ao gerar eventos das roletas'
      });
    }
    
    // Tenta enviar alguma resposta mesmo em caso de erro
    try {
      res.send('event: error\nid: 0\ndata: {"error": "Erro ao processar dados"}\n\n');
    } catch (e) {
      console.error('Erro ao enviar resposta de erro:', e);
    }
  }
};

/**
 * Retorna todas as roletas em único evento no formato SSE com dados completos
 */
const getAllInOneEvent = async (req, res) => {
  try {
    // Obter a instância do banco de dados do contexto da aplicação
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(500).json({
        error: 'Erro de banco de dados',
        message: 'Conexão com banco de dados indisponível'
      });
    }
    
    // Definir cabeçalhos para resposta de texto plano
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Obter parâmetros de limite (opcional)
    const maxRoletas = req.query.max_roletas ? parseInt(req.query.max_roletas) : undefined;
    const maxNumeros = req.query.max_numeros ? parseInt(req.query.max_numeros) : 20; // Padrão: 20 números por roleta
    
    // Buscar roletas com limitação se especificada
    let query = db.collection('roletas').find({});
    if (maxRoletas && !isNaN(maxRoletas) && maxRoletas > 0) {
      query = query.limit(maxRoletas);
    }
    const roletas = await query.toArray();
    
    if (roletas.length === 0) {
      return res.send('event: update\nid: 1\ndata: {"timestamp":"' + new Date().toISOString() + '","roletas":[],"total_roletas":0}\n\n');
    }
    
    // Para cada roleta, buscar seus números com limite
    const roletasComNumeros = await Promise.all(roletas.map(async (roleta) => {
      const nome = roleta.nome || 'Roleta sem nome';
      
      // Buscar números para esta roleta com limite
      const numeros = await db.collection('roleta_numeros')
        .find({ roleta_nome: { $regex: new RegExp(nome, 'i') } })
        .sort({ timestamp: -1 })
        .limit(maxNumeros || 20)
        .toArray();
      
      // Total real de números desta roleta (sem limitação)
      const totalNumeros = await db.collection('roleta_numeros')
        .countDocuments({ roleta_nome: { $regex: new RegExp(nome, 'i') } });
      
      // Formatar números
      const formattedNumbers = numeros.map(n => ({
        numero: n.numero || n.number || n.value || 0,
        roleta_id: n.roleta_id || roleta._id.toString(),
        roleta_nome: n.roleta_nome || nome,
        cor: n.cor || determinarCorNumero(n.numero || n.number || n.value || 0),
        timestamp: n.timestamp || n.created_at || new Date().toISOString()
      }));
      
      // Retornar objeto formatado da roleta
      return {
        id: roleta._id.toString(),
        nome: nome,
        ativa: roleta.ativa || true,
        numeros: formattedNumbers,
        total_numeros: totalNumeros,
        updated_at: roleta.updated_at || (formattedNumbers.length > 0 ? formattedNumbers[0].timestamp : new Date().toISOString())
      };
    }));
    
    // Total real de roletas (sem limitação)
    const totalRoletas = await db.collection('roletas').countDocuments({});
    
    // Objeto completo com todos os dados
    const allData = {
      timestamp: new Date().toISOString(),
      roletas: roletasComNumeros,
      total_roletas: totalRoletas,
      limites_aplicados: {
        max_roletas: maxRoletas,
        max_numeros: maxNumeros
      }
    };
    
    // Criptografar o objeto completo
    const tokenData = await encryptRouletteData(allData);
    
    // Criar o evento único
    const eventData = `event: update\nid: 1\ndata: ${tokenData}\n\n`;
    
    // Enviar o evento
    return res.send(eventData);
  } catch (error) {
    console.error('Erro ao gerar evento all-in-one das roletas:', error);
    
    // Se os cabeçalhos ainda não foram enviados, retorna erro
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Erro de servidor',
        message: 'Falha ao gerar evento unificado das roletas'
      });
    }
    
    // Tenta enviar alguma resposta mesmo em caso de erro
    try {
      res.send('event: error\nid: 1\ndata: {"error": "Erro ao processar dados"}\n\n');
    } catch (e) {
      console.error('Erro ao enviar resposta de erro:', e);
    }
  }
};

/**
 * Funções auxiliares
 */

// Determinar a cor de um número da roleta
function determinarCorNumero(numero) {
  if (numero === 0) return 'verde';
  if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero)) {
    return 'vermelho';
  }
  return 'preto';
}

// Calcular a taxa de vitória
function calcularWinRate(vitorias, derrotas) {
  const total = vitorias + derrotas;
  if (total === 0) return 'N/A';
  return `${((vitorias / total) * 100).toFixed(1)}%`;
}

// Exportar controladores
module.exports = {
  getAllRoulettes,
  getCompactRoulettes,
  getConsolidatedRoulettes,
  getRouletteEvents,
  getAllInOneEvent
}; 