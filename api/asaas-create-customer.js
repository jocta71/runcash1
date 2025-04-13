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

// Rota para criar cliente no Asaas
app.post('/', async (req, res) => {
  try {
    // Validar dados do corpo da requisição
    const { name, email, cpfCnpj, mobilePhone } = req.body;
    
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ 
        error: 'Dados incompletos. Nome, email e CPF/CNPJ são obrigatórios.' 
      });
    }

    // Configurar requisição para a API do Asaas
    const asaasApiKey = process.env.ASAAS_API_KEY;
    if (!asaasApiKey) {
      console.error('ASAAS_API_KEY não configurada no ambiente');
      return res.status(500).json({ error: 'Erro de configuração do servidor' });
    }

    // Buscar se o cliente já existe pelo CPF/CNPJ
    const searchResponse = await axios.get(
      `https://api.asaas.com/v3/customers?cpfCnpj=${cpfCnpj}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    // Se o cliente já existir, retornar o ID dele
    if (searchResponse.data.data && searchResponse.data.data.length > 0) {
      return res.status(200).json({ 
        customerId: searchResponse.data.data[0].id,
        message: 'Cliente já existente encontrado'
      });
    }

    // Criar novo cliente
    const createResponse = await axios.post(
      'https://api.asaas.com/v3/customers',
      {
        name,
        email,
        cpfCnpj,
        mobilePhone
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    // Retornar o ID do cliente criado
    return res.status(201).json({ 
      customerId: createResponse.data.id,
      message: 'Cliente criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error.response?.data || error.message);
    
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas'
    });
  }
});

// Exportar manipulador para Vercel
module.exports = app; 