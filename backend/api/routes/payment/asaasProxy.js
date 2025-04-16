/**
 * Proxy para a API do Asaas
 * Este arquivo contém todas as rotas para interagir com a API do Asaas
 */

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const router = express.Router();
const { Customer } = require('../../models/Customer');
const { Subscription } = require('../../models/Subscription');
const { Transaction } = require('../../models/Transaction');

// Configuração do ambiente Asaas
const ASAAS_ENV = process.env.ASAAS_ENV || 'sandbox';
const BASE_URL = ASAAS_ENV === 'production' 
  ? 'https://api.asaas.com/v3' 
  : 'https://sandbox.asaas.com/api/v3';
const API_KEY = process.env.ASAAS_API_KEY;

// Middleware para verificar API Key
if (!API_KEY) {
  console.error('ERRO: ASAAS_API_KEY não configurada!');
}

// Esquema para o Cliente Asaas
const AsaasCustomerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  asaasId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  cpfCnpj: { type: String, required: true },
  mobilePhone: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Esquema para a Assinatura Asaas
const AsaasSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  customerId: { type: String, required: true },
  asaasSubscriptionId: { type: String, required: true, unique: true },
  value: { type: Number, required: true },
  nextDueDate: { type: Date },
  status: { type: String },
  cycle: { type: String, default: 'MONTHLY' },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Criar modelos ou usá-los se já existirem
const AsaasCustomer = mongoose.models.AsaasCustomer || mongoose.model('AsaasCustomer', AsaasCustomerSchema);
const AsaasSubscription = mongoose.models.AsaasSubscription || mongoose.model('AsaasSubscription', AsaasSubscriptionSchema);

// Middleware para logging
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Função auxiliar para verificar conexão MongoDB
const checkMongoConnection = () => {
  return mongoose.connection.readyState === 1;
};

// Função para normalizar CPF/CNPJ (remover caracteres não numéricos)
const normalizeCpfCnpj = (cpfCnpj) => {
  return cpfCnpj.replace(/\D/g, '');
};

// Função para normalizar número de telefone
const normalizePhone = (phone) => {
  return phone ? phone.replace(/\D/g, '') : '';
};

/**
 * Rota para criar ou obter um cliente
 * Verifica primeiro se o cliente já existe por CPF/CNPJ
 * Se existir, atualiza os dados; se não, cria um novo
 */
router.post('/create-customer', async (req, res) => {
  try {
    // Verificar API Key
    if (!API_KEY) {
      return res.status(500).json({ 
        error: 'API Key do Asaas não configurada',
        success: false
      });
    }

    // Extrair dados do corpo da requisição
    const { name, email, cpfCnpj, mobilePhone, userId } = req.body;

    // Validar campos obrigatórios
    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: name, email, cpfCnpj',
        success: false
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        error: 'userId é obrigatório para associar o cliente ao usuário',
        success: false
      });
    }

    // Normalizar CPF/CNPJ e telefone
    const normalizedCpfCnpj = normalizeCpfCnpj(cpfCnpj);
    const normalizedPhone = normalizePhone(mobilePhone);

    // Verificar conexão com MongoDB
    if (checkMongoConnection()) {
      // Buscar cliente existente por CPF/CNPJ e userId
      const existingCustomer = await AsaasCustomer.findOne({ 
        cpfCnpj: normalizedCpfCnpj,
        userId
      });

      if (existingCustomer) {
        console.log(`Cliente existente encontrado: ${existingCustomer.asaasId}`);
        
        // Atualizar dados do cliente no Asaas
        const updateResponse = await axios({
          method: 'post',
          url: `${BASE_URL}/customers/${existingCustomer.asaasId}`,
          headers: {
            'Content-Type': 'application/json',
            'access_token': API_KEY
          },
          data: {
            name,
            email,
            mobilePhone: normalizedPhone
          }
        });

        // Atualizar no MongoDB
        existingCustomer.name = name;
        existingCustomer.email = email;
        existingCustomer.mobilePhone = normalizedPhone;
        existingCustomer.updatedAt = new Date();
        await existingCustomer.save();

        return res.status(200).json({
          success: true,
          message: 'Cliente atualizado com sucesso',
          customer: {
            id: existingCustomer.asaasId,
            name,
            email,
            cpfCnpj: normalizedCpfCnpj,
            mobilePhone: normalizedPhone
          }
        });
      }
    }

    // Se não existir, criar novo cliente no Asaas
    console.log('Criando novo cliente no Asaas...');
    const asaasResponse = await axios({
      method: 'post',
      url: `${BASE_URL}/customers`,
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY
      },
      data: {
        name,
        email,
        cpfCnpj: normalizedCpfCnpj,
        mobilePhone: normalizedPhone
      }
    });

    const newCustomer = asaasResponse.data;
    console.log('Cliente criado com sucesso no Asaas:', newCustomer.id);

    // Salvar cliente no MongoDB se estiver conectado
    if (checkMongoConnection()) {
      await AsaasCustomer.create({
        userId,
        asaasId: newCustomer.id,
        name,
        email,
        cpfCnpj: normalizedCpfCnpj,
        mobilePhone: normalizedPhone
      });
      console.log('Cliente salvo no MongoDB');
    }

    return res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      customer: {
        id: newCustomer.id,
        name,
        email,
        cpfCnpj: normalizedCpfCnpj,
        mobilePhone: normalizedPhone
      }
    });

  } catch (error) {
    console.error('Erro ao criar/atualizar cliente:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || error.message
    });
  }
});

