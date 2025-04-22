const { MongoClient } = require('mongodb');
const axios = require('axios');
const cors = require('cors')({ origin: true });

module.exports = async (req, res) => {
  // Configuração de CORS
  await new Promise((resolve) => cors(req, res, resolve));

  // Verificação do método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido'
    });
  }

  let client;
  
  try {
    const { customerId, name, email, cpfCnpj, mobilePhone } = req.body;

    // Validar campos obrigatórios
    if (!customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'Campo obrigatório: customerId' 
      });
    }

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'Chave de API do Asaas não configurada' 
      });
    }

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // Dados para atualizar o cliente
    const customerData = {};
    
    // Adicionar apenas os campos que foram fornecidos
    if (name) customerData.name = name;
    if (email) customerData.email = email;
    if (cpfCnpj) customerData.cpfCnpj = cpfCnpj;
    if (mobilePhone) customerData.mobilePhone = mobilePhone;

    console.log(`Atualizando cliente ${customerId} no Asaas:`, customerData);
    
    // Atualizar cliente no Asaas
    const updateResponse = await apiClient.post(`/customers/${customerId}`, customerData);
    const updatedCustomer = updateResponse.data;
    
    console.log(`Cliente atualizado com sucesso:`, {
      id: updatedCustomer.id,
      name: updatedCustomer.name,
      email: updatedCustomer.email,
      cpfCnpj: updatedCustomer.cpfCnpj || 'Não fornecido'
    });

    // Se tiver MongoDB configurado, também atualizar lá
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Atualizar no MongoDB
        await db.collection('customers').updateOne(
          { asaas_id: customerId },
          { 
            $set: {
              ...customerData,
              updatedAt: new Date()
            } 
          }
        );
        
        console.log('Cliente atualizado no MongoDB');
      } catch (dbError) {
        console.error('Erro ao acessar MongoDB:', dbError.message);
        // Continuar mesmo com erro no MongoDB
      }
    }

    return res.status(200).json({
      success: true,
      id: updatedCustomer.id,
      message: 'Cliente atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar solicitação:', error.message);
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 