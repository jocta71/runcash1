/**
 * Endpoint unificado para operações de produtos
 * Combina várias funções em uma única para economizar funções serverless
 * 
 * Operações suportadas:
 * - list: Listar todos os produtos
 * - create: Criar um novo produto
 * - get: Obter um produto específico
 * - update: Atualizar um produto
 * - delete: Excluir um produto
 * - search: Pesquisar produtos
 */

// Importações
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'runcashh';
const JWT_SECRET = process.env.JWT_SECRET || 'seu_jwt_secret';

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Obter o tipo de operação da query ou body
  const operation = req.query.operation || (req.body && req.body.operation);
  
  if (!operation) {
    return res.status(400).json({
      success: false,
      error: 'Operação não especificada. Inclua o parâmetro "operation" na query ou body.'
    });
  }

  // Executar a operação correspondente
  try {
    switch (operation) {
      case 'list':
        return await listProducts(req, res);
      
      case 'create':
        return await createProduct(req, res);
      
      case 'get':
        return await getProduct(req, res);
      
      case 'update':
        return await updateProduct(req, res);
      
      case 'delete':
        return await deleteProduct(req, res);
      
      case 'search':
        return await searchProducts(req, res);
      
      default:
        return res.status(400).json({
          success: false,
          error: `Operação "${operation}" não suportada.`
        });
    }
  } catch (error) {
    console.error(`Erro na operação ${operation}:`, error);
    
    return res.status(500).json({
      success: false,
      error: `Erro ao executar operação "${operation}"`,
      message: error.message
    });
  }
};

/**
 * Conectar ao banco de dados MongoDB
 */
async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI não definido');
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  
  return {
    client,
    db: client.db(DB_NAME)
  };
}

/**
 * Verificar token de autenticação e retornar o usuário decodificado
 */
async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('Token não fornecido');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Token inválido ou expirado');
  }
}

/**
 * Verificar se o usuário tem permissão de administrador
 */
async function verifyAdmin(req) {
  const user = await verifyAuthToken(req);
  
  if (user.role !== 'admin') {
    throw new Error('Permissão negada. Acesso restrito a administradores.');
  }
  
  return user;
}

/**
 * Listar todos os produtos
 */
