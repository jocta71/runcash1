import axios from 'axios';
import { MongoClient } from 'mongodb';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';
const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Manipular solicitações OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar o método da solicitação
  if (req.method !== 'POST') {
    console.log(`Método não permitido: ${req.method}`);
    return res.status(405).json({ error: 'Método não permitido' });
  }

  console.log('Requisição recebida para criar pagamento PIX:');
  console.log('Método:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  // Validar corpo da requisição
  const { customerId, value, description } = req.body;

  if (!customerId || !value) {
    console.log('Campos obrigatórios ausentes:', { customerId, value });
    return res.status(400).json({ error: 'customerId e value são obrigatórios' });
  }

  let client;
  try {
    // Verificar API key
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY não está definida');
    }

    console.log('Chave da API Asaas:', ASAAS_API_KEY.substring(0, 5) + '...');
    console.log('URL da API Asaas:', ASAAS_API_URL);

    // Criar pagamento PIX no Asaas
    const paymentData = {
      customer: customerId,
      billingType: 'PIX',
      value: parseFloat(value),
      dueDate: new Date().toISOString().split('T')[0], // Data atual
      description: description || 'Pagamento RunCash',
      externalReference: 'PIX-' + Date.now()
    };

    console.log('Dados do pagamento a ser criado:', paymentData);

    // Chamar API do Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/payments`,
      paymentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
          'User-Agent': 'RunCash/1.0'
        }
      }
    );

    console.log('Resposta do Asaas:', response.data);

    // Conectar ao MongoDB e salvar informações
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    // Salvar informações do pagamento
    const paymentsCollection = db.collection('payments');
    const paymentResult = await paymentsCollection.insertOne({
      asaasPaymentId: response.data.id,
      customerId: customerId,
      value: parseFloat(value),
      billingType: 'PIX',
      status: response.data.status,
      description: description || 'Pagamento RunCash',
      createdAt: new Date(),
      paymentData: response.data
    });

    console.log('Pagamento salvo no MongoDB:', paymentResult);

    // Obter QR Code PIX
    const pixResponse = await axios.get(
      `${ASAAS_API_URL}/payments/${response.data.id}/pixQrCode`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
          'User-Agent': 'RunCash/1.0'
        }
      }
    );

    console.log('QR Code PIX obtido:', pixResponse.data);

    // Retornar dados do pagamento e informações do PIX
    return res.status(200).json({
      success: true,
      payment: response.data,
      pix: pixResponse.data
    });
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error);
    
    let errorMessage = 'Erro ao processar pagamento PIX';
    let statusCode = 500;
    
    if (error.response) {
      console.error('Erro da API Asaas:', error.response.data);
      errorMessage = `Erro da API Asaas: ${JSON.stringify(error.response.data)}`;
      statusCode = error.response.status;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return res.status(statusCode).json({ error: errorMessage });
  } finally {
    // Fechar conexão com MongoDB
    if (client) {
      await client.close();
      console.log('Conexão com MongoDB fechada');
    }
  }
} 