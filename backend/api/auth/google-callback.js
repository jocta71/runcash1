// API para processar o callback da autenticação com o Google
const { OAuth2Client } = require('google-auth-library');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let mongoClient;

  try {
    // Obter o código da URL
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Código de autorização ausente' });
    }

    // Obter as credenciais do Google
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_API_URL || 'https://runcashh11.vercel.app'}/api/auth/google/callback`;
    const JWT_SECRET = process.env.JWT_SECRET || 'seu_jwt_secret_super_seguro';

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: 'Credenciais do Google não configuradas' });
    }

    // Criar cliente OAuth
    const oAuth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    // Trocar o código pelo token
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Obter informações do usuário
    const userInfoClient = new OAuth2Client();
    userInfoClient.setCredentials(tokens);

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const userData = await userInfoResponse.json();

    // Conectar ao MongoDB
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db(process.env.MONGODB_DATABASE || 'runcash');

    // Verificar se o usuário já existe no banco de dados
    let user = await db.collection('users').findOne({ email: userData.email });

    if (!user) {
      // Criar novo usuário
      const newUser = {
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        google_id: userData.sub,
        created_at: new Date(),
        updated_at: new Date(),
        role: 'user',
        status: 'active'
      };

      const result = await db.collection('users').insertOne(newUser);
      user = {
        ...newUser,
        _id: result.insertedId
      };
    } else {
      // Atualizar dados do usuário
      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            name: userData.name,
            picture: userData.picture,
            updated_at: new Date()
          }
        }
      );
    }

    // Gerar token JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'user'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirecionar para o frontend com o token
    const redirectUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://runcashh11.vercel.app'}/auth/callback?token=${token}`;
    res.writeHead(302, { Location: redirectUrl });
    return res.end();
  } catch (error) {
    console.error('Erro no callback do Google:', error);
    return res.status(500).json({
      error: 'Erro no callback do Google',
      message: error.message
    });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}; 