/**
 * Rota para criar uma assinatura
 * Requer um customerId (ID do cliente no Asaas) e planId
 */
router.post('/create-subscription', async (req, res) => {
  try {
    // Verificar API Key
    if (!API_KEY) {
      return res.status(500).json({ 
        error: 'API Key do Asaas não configurada',
        success: false
      });
    }

    // Extrair dados do corpo da requisição
    const { 
      customerId, 
      value,
      nextDueDate,
      cycle = 'MONTHLY',
      description,
      userId
    } = req.body;

    // Validar campos obrigatórios
    if (!customerId || !value) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: customerId, value',
        success: false
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        error: 'userId é obrigatório para associar a assinatura ao usuário',
        success: false
      });
    }

    // Preparar data de vencimento (se não fornecida, usa data atual + 1 dia)
    const dueDate = nextDueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Criar assinatura no Asaas
    console.log('Criando nova assinatura no Asaas...');
    const asaasResponse = await axios({
      method: 'post',
      url: `${BASE_URL}/subscriptions`,
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY
      },
      data: {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value,
        nextDueDate: dueDate,
        cycle,
        description: description || 'Assinatura RunCashh'
      }
    });

    const newSubscription = asaasResponse.data;
    console.log('Assinatura criada com sucesso no Asaas:', newSubscription.id);

    // Salvar assinatura no MongoDB se estiver conectado
    if (checkMongoConnection()) {
      await AsaasSubscription.create({
        userId,
        customerId,
        asaasSubscriptionId: newSubscription.id,
        value,
        nextDueDate: dueDate,
        status: newSubscription.status,
        cycle,
        description: description || 'Assinatura RunCashh'
      });
      console.log('Assinatura salva no MongoDB');
    }

    return res.status(201).json({
      success: true,
      message: 'Assinatura criada com sucesso',
      subscription: newSubscription
    });

  } catch (error) {
    console.error('Erro ao criar assinatura:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || error.message
    });
  }
});

/**
 * Rota para obter dados de uma assinatura
 * Inclui pagamentos associados
 */
router.get('/subscription/:id', async (req, res) => {
  try {
    // Verificar API Key
    if (!API_KEY) {
      return res.status(500).json({ 
        error: 'API Key do Asaas não configurada',
        success: false
      });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ 
        error: 'ID da assinatura é obrigatório',
        success: false
      });
    }

    // Obter dados da assinatura
    const subscriptionResponse = await axios({
      method: 'get',
      url: `${BASE_URL}/subscriptions/${id}`,
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY
      }
    });

    // Obter pagamentos associados
    const paymentsResponse = await axios({
      method: 'get',
      url: `${BASE_URL}/subscriptions/${id}/payments`,
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY
      }
    });

    return res.status(200).json({
      success: true,
      subscription: subscriptionResponse.data,
      payments: paymentsResponse.data
    });

  } catch (error) {
    console.error('Erro ao obter dados da assinatura:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors || error.message
    });
  }
});

/**
 * Rota para processar webhooks do Asaas
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook recebido do Asaas:', req.body);
    
    // Aqui você processaria os eventos do Asaas
    // Por exemplo: payment.received, subscription.renewed, etc.
    const event = req.body.event;
    const payment = req.body.payment;
    
    // Você pode verificar o tipo de evento e realizar ações específicas
    // Por exemplo, atualizar o status de uma assinatura no seu banco de dados
    
    // Simplesmente registrar e confirmar recebimento
    console.log(`Evento ${event} processado com sucesso`);
    
    // Retornar 200 OK para confirmar o recebimento
    return res.status(200).json({
      success: true,
      message: 'Webhook recebido e processado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 