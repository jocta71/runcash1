// API para iniciar o processo de autenticação com o Google
const { OAuth2Client } = require('google-auth-library');

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

  try {
    // Obter as credenciais do Google
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_API_URL || 'https://runcashh11.vercel.app'}/api/auth/google/callback`;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: 'Credenciais do Google não configuradas' });
    }

    // Criar cliente OAuth
    const oAuth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    // Gerar URL de autorização
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      prompt: 'consent'
    });

    // Redirecionar para a URL de autorização
    res.writeHead(302, { Location: authUrl });
    return res.end();
  } catch (error) {
    console.error('Erro na autenticação do Google:', error);
    return res.status(500).json({
      error: 'Erro na autenticação do Google',
      message: error.message
    });
  }
}; 