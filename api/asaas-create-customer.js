// Endpoint de criação de cliente usando MongoDB
import { MongoClient } from 'mongodb';
import axios from 'axios';

const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENV = process.env.ASAAS_ENV || 'sandbox';

const ASAAS_API_URL = ASAAS_ENV === 'sandbox' 
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

export default async function handler(req, res) {
  console.log('=== INÍCIO DA REQUISIÇÃO ===');
  console.log('Método:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responder imediatamente para requisições OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verificar se é uma requisição POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { name, email, cpfCnpj, phone } = req.body;

    if (!name || !email || !cpfCnpj) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Conectar ao MongoDB
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('runcash');

    // Verificar se cliente já existe
    const existingCustomer = await db.collection('customers').findOne({ cpfCnpj });
    if (existingCustomer) {
      await client.close();
      return res.status(200).json({
        id: existingCustomer.asaas_id,
        message: 'Cliente já existe'
      });
    }

    // Criar cliente no Asaas
    const response = await axios.post(
      `${ASAAS_API_URL}/customers`,
      {
        name,
        email,
        cpfCnpj,
        phone,
        notificationDisabled: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
          'User-Agent': 'RunCash/1.0'
        }
      }
    );

    // Salvar cliente no MongoDB
    await db.collection('customers').insertOne({
      asaas_id: response.data.id,
      name,
      email,
      cpfCnpj,
      phone,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await client.close();

    return res.status(200).json({
      id: response.data.id,
      message: 'Cliente criado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar cliente:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Erro ao criar cliente',
      details: error.response?.data || error.message
    });
  }
} 