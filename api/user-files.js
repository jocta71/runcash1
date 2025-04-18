const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

// Configuração do MongoDB e variáveis de ambiente
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_jwt';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'user-files-bucket';

// Inicializar Google Cloud Storage (se as credenciais estiverem configuradas)
let storage;
try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    storage = new Storage({ credentials });
  } else {
    // Inicializar com credenciais padrão (para ambiente de desenvolvimento)
    storage = new Storage();
  }
} catch (error) {
  console.error('Erro ao inicializar Google Cloud Storage:', error);
}

// Verificar token de autenticação
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Configuração de CORS (Helper)
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Validação do usuário (Helper)
const validateUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token de autenticação não fornecido', status: 401 };
  }
  
  const token = authHeader.substring(7); // Remover "Bearer " do início
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return { error: 'Token inválido ou expirado', status: 401 };
  }
  
  const userId = decoded.id || decoded.userId || decoded.sub;
  
  if (!userId) {
    return { error: 'ID de usuário não encontrado no token', status: 401 };
  }
  
  return { userId, decoded };
};

// Validar tipo de arquivo permitido
const isAllowedFileType = (mimetype) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip'
  ];
  
  return allowedTypes.includes(mimetype);
};

// Gerar nome de arquivo seguro
const generateSafeFileName = (originalName, userId) => {
  const timestamp = Date.now();
  const extension = path.extname(originalName);
  const randomString = Math.random().toString(36).substring(2, 10);
  return `${userId}-${timestamp}-${randomString}${extension}`;
};

