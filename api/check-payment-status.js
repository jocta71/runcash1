import { MongoClient } from 'mongodb';
import axios from 'axios';

const MONGODB_URI = process.env.MONGODB_URI;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { paymentId } = req.query;

  if (!paymentId) {
    res.status(400).json({ error: 'ID do pagamento é obrigatório' });
    return;
  }

  let client;

  try {
    // Conectar ao MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();

    // Buscar pagamento no Asaas
    const asaasResponse = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}`,
      {
        headers: {
          'access_token': ASAAS_API_KEY,
          'User-Agent': 'RunCash/1.0'
        }
      }
    );

    const payment = asaasResponse.data;

    // Atualizar status no MongoDB
    await db.collection('payments').updateOne(
      { asaasId: paymentId },
      { 
        $set: { 
          status: payment.status,
          lastChecked: new Date(),
          value: payment.value,
          netValue: payment.netValue,
          billingType: payment.billingType,
          confirmedDate: payment.confirmedDate,
          customerName: payment.customer.name,
          customerEmail: payment.customer.email,
          invoiceUrl: payment.invoiceUrl,
          dueDate: payment.dueDate
        }
      },
      { upsert: true }
    );

    // Retornar status atualizado
    res.status(200).json({
      status: payment.status,
      value: payment.value,
      netValue: payment.netValue,
      billingType: payment.billingType,
      confirmedDate: payment.confirmedDate,
      customerName: payment.customer.name,
      customerEmail: payment.customer.email,
      invoiceUrl: payment.invoiceUrl,
      dueDate: payment.dueDate
    });

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Pagamento não encontrado' });
    } else {
      res.status(500).json({ error: 'Erro ao verificar status do pagamento' });
    }
  } finally {
    if (client) {
      await client.close();
    }
  }
} 