const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const config = require('../config');

// Função para definir cabeçalhos CORS
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

// Cliente MongoDB
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!config.db.uri) {
    throw new Error('MONGODB_URI não está definido');
  }

  const client = new MongoClient(config.db.uri, config.db.options);
  await client.connect();
  
  const db = client.db();
  
  cachedClient = client;
  cachedDb = db;
  
  return { client, db };
}

// Verificar token JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    return null;
  }
}

// Middleware de autenticação
async function authenticate(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      authenticated: false, 
      status: 401, 
      message: 'Não autorizado. Token não fornecido.' 
    };
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return { 
      authenticated: false, 
      status: 401, 
      message: 'Token inválido ou expirado' 
    };
  }
  
  try {
    const { db } = await connectToDatabase();
    const user = await db.collection(config.db.collections.users).findOne({ 
      _id: new ObjectId(decoded.id) 
    });
    
    if (!user) {
      return { 
        authenticated: false, 
        status: 404, 
        message: 'Usuário não encontrado' 
      };
    }
    
    if (!user.verificado) {
      return { 
        authenticated: false, 
        status: 403, 
        message: 'Conta não verificada' 
      };
    }
    
    return { 
      authenticated: true, 
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return { 
      authenticated: false, 
      status: 500, 
      message: 'Erro ao verificar autenticação' 
    };
  }
}

