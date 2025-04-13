const axios = require('axios');
const cors = require('cors');
const express = require('express');

// Configuração do app
const app = express();

// Configuração de CORS
app.use(cors({
  origin: '*', // Permitir de qualquer origem no ambiente de desenvolvimento
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para processar JSON
app.use(express.json());

// Rota para criar assinatura no Asaas
app.post('/', async (req, res) => {
  try {
    // Validar dados do corpo da requisição
    const { planId, userId, customerId } = req.body;
    
    if (!planId || !userId || !customerId) {
      return res.status(400).json({ 
        error: 'Dados incompletos. planId, userId e customerId são obrigatórios.' 
      });
    }

    // Configurar requisição para a API do Asaas
    const asaasApiKey = process.env.ASAAS_API_KEY;
    if (!asaasApiKey) {
      console.error('ASAAS_API_KEY não configurada no ambiente');
      return res.status(500).json({ error: 'Erro de configuração do servidor' });
    }

    // Criar assinatura
    const createSubscriptionResponse = await axios.post(
      'https://api.asaas.com/v3/subscriptions',
      {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        nextDueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Data de amanhã
        value: planId === 'MENSAL' ? 39.90 : 150.00, // Valor baseado no plano
        cycle: planId === 'MENSAL' ? 'MONTHLY' : 'YEARLY',
        description: planId === 'MENSAL' ? 'Assinatura Mensal RunCash' : 'Assinatura Anual RunCash',
        creditCard: {
          holderName: '',
          number: '',
          expiryMonth: '',
          expiryYear: '',
          ccv: ''
        },
        creditCardHolderInfo: {
          name: '',
          email: '',
          cpfCnpj: '',
          postalCode: '',
          addressNumber: '',
          addressComplement: '',
          phone: ''
        },
        remoteIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    // Obter link de pagamento
    const paymentLinkResponse = await axios.get(
      `https://api.asaas.com/v3/subscriptions/${createSubscriptionResponse.data.id}/payments`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    if (!paymentLinkResponse.data.data || paymentLinkResponse.data.data.length === 0) {
      return res.status(500).json({ error: 'Não foi possível obter o link de pagamento' });
    }

    const paymentId = paymentLinkResponse.data.data[0].id;

    // Obter URL de pagamento
    const paymentResponse = await axios.get(
      `https://api.asaas.com/v3/payments/${paymentId}/identificationField`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    // Retornar dados da assinatura
    return res.status(201).json({
      subscriptionId: createSubscriptionResponse.data.id,
      redirectUrl: `https://www.asaas.com/c/${paymentId}`,
      message: 'Assinatura criada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error.response?.data || error.message);
    
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas'
    });
  }
});

// Exportar manipulador para Vercel
module.exports = app; 