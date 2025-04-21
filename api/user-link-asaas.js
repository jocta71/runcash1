// Endpoint para vincular um usuário existente a um cliente Asaas
const { MongoClient } = require('mongodb');
const axios = require('axios');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  let client;
  
  try {
    const { userId, asaasCustomerId, email, cpfCnpj } = req.body;

    // Verificar que temos pelo menos um identificador de usuário
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar o ID do usuário' 
      });
    }

    // Verificar que temos pelo menos um identificador do cliente Asaas
    if (!asaasCustomerId && !email && !cpfCnpj) {
      return res.status(400).json({ 
        success: false,
        error: 'É necessário informar asaasCustomerId, email ou cpfCnpj para identificar o cliente no Asaas' 
      });
    }

    // Se não temos o ID do cliente Asaas, precisamos buscá-lo
    let customerId = asaasCustomerId;
    
    if (!customerId && (email || cpfCnpj)) {
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

      // Buscar cliente por email ou CPF/CNPJ
      const searchParams = cpfCnpj ? { cpfCnpj } : { email };
      
      try {
        console.log(`Buscando cliente no Asaas por ${cpfCnpj ? 'CPF/CNPJ' : 'email'}: ${cpfCnpj || email}`);
        const customersResponse = await apiClient.get('/customers', {
          params: searchParams
        });
        
        if (customersResponse.data.data && customersResponse.data.data.length > 0) {
          customerId = customersResponse.data.data[0].id;
          console.log(`Cliente encontrado no Asaas, ID: ${customerId}`);
        } else {
          return res.status(404).json({
            success: false,
            error: 'Cliente não encontrado no Asaas'
          });
        }
      } catch (searchError) {
        console.error('Erro ao buscar cliente no Asaas:', searchError.message);
        return res.status(500).json({
          success: false,
          error: 'Erro ao buscar cliente no Asaas',
          message: searchError.message
        });
      }
    }

    // Salvar a relação no MongoDB
    if (process.env.MONGODB_ENABLED === 'true' && process.env.MONGODB_URI) {
      try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
        
        // Atualizar o usuário com o ID do cliente Asaas
        const result = await db.collection('users').updateOne(
          { _id: userId },
          { $set: { asaasCustomerId: customerId } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            error: 'Usuário não encontrado'
          });
        }
        
        // Também atualizar ou criar a relação na coleção de customers
        await db.collection('customers').updateOne(
          { user_id: userId },
          { 
            $set: { 
              asaas_id: customerId,
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );

        console.log(`Usuário ${userId} vinculado ao cliente Asaas ${customerId}`);
        
        return res.status(200).json({
          success: true,
          data: {
            userId,
            asaasCustomerId: customerId
          },
          message: 'Usuário vinculado ao cliente Asaas com sucesso'
        });
      } catch (dbError) {
        console.error('Erro ao acessar MongoDB:', dbError.message);
        return res.status(500).json({
          success: false,
          error: 'Erro ao acessar banco de dados',
          message: dbError.message
        });
      }
    } else {
      return res.status(500).json({
        success: false,
        error: 'MongoDB não está configurado'
      });
    }
  } catch (error) {
    console.error('Erro ao processar solicitação:', error.message);
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