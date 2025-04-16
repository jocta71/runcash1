const { MongoClient } = require('mongodb');
const axios = require('axios');

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_BASE_URL = ASAAS_ENVIRONMENT === 'production' 
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { 
    subscriptionId, 
    userId,
    billingType,
    creditCard,
    creditCardHolderInfo
  } = req.body;
  
  if (!subscriptionId || !billingType) {
    return res.status(400).json({ 
      error: 'ID da assinatura e método de pagamento são obrigatórios' 
    });
  }

  // Validar método de pagamento
  const validBillingTypes = ['PIX', 'CREDIT_CARD', 'BOLETO'];
  if (!validBillingTypes.includes(billingType)) {
    return res.status(400).json({ 
      error: 'Método de pagamento inválido', 
      validOptions: validBillingTypes 
    });
  }

  // Validar dados do cartão para pagamento com cartão de crédito
  if (billingType === 'CREDIT_CARD') {
    if (!creditCard || !creditCard.holderName || !creditCard.number || 
        !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.ccv) {
      return res.status(400).json({ 
        error: 'Dados do cartão de crédito incompletos',
        details: 'Nome do titular, número do cartão, mês/ano de expiração e cvv são obrigatórios' 
      });
    }
    
    if (!creditCardHolderInfo || !creditCardHolderInfo.name || !creditCardHolderInfo.email ||
        !creditCardHolderInfo.cpfCnpj || !creditCardHolderInfo.postalCode) {
      return res.status(400).json({ 
        error: 'Dados do titular do cartão incompletos',
        details: 'Nome, email, CPF/CNPJ e CEP do titular são obrigatórios' 
      });
    }
  }

  let client;
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // Verificar se a assinatura existe
    const subscription = await db.collection('subscriptions').findOne({ asaas_id: subscriptionId });
    if (!subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }
    
    // Verificar se o usuário tem permissão (opcional)
    if (userId && subscription.user_id && subscription.user_id !== userId) {
      return res.status(403).json({ error: 'Não autorizado a modificar esta assinatura' });
    }
    
    // Preparar dados para atualização no Asaas
    const updateData = {
      billingType: billingType
    };
    
    // Adicionar dados do cartão se for pagamento por cartão de crédito
    if (billingType === 'CREDIT_CARD') {
      // Limpar dados para garantir formato correto
      const cleanCardNumber = creditCard.number.replace(/[^\d]/g, '');
      const cleanCpfCnpj = creditCardHolderInfo.cpfCnpj.replace(/[^\d]/g, '');
      const cleanPostalCode = creditCardHolderInfo.postalCode.replace(/[^\d]/g, '');
      const cleanHolderPhone = creditCardHolderInfo.phone ? creditCardHolderInfo.phone.replace(/[^\d]/g, '') : undefined;
      
      updateData.creditCard = {
        holderName: creditCard.holderName.trim(),
        number: cleanCardNumber,
        expiryMonth: creditCard.expiryMonth.toString().padStart(2, '0'),
        expiryYear: creditCard.expiryYear.toString().length <= 2 ? `20${creditCard.expiryYear}` : creditCard.expiryYear.toString(),
        ccv: creditCard.ccv.toString()
      };
      
      updateData.creditCardHolderInfo = {
        name: creditCardHolderInfo.name.trim(),
        email: creditCardHolderInfo.email.trim(),
        cpfCnpj: cleanCpfCnpj,
        postalCode: cleanPostalCode,
        addressNumber: creditCardHolderInfo.addressNumber,
        phone: cleanHolderPhone
      };
    }
    
    // Atualizar assinatura no Asaas
    const response = await axios.post(
      `${ASAAS_BASE_URL}/subscriptions/${subscriptionId}`,
      updateData,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    // Atualizar registro no MongoDB
    await db.collection('subscriptions').updateOne(
      { asaas_id: subscriptionId },
      { 
        $set: { 
          billing_type: billingType,
          updated_at: new Date()
        } 
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Método de pagamento atualizado com sucesso',
      subscription: response.data
    });
  } catch (error) {
    console.error('Erro ao atualizar método de pagamento:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({ 
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ error: 'Erro ao atualizar método de pagamento' });
  } finally {
    if (client) await client.close();
  }
}; 