async function listProducts(req, res) {
  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Obter parâmetros de paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Obter categoria e status (opcional)
    const category = req.query.category;
    const status = req.query.status;
    
    // Construir filtro
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    
    // Buscar produtos com paginação
    const productsCollection = db.collection('products');
    
    const products = await productsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Contar total de produtos para paginação
    const total = await productsCollection.countDocuments(filter);
    
    // Calcular total de páginas
    const totalPages = Math.ceil(total / limit);
    
    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao listar produtos',
      message: error.message
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Criar um novo produto
 */
async function createProduct(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST para criar produto.'
    });
  }

  // Verificar permissões de administrador
  try {
    await verifyAdmin(req);
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: error.message
    });
  }

  const { name, description, price, category, imageUrl, status, stock } = req.body;

  // Validar campos obrigatórios
  if (!name || !price) {
    return res.status(400).json({
      success: false,
      error: 'Nome e preço são obrigatórios'
    });
  }

  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Preparar objeto do produto
    const newProduct = {
      name,
      description: description || '',
      price: Number(price),
      category: category || 'outros',
      imageUrl: imageUrl || '',
      status: status || 'ativo',
      stock: stock !== undefined ? Number(stock) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Inserir produto
    const productsCollection = db.collection('products');
    const result = await productsCollection.insertOne(newProduct);
    
    // Retornar produto criado
    return res.status(201).json({
      success: true,
      data: {
        id: result.insertedId,
        ...newProduct
      }
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao criar produto',
      message: error.message
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Obter um produto específico
 */
async function getProduct(req, res) {
  const productId = req.query.id;
  
  // Validar ID do produto
  if (!productId) {
    return res.status(400).json({
      success: false,
      error: 'ID do produto é obrigatório'
    });
  }

  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Buscar produto pelo ID
    const productsCollection = db.collection('products');
    
    let objectId;
    try {
      objectId = new ObjectId(productId);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'ID do produto inválido'
      });
    }
    
    const product = await productsCollection.findOne({ _id: objectId });
    
    // Verificar se o produto existe
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }
    
    // Retornar produto
    return res.status(200).json({
      success: true,
      data: {
        id: product._id,
        ...product
      }
    });
  } catch (error) {
    console.error('Erro ao obter produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao obter produto',
      message: error.message
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Atualizar um produto
 */
async function updateProduct(req, res) {
  // Verificar método HTTP
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST ou PUT para atualizar produto.'
    });
  }

  // Verificar permissões de administrador
  try {
    await verifyAdmin(req);
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: error.message
    });
  }

  const productId = req.query.id || req.body.id;
  
  // Validar ID do produto
  if (!productId) {
    return res.status(400).json({
      success: false,
      error: 'ID do produto é obrigatório'
    });
  }

  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Buscar produto pelo ID para verificar se existe
    const productsCollection = db.collection('products');
    
    let objectId;
    try {
      objectId = new ObjectId(productId);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'ID do produto inválido'
      });
    }
    
    const existingProduct = await productsCollection.findOne({ _id: objectId });
    
    // Verificar se o produto existe
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }
    
    // Preparar dados de atualização
    const updateData = { ...req.body };
    
    // Remover campos que não devem ser atualizados
    delete updateData.id;
    delete updateData._id;
    delete updateData.operation;
    delete updateData.createdAt;
    
    // Converter price e stock para número se fornecidos
    if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
    }
    
    if (updateData.stock !== undefined) {
      updateData.stock = Number(updateData.stock);
    }
    
    // Adicionar data de atualização
    updateData.updatedAt = new Date();
    
    // Atualizar produto
    const result = await productsCollection.updateOne(
      { _id: objectId },
      { $set: updateData }
    );
    
    // Obter produto atualizado
    const updatedProduct = await productsCollection.findOne({ _id: objectId });
    
    // Retornar produto atualizado
    return res.status(200).json({
      success: true,
      data: {
        id: updatedProduct._id,
        ...updatedProduct
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao atualizar produto',
      message: error.message
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Excluir um produto
 */
async function deleteProduct(req, res) {
  // Verificar método HTTP
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use DELETE ou POST para excluir produto.'
    });
  }

  // Verificar permissões de administrador
  try {
    await verifyAdmin(req);
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: error.message
    });
  }

  const productId = req.query.id || req.body.id;
  
  // Validar ID do produto
  if (!productId) {
    return res.status(400).json({
      success: false,
      error: 'ID do produto é obrigatório'
    });
  }

  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Buscar produto pelo ID para verificar se existe
    const productsCollection = db.collection('products');
    
    let objectId;
    try {
      objectId = new ObjectId(productId);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'ID do produto inválido'
      });
    }
    
    const existingProduct = await productsCollection.findOne({ _id: objectId });
    
    // Verificar se o produto existe
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Produto não encontrado'
      });
    }
    
    // Excluir produto (ou marcar como inativo se preferir não excluir permanentemente)
    const shouldSoftDelete = req.query.soft === 'true' || req.body.soft === true;
    
    if (shouldSoftDelete) {
      // Soft delete (atualizar status para inativo)
      await productsCollection.updateOne(
        { _id: objectId },
        { 
          $set: { 
            status: 'inativo',
            updatedAt: new Date()
          } 
        }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Produto marcado como inativo',
        softDelete: true
      });
    } else {
      // Hard delete (remover permanentemente)
      await productsCollection.deleteOne({ _id: objectId });
      
      return res.status(200).json({
        success: true,
        message: 'Produto excluído permanentemente',
        softDelete: false
      });
    }
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao excluir produto',
      message: error.message
    });
  } finally {
    if (client) await client.close();
  }
}

/**
 * Pesquisar produtos
 */
async function searchProducts(req, res) {
  const searchTerm = req.query.term || req.query.q || '';
  
  // Conectar ao banco de dados
  let client;
  try {
    const dbConnection = await connectToDatabase();
    client = dbConnection.client;
    const db = dbConnection.db;
    
    // Obter parâmetros de paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Obter categoria e status (opcional)
    const category = req.query.category;
    const status = req.query.status || 'ativo';
    
    // Construir filtro de pesquisa
    const filter = {};
    
    // Adicionar termo de pesquisa se fornecido
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    // Adicionar filtros adicionais
    if (category) filter.category = category;
    if (status) filter.status = status;
    
    // Buscar produtos com paginação
    const productsCollection = db.collection('products');
    
    const products = await productsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Contar total de produtos para paginação
    const total = await productsCollection.countDocuments(filter);
    
    // Calcular total de páginas
    const totalPages = Math.ceil(total / limit);
    
    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Erro ao pesquisar produtos:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao pesquisar produtos',
      message: error.message
    });
  } finally {
    if (client) await client.close();
  }
} 