// Handler principal
module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS
  setCorsHeaders(res);

  // Responder a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Extrair o caminho da URL
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Ignorar o segmento "api" e "user-files" (os dois primeiros)
  const action = pathSegments[2] || '';
  
  // Para todas as rotas, validar o usuário
  const userValidation = await validateUser(req, res);
  if (userValidation.error) {
    return res.status(userValidation.status).json({ error: userValidation.error });
  }
  
  const { userId } = userValidation;
  
  let client;
  
  try {
    // Conectar ao MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // ROTA 1: Listar todos os arquivos do usuário
    if (req.method === 'GET' && !action) {
      // Parâmetros de paginação
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const skip = (page - 1) * limit;
      
      // Filtros adicionais
      const fileType = url.searchParams.get('type');
      const query = { user_id: userId };
      
      if (fileType) {
        query.file_type = fileType;
      }
      
      // Obter contagem total para paginação
      const total = await db.collection('user_files').countDocuments(query);
      
      // Obter arquivos
      const files = await db.collection('user_files')
        .find(query)
        .sort({ uploaded_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      // Formatar resposta
      const formattedFiles = files.map(file => ({
        id: file._id.toString(),
        fileName: file.file_name,
        originalName: file.original_name,
        fileType: file.file_type,
        mimeType: file.mime_type,
        fileSize: file.file_size,
        category: file.category || 'general',
        uploadedAt: file.uploaded_at,
        url: file.url,
        publicAccess: file.public_access || false,
        tags: file.tags || []
      }));
      
      return res.status(200).json({
        success: true,
        files: formattedFiles,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    }
    
    // ROTA 2: Upload de arquivo
    if (req.method === 'POST' && !action) {
      // Verificar se o armazenamento está disponível
      if (!storage) {
        return res.status(500).json({ error: 'Serviço de armazenamento não está configurado' });
      }
      
      const bucket = storage.bucket(STORAGE_BUCKET);
      
      // Parse do formulário com Formidable
      const form = new formidable.IncomingForm();
      form.maxFileSize = 20 * 1024 * 1024; // Limite de 20MB
      
      return new Promise((resolve, reject) => {
        form.parse(req, async (err, fields, files) => {
          if (err) {
            if (err.code === 1009) { // Código de erro para tamanho excedido
              return resolve(res.status(413).json({ error: 'Arquivo muito grande. Limite de 20MB.' }));
            }
            return resolve(res.status(500).json({ error: 'Erro ao processar upload de arquivo' }));
          }
          
          const uploadedFile = files.file;
          
          if (!uploadedFile) {
            return resolve(res.status(400).json({ error: 'Nenhum arquivo enviado' }));
          }
          
          // Validar tipo de arquivo
          if (!isAllowedFileType(uploadedFile.mimetype)) {
            return resolve(res.status(400).json({ error: 'Tipo de arquivo não permitido' }));
          }
          
          const category = fields.category || 'general';
          const tags = fields.tags ? JSON.parse(fields.tags) : [];
          const publicAccess = fields.publicAccess === 'true';
          
          // Gerar nome de arquivo seguro
          const safeFileName = generateSafeFileName(uploadedFile.originalFilename, userId);
          
          try {
            // Upload para o Google Cloud Storage
            const destFile = bucket.file(`user-files/${userId}/${safeFileName}`);
            
            // Criar um stream de leitura e escrita
            const readStream = fs.createReadStream(uploadedFile.filepath);
            const writeStream = destFile.createWriteStream({
              metadata: {
                contentType: uploadedFile.mimetype
              }
            });
            
            writeStream.on('error', (error) => {
              console.error('Erro ao fazer upload para Google Cloud Storage:', error);
              resolve(res.status(500).json({ error: 'Erro ao fazer upload do arquivo' }));
            });
            
            writeStream.on('finish', async () => {
              try {
                // Configurar acesso público se solicitado
                if (publicAccess) {
                  await destFile.makePublic();
                }
                
                // Obter a URL do arquivo
                const fileUrl = publicAccess 
                  ? `https://storage.googleapis.com/${STORAGE_BUCKET}/user-files/${userId}/${safeFileName}`
                  : null;
                
                // Salvar informações do arquivo no MongoDB
                const fileData = {
                  user_id: userId,
                  file_name: safeFileName,
                  original_name: uploadedFile.originalFilename,
                  file_type: path.extname(uploadedFile.originalFilename).substring(1).toLowerCase(),
                  mime_type: uploadedFile.mimetype,
                  file_size: uploadedFile.size,
                  storage_path: `user-files/${userId}/${safeFileName}`,
                  url: fileUrl,
                  public_access: publicAccess,
                  category,
                  tags,
                  uploaded_at: new Date(),
                  updated_at: new Date()
                };
                
                const result = await db.collection('user_files').insertOne(fileData);
                
                // Retornar resposta de sucesso
                resolve(res.status(200).json({
                  success: true,
                  message: 'Arquivo enviado com sucesso',
                  fileId: result.insertedId.toString(),
                  fileName: safeFileName,
                  originalName: uploadedFile.originalFilename,
                  fileSize: uploadedFile.size,
                  mimeType: uploadedFile.mimetype,
                  url: fileUrl
                }));
              } catch (dbError) {
                console.error('Erro ao salvar informações do arquivo:', dbError);
                // Tentar excluir o arquivo enviado se falhar em salvar os metadados
                try {
                  await destFile.delete();
                } catch (deleteError) {
                  console.error('Erro ao excluir arquivo após falha:', deleteError);
                }
                resolve(res.status(500).json({ error: 'Erro ao salvar informações do arquivo' }));
              }
            });
            
            // Iniciar o upload
            readStream.pipe(writeStream);
            
          } catch (error) {
            console.error('Erro durante o upload:', error);
            resolve(res.status(500).json({ error: 'Erro ao processar o arquivo' }));
          }
        });
      });
    }
    
    // ROTA 3: Obter informações de um arquivo específico
    if (req.method === 'GET' && action === 'info') {
      const fileId = url.searchParams.get('id');
      
      if (!fileId) {
        return res.status(400).json({ error: 'ID do arquivo é obrigatório' });
      }
      
      // Buscar arquivo no banco de dados
      const file = await db.collection('user_files').findOne({
        _id: new ObjectId(fileId),
        user_id: userId
      });
      
      if (!file) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }
      
      return res.status(200).json({
        success: true,
        file: {
          id: file._id.toString(),
          fileName: file.file_name,
          originalName: file.original_name,
          fileType: file.file_type,
          mimeType: file.mime_type,
          fileSize: file.file_size,
          category: file.category || 'general',
          uploadedAt: file.uploaded_at,
          url: file.url,
          publicAccess: file.public_access || false,
          tags: file.tags || []
        }
      });
    }
    
    // ROTA 4: Download do arquivo (gerar URL de download assinada)
    if (req.method === 'GET' && action === 'download') {
      const fileId = url.searchParams.get('id');
      
      if (!fileId) {
        return res.status(400).json({ error: 'ID do arquivo é obrigatório' });
      }
      
      // Buscar arquivo no banco de dados
      const file = await db.collection('user_files').findOne({
        _id: new ObjectId(fileId),
        user_id: userId
      });
      
      if (!file) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }
      
      // Se o arquivo já tem acesso público, apenas retorna a URL
      if (file.public_access && file.url) {
        return res.status(200).json({
          success: true,
          downloadUrl: file.url,
          expires: null // Não expira
        });
      }
      
      // Gerar URL assinada para download temporário
      try {
        const bucket = storage.bucket(STORAGE_BUCKET);
        const fileRef = bucket.file(file.storage_path);
        
        // Verificar se o arquivo existe no storage
        const [exists] = await fileRef.exists();
        if (!exists) {
          return res.status(404).json({ error: 'Arquivo não encontrado no armazenamento' });
        }
        
        // Gerar URL assinada (válida por 15 minutos)
        const [signedUrl] = await fileRef.getSignedUrl({
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000, // 15 minutos
          responseDisposition: `attachment; filename="${file.original_name}"`
        });
        
        return res.status(200).json({
          success: true,
          downloadUrl: signedUrl,
          expires: new Date(Date.now() + 15 * 60 * 1000)
        });
      } catch (error) {
        console.error('Erro ao gerar URL de download:', error);
        return res.status(500).json({ error: 'Erro ao gerar link de download' });
      }
    }
    
    // ROTA 5: Atualizar informações do arquivo
    if (req.method === 'PUT' && !action) {
      const fileId = url.searchParams.get('id');
      
      if (!fileId) {
        return res.status(400).json({ error: 'ID do arquivo é obrigatório' });
      }
      
      // Buscar arquivo no banco de dados
      const file = await db.collection('user_files').findOne({
        _id: new ObjectId(fileId),
        user_id: userId
      });
      
      if (!file) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }
      
      // Extrair dados a serem atualizados
      const { category, tags, publicAccess } = req.body;
      
      // Criar objeto com dados a serem atualizados
      const updateData = {
        updated_at: new Date()
      };
      
      if (category !== undefined) {
        updateData.category = category;
      }
      
      if (tags !== undefined) {
        updateData.tags = tags;
      }
      
      // Se a visibilidade do arquivo mudou
      if (publicAccess !== undefined && publicAccess !== file.public_access) {
        updateData.public_access = publicAccess;
        
        try {
          const bucket = storage.bucket(STORAGE_BUCKET);
          const fileRef = bucket.file(file.storage_path);
          
          if (publicAccess) {
            // Tornar o arquivo público
            await fileRef.makePublic();
            updateData.url = `https://storage.googleapis.com/${STORAGE_BUCKET}/${file.storage_path}`;
          } else {
            // Tornar o arquivo privado
            await fileRef.makePrivate();
            updateData.url = null;
          }
        } catch (error) {
          console.error('Erro ao alterar permissão do arquivo:', error);
          return res.status(500).json({ error: 'Erro ao alterar permissões do arquivo' });
        }
      }
      
      // Atualizar no banco de dados
      await db.collection('user_files').updateOne(
        { _id: new ObjectId(fileId) },
        { $set: updateData }
      );
      
      // Buscar arquivo atualizado
      const updatedFile = await db.collection('user_files').findOne({
        _id: new ObjectId(fileId)
      });
      
      return res.status(200).json({
        success: true,
        message: 'Informações do arquivo atualizadas com sucesso',
        file: {
          id: updatedFile._id.toString(),
          fileName: updatedFile.file_name,
          originalName: updatedFile.original_name,
          category: updatedFile.category,
          tags: updatedFile.tags || [],
          publicAccess: updatedFile.public_access,
          url: updatedFile.url
        }
      });
    }
    
    // ROTA 6: Excluir arquivo
    if (req.method === 'DELETE' && !action) {
      const fileId = url.searchParams.get('id');
      
      if (!fileId) {
        return res.status(400).json({ error: 'ID do arquivo é obrigatório' });
      }
      
      // Buscar arquivo no banco de dados
      const file = await db.collection('user_files').findOne({
        _id: new ObjectId(fileId),
        user_id: userId
      });
      
      if (!file) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }
      
      // Excluir arquivo do armazenamento
      try {
        const bucket = storage.bucket(STORAGE_BUCKET);
        const fileRef = bucket.file(file.storage_path);
        
        // Verificar se o arquivo existe no storage
        const [exists] = await fileRef.exists();
        if (exists) {
          await fileRef.delete();
        }
      } catch (error) {
        console.error('Erro ao excluir arquivo do armazenamento:', error);
        // Continuamos o processo mesmo se houver erro ao excluir do storage
      }
      
      // Excluir informações do arquivo do banco de dados
      await db.collection('user_files').deleteOne({
        _id: new ObjectId(fileId)
      });
      
      return res.status(200).json({
        success: true,
        message: 'Arquivo excluído com sucesso'
      });
    }
    
    // Se nenhuma rota corresponder
    return res.status(404).json({ error: 'Endpoint não encontrado' });
    
  } catch (error) {
    console.error('Erro na API de arquivos do usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 