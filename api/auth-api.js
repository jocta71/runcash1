// API unificada para autenticação
const axios = require('axios');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

module.exports = async (req, res) => {
  console.log('=== INÍCIO DA REQUISIÇÃO DE AUTENTICAÇÃO ===');
  console.log('Método:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', JSON.stringify(req.query, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body ? JSON.stringify(req.body, null, 2) : 'Sem corpo');

  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    console.log('Requisição OPTIONS recebida - Respondendo com 200');
    return res.status(200).end();
  }

  // Extrair a operação da URL ou parâmetros da consulta
  const path = req.url.split('?')[0];
  const operation = req.query.operation || path.split('/').pop();

  console.log(`Operação de autenticação detectada: ${operation}`);

  let client;

  try {
    // Configurar variáveis de ambiente para autenticação
    const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_in_production';
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REDIRECT_URL = process.env.REDIRECT_URL || 'https://runcashh11.vercel.app/api/auth/google/callback';
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Credenciais do Google não configuradas');
    }

    // Conectar MongoDB (quando necessário)
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');

    // Configurar cliente OAuth2 do Google
    const oAuth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URL
    );

    // Processar operações com base no parâmetro ou caminho
    switch (operation) {
      // === LOGIN COM GOOGLE ===
      case 'google-login':
        // Gerar URL de autorização
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
          ],
          prompt: 'consent'
        });
        
        return res.status(200).json({
          success: true,
          authUrl: authUrl
        });
      
      // === CALLBACK DO GOOGLE ===
      case 'google-callback':
        const { code } = req.query;
        
        if (!code) {
          return res.status(400).json({
            success: false,
            error: 'Código de autorização ausente'
          });
        }
        
        // Obter tokens do Google
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        
        // Obter informações do usuário
        const userInfo = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`
            }
          }
        );
        
        const userData = userInfo.data;
        
        // Procurar usuário no banco de dados ou criar um novo
        let user = await db.collection('users').findOne({
          email: userData.email
        });
        
        if (!user) {
          // Criar novo usuário
          const newUser = {
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            google_id: userData.sub,
            created_at: new Date(),
            updated_at: new Date(),
            last_login: new Date()
          };
          
          const result = await db.collection('users').insertOne(newUser);
          user = {
            _id: result.insertedId,
            ...newUser
          };
        } else {
          // Atualizar dados do usuário existente
          await db.collection('users').updateOne(
            { _id: user._id },
            {
              $set: {
                name: userData.name,
                picture: userData.picture,
                google_id: userData.sub,
                updated_at: new Date(),
                last_login: new Date()
              }
            }
          );
        }
        
        // Gerar JWT para autenticação no frontend
        const token = jwt.sign(
          {
            id: user._id.toString(),
            email: user.email,
            name: user.name
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        // Redirecionar para o frontend com o token
        return res.redirect(`/auth-callback?token=${token}`);
      
      // === VERIFICAR TOKEN JWT ===
      case 'verify-token':
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { token: authToken } = req.body;
        
        if (!authToken) {
          return res.status(400).json({
            success: false,
            error: 'Token não fornecido'
          });
        }
        
        try {
          // Verificar token
          const decoded = jwt.verify(authToken, JWT_SECRET);
          
          // Obter usuário do banco de dados
          const authUser = await db.collection('users').findOne({
            _id: decoded.id,
            email: decoded.email
          });
          
          if (!authUser) {
            throw new Error('Usuário não encontrado');
          }
          
          return res.status(200).json({
            success: true,
            user: {
              id: authUser._id,
              email: authUser.email,
              name: authUser.name,
              picture: authUser.picture
            }
          });
        } catch (err) {
          return res.status(401).json({
            success: false,
            error: 'Token inválido ou expirado'
          });
        }
      
      default:
        return res.status(400).json({
          success: false,
          error: 'Operação de autenticação não reconhecida',
          operation
        });
    }
  } catch (error) {
    console.error('Erro ao processar autenticação:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'Sem resposta'
    });
    
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar autenticação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 