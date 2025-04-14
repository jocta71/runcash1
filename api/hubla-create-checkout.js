const axios = require('axios');

// Handler para API do Hubla
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Lidar com solicitações OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter dados do corpo da requisição
    const { planId, userId, name, email, cpfCnpj, mobilePhone } = req.body;
    
    // Validar parâmetros obrigatórios
    if (!planId || !userId || !name || !email) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios ausentes',
        requiredParams: ['planId', 'userId', 'name', 'email']
      });
    }
    
    // Log de depuração
    console.log(`Criando checkout no Hubla: ${planId}, ${userId}, ${name}, ${email}`);
    
    // Mapeamento de planos
    const planDetails = {
      'MENSAL': {
        name: 'Assinatura Mensal RunCash',
        amount: 39.90,
        periodicity: 'monthly',
        interval: 1
      },
      'ANUAL': {
        name: 'Assinatura Anual RunCash',
        amount: 150.00,
        periodicity: 'yearly',
        interval: 1
      }
    };
    
    // Verificar se o plano existe
    if (!planDetails[planId]) {
      return res.status(400).json({ error: 'Plano inválido' });
    }
    
    // Configuração para API do Hubla
    const hublaConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HUBLA_API_KEY}`
      }
    };
    
    // Dados para criação do checkout
    const checkoutData = {
      product: {
        name: planDetails[planId].name,
        amount: planDetails[planId].amount,
        recurrence: {
          periodicity: planDetails[planId].periodicity,
          interval: planDetails[planId].interval
        }
      },
      customer: {
        name,
        email,
        tax_id: cpfCnpj || '',
        phone: mobilePhone || ''
      },
      success_url: `${req.headers.origin || 'https://runcashh11.vercel.app'}/payment-success?session_id={CHECKOUT_ID}`,
      cancel_url: `${req.headers.origin || 'https://runcashh11.vercel.app'}/plans`,
      metadata: {
        userId,
        planId
      }
    };
    
    // Chamada para API do Hubla
    const response = await axios.post(
      'https://api.hubla.com.br/v1/checkouts',
      checkoutData,
      hublaConfig
    );
    
    // Log de sucesso
    console.log(`Checkout Hubla criado com sucesso: ${response.data.id}`);
    
    // Retorna URL do checkout
    return res.status(201).json({
      success: true,
      checkoutId: response.data.id,
      url: response.data.checkout_url,
      message: 'Checkout criado com sucesso'
    });
    
  } catch (error) {
    // Log de erro
    console.error('Erro ao criar checkout no Hubla:', error);
    
    // Verificar se o erro veio da API do Hubla
    const hublaError = error.response?.data || {};
    
    // Retornar erro
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Erro ao criar checkout no Hubla',
      message: error.message,
      hublaError: hublaError
    });
  }
}; 