// Validar dados da transação
function validateTransactionData(data) {
  const errors = {};
  
  if (!data.tipo || !['receita', 'despesa', 'transferencia'].includes(data.tipo)) {
    errors.tipo = 'Tipo de transação inválido. Deve ser receita, despesa ou transferencia';
  }
  
  if (!data.descricao || data.descricao.trim().length < 3) {
    errors.descricao = 'Descrição deve ter pelo menos 3 caracteres';
  }
  
  if (!data.valor || isNaN(parseFloat(data.valor)) || parseFloat(data.valor) <= 0) {
    errors.valor = 'Valor deve ser um número positivo';
  }
  
  if (!data.data) {
    errors.data = 'Data é obrigatória';
  }
  
  if (!data.categoria) {
    errors.categoria = 'Categoria é obrigatória';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// Função para criar uma nova transação
async function createTransaction(data, userId) {
  const { db } = await connectToDatabase();
  
  // Preparar o documento da transação
  const transaction = {
    usuarioId: new ObjectId(userId),
    tipo: data.tipo,
    descricao: data.descricao,
    valor: parseFloat(data.valor),
    data: new Date(data.data),
    categoria: data.categoria,
    status: 'confirmado',
    metodoPagamento: data.metodoPagamento || 'outros',
    notasFiscais: data.notasFiscais || [],
    etiquetas: data.etiquetas || [],
    anexos: data.anexos || [],
    recorrente: data.recorrente || false,
    periodoRecorrencia: data.periodoRecorrencia || null,
    parcelado: data.parcelado || false,
    numeroTotalParcelas: data.numeroTotalParcelas || null,
    numeroParcela: data.numeroParcela || null,
    localizacao: data.localizacao || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  // Adicionar campo específico baseado no tipo
  if (data.tipo === 'transferencia') {
    transaction.contaOrigem = data.contaOrigem;
    transaction.contaDestino = data.contaDestino;
  } else {
    transaction.conta = data.conta;
  }
  
  // Inserir transação no banco de dados
  const result = await db.collection(config.db.collections.transactions).insertOne(transaction);
  
  // Atualizar registro de auditoria
  await db.collection(config.db.collections.auditLogs).insertOne({
    usuarioId: new ObjectId(userId),
    acao: 'criar',
    recurso: 'transacao',
    recursoId: result.insertedId,
    dados: transaction,
    data: new Date(),
    ip: data.ip || 'não registrado',
  });
  
  return {
    id: result.insertedId,
    ...transaction
  };
}

// Função para buscar transações do usuário
async function getTransactions(userId, query = {}) {
  const { db } = await connectToDatabase();
  const filter = { usuarioId: new ObjectId(userId) };
  
  // Adicionar filtros baseados na query
  if (query.tipo) {
    filter.tipo = query.tipo;
  }
  
  if (query.categoria) {
    filter.categoria = query.categoria;
  }
  
  if (query.dataInicio || query.dataFim) {
    filter.data = {};
    
    if (query.dataInicio) {
      filter.data.$gte = new Date(query.dataInicio);
    }
    
    if (query.dataFim) {
      filter.data.$lte = new Date(query.dataFim);
    }
  }
  
  if (query.valorMin || query.valorMax) {
    filter.valor = {};
    
    if (query.valorMin) {
      filter.valor.$gte = parseFloat(query.valorMin);
    }
    
    if (query.valorMax) {
      filter.valor.$lte = parseFloat(query.valorMax);
    }
  }
  
  // Configurar opções de paginação
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;
  
  // Configurar ordenação
  const sort = {};
  const sortField = query.sortBy || 'data';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  sort[sortField] = sortOrder;
  
  // Buscar transações
  const transactions = await db.collection(config.db.collections.transactions)
    .find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();
  
  // Contar total de transações para paginação
  const total = await db.collection(config.db.collections.transactions)
    .countDocuments(filter);
  
  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// Função principal para lidar com as requisições
module.exports = async (req, res) => {
  // Verificar método OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }
  
  setCorsHeaders(res);
  
  // Extrair a rota da URL da requisição
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname.replace('/api/transactions', '').replace(/^\/+|\/+$/g, '') || 'default';
  const transactionId = route.match(/^([0-9a-fA-F]{24})/) ? route.match(/^([0-9a-fA-F]{24})/)[0] : null;
  
  try {
    // Autenticar usuário para todas as rotas exceto OPTIONS
    const auth = await authenticate(req);
    
    if (!auth.authenticated) {
      return res.status(auth.status).json({ 
        success: false, 
        message: auth.message 
      });
    }
    
    const { db } = await connectToDatabase();
    
    // Roteamento com base no endpoint e método
    switch (true) {
      // Listar transações
      case (route === '' || route === 'default') && req.method === 'GET': {
        // Extrair parâmetros de consulta da URL
        const query = {};
        url.searchParams.forEach((value, key) => {
          query[key] = value;
        });
        
        // Buscar transações com filtros
        const result = await getTransactions(auth.user.id, query);
        
        return res.status(200).json({
          success: true,
          transactions: result.transactions,
          pagination: result.pagination
        });
      }
      
      // Criar nova transação
      case (route === '' || route === 'default') && req.method === 'POST': {
        const transactionData = req.body;
        
        // Validar dados da transação
        const validation = validateTransactionData(transactionData);
        
        if (!validation.isValid) {
          return res.status(400).json({ 
            success: false, 
            errors: validation.errors 
          });
        }
        
        // Criar transação
        const newTransaction = await createTransaction(transactionData, auth.user.id);
        
        return res.status(201).json({
          success: true,
          message: 'Transação criada com sucesso',
          transaction: newTransaction
        });
      }
      
      // Obter transação por ID
      case transactionId && req.method === 'GET': {
        // Buscar transação específica
        const transaction = await db.collection(config.db.collections.transactions).findOne({
          _id: new ObjectId(transactionId),
          usuarioId: new ObjectId(auth.user.id)
        });
        
        if (!transaction) {
          return res.status(404).json({ 
            success: false, 
            message: 'Transação não encontrada' 
          });
        }
        
        return res.status(200).json({
          success: true,
          transaction
        });
      }
      
      // Atualizar transação
      case transactionId && req.method === 'PUT': {
        const transactionData = req.body;
        
        // Verificar se a transação existe e pertence ao usuário
        const existingTransaction = await db.collection(config.db.collections.transactions).findOne({
          _id: new ObjectId(transactionId),
          usuarioId: new ObjectId(auth.user.id)
        });
        
        if (!existingTransaction) {
          return res.status(404).json({ 
            success: false, 
            message: 'Transação não encontrada' 
          });
        }
        
        // Validar dados da transação
        if (transactionData.tipo || transactionData.valor || transactionData.descricao || transactionData.data) {
          const dataToValidate = {
            ...existingTransaction,
            ...transactionData
          };
          
          const validation = validateTransactionData(dataToValidate);
          
          if (!validation.isValid) {
            return res.status(400).json({ 
              success: false, 
              errors: validation.errors 
            });
          }
        }
        
        // Preparar dados para atualização
        const updateData = {};
        const fieldsToUpdate = [
          'tipo', 'descricao', 'valor', 'data', 'categoria', 'status',
          'metodoPagamento', 'etiquetas', 'recorrente', 'periodoRecorrencia',
          'parcelado', 'numeroTotalParcelas', 'numeroParcela', 'localizacao', 'conta'
        ];
        
        // Adicionar campos específicos baseados no tipo
        if (transactionData.tipo === 'transferencia' || existingTransaction.tipo === 'transferencia') {
          fieldsToUpdate.push('contaOrigem', 'contaDestino');
        } else {
          fieldsToUpdate.push('conta');
        }
        
        // Filtrar campos válidos
        fieldsToUpdate.forEach(field => {
          if (transactionData[field] !== undefined) {
            if (field === 'valor' && !isNaN(parseFloat(transactionData[field]))) {
              updateData[field] = parseFloat(transactionData[field]);
            } else if (field === 'data' && transactionData[field]) {
              updateData[field] = new Date(transactionData[field]);
            } else {
              updateData[field] = transactionData[field];
            }
          }
        });
        
        // Adicionar data de atualização
        updateData.updatedAt = new Date();
        
        // Verificar se há dados para atualizar
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Nenhum dado válido fornecido para atualização' 
          });
        }
        
        // Salvar dados originais para auditoria
        const originalData = { ...existingTransaction };
        
        // Atualizar transação
        await db.collection(config.db.collections.transactions).updateOne(
          { _id: new ObjectId(transactionId) },
          { $set: updateData }
        );
        
        // Registrar auditoria
        await db.collection(config.db.collections.auditLogs).insertOne({
          usuarioId: new ObjectId(auth.user.id),
          acao: 'atualizar',
          recurso: 'transacao',
          recursoId: new ObjectId(transactionId),
          dadosAnteriores: originalData,
          dadosNovos: updateData,
          data: new Date(),
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        });
        
        return res.status(200).json({
          success: true,
          message: 'Transação atualizada com sucesso',
          transaction: {
            _id: transactionId,
            ...existingTransaction,
            ...updateData
          }
        });
      }
      
      // Excluir transação
      case transactionId && req.method === 'DELETE': {
        // Verificar se a transação existe e pertence ao usuário
        const existingTransaction = await db.collection(config.db.collections.transactions).findOne({
          _id: new ObjectId(transactionId),
          usuarioId: new ObjectId(auth.user.id)
        });
        
        if (!existingTransaction) {
          return res.status(404).json({ 
            success: false, 
            message: 'Transação não encontrada' 
          });
        }
        
        // Excluir transação
        await db.collection(config.db.collections.transactions).deleteOne({
          _id: new ObjectId(transactionId)
        });
        
        // Registrar auditoria
        await db.collection(config.db.collections.auditLogs).insertOne({
          usuarioId: new ObjectId(auth.user.id),
          acao: 'excluir',
          recurso: 'transacao',
          recursoId: new ObjectId(transactionId),
          dados: existingTransaction,
          data: new Date(),
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        });
        
        return res.status(200).json({
          success: true,
          message: 'Transação excluída com sucesso'
        });
      }
      
      // Obter resumo/estatísticas das transações
      case route === 'resumo' && req.method === 'GET': {
        // Extrair parâmetros de consulta
        const dataInicio = url.searchParams.get('dataInicio') 
          ? new Date(url.searchParams.get('dataInicio')) 
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1); // Início do mês atual
        
        const dataFim = url.searchParams.get('dataFim') 
          ? new Date(url.searchParams.get('dataFim')) 
          : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0); // Fim do mês atual
        
        // Filtro base para todas as consultas
        const baseFilter = {
          usuarioId: new ObjectId(auth.user.id),
          data: {
            $gte: dataInicio,
            $lte: dataFim
          }
        };
        
        // Calcular total de receitas
        const totalReceitas = await db.collection(config.db.collections.transactions).aggregate([
          {
            $match: {
              ...baseFilter,
              tipo: 'receita'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$valor' }
            }
          }
        ]).toArray();
        
        // Calcular total de despesas
        const totalDespesas = await db.collection(config.db.collections.transactions).aggregate([
          {
            $match: {
              ...baseFilter,
              tipo: 'despesa'
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$valor' }
            }
          }
        ]).toArray();
        
        // Agrupar por categoria
        const categorias = await db.collection(config.db.collections.transactions).aggregate([
          {
            $match: baseFilter
          },
          {
            $group: {
              _id: { 
                tipo: '$tipo',
                categoria: '$categoria'
              },
              total: { $sum: '$valor' }
            }
          },
          {
            $sort: { '_id.tipo': 1, 'total': -1 }
          }
        ]).toArray();
        
        // Agrupar por dia
        const porDia = await db.collection(config.db.collections.transactions).aggregate([
          {
            $match: baseFilter
          },
          {
            $project: {
              tipo: 1,
              valor: 1,
              dia: { 
                $dateToString: { 
                  format: '%Y-%m-%d', 
                  date: '$data' 
                } 
              }
            }
          },
          {
            $group: {
              _id: { 
                dia: '$dia',
                tipo: '$tipo'
              },
              total: { $sum: '$valor' }
            }
          },
          {
            $sort: { '_id.dia': 1 }
          }
        ]).toArray();
        
        // Formatar os resultados
        const resumoCategorias = categorias.map(item => ({
          tipo: item._id.tipo,
          categoria: item._id.categoria,
          total: item.total
        }));
        
        const resumoPorDia = porDia.map(item => ({
          data: item._id.dia,
          tipo: item._id.tipo,
          total: item.total
        }));
        
        return res.status(200).json({
          success: true,
          resumo: {
            periodo: {
              dataInicio: dataInicio,
              dataFim: dataFim
            },
            totalReceitas: totalReceitas.length > 0 ? totalReceitas[0].total : 0,
            totalDespesas: totalDespesas.length > 0 ? totalDespesas[0].total : 0,
            saldo: (totalReceitas.length > 0 ? totalReceitas[0].total : 0) - 
                   (totalDespesas.length > 0 ? totalDespesas[0].total : 0),
            categorias: resumoCategorias,
            porDia: resumoPorDia
          }
        });
      }
      
      // Rota não encontrada
      default:
        return res.status(404).json({ 
          success: false, 
          message: 'Rota não encontrada' 
        });
    }
  } catch (error) {
    console.error('Erro no serviço de transações:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: config.app.environment === 'development' ? error.message : undefined,
    });
  }
}; 