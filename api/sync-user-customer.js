// API para sincronizar um usuário existente com um cliente no Asaas
import axios from 'axios';
import { connectToDatabase } from '../config/mongodb';
import { ObjectId } from 'mongodb';
import Cors from 'cors';

// Inicializa o middleware CORS
const cors = Cors({
  methods: ['POST', 'OPTIONS'],
  origin: '*',
});

// Helper para o middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // Executa o middleware de CORS
  await runMiddleware(req, res, cors);

  // Certifica-se de que seja uma requisição POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { userId, email } = req.body;

  if (!userId || !email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Parâmetros obrigatórios ausentes: userId, email' 
    });
  }

  try {
    console.log(`Sincronizando usuário ${userId} com o Asaas`);
    
    // Conecta ao banco de dados
    const { db } = await connectToDatabase();
    
    // Busca o usuário no banco de dados
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(userId) 
    });

    if (!user) {
      console.log(`Usuário ${userId} não encontrado`);
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      });
    }

    // Verifica se o usuário já possui um asaasCustomerId
    if (user.asaasCustomerId) {
      console.log(`Usuário ${userId} já possui um Asaas Customer ID: ${user.asaasCustomerId}`);
      
      // Tenta verificar se o cliente existe no Asaas
      try {
        const verificationResponse = await axios.get(
          `${process.env.ASAAS_API_URL}/customers/${user.asaasCustomerId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'access_token': process.env.ASAAS_API_KEY
            }
          }
        );
        
        if (verificationResponse.status === 200) {
          console.log(`Cliente ${user.asaasCustomerId} verificado no Asaas`);
          return res.status(200).json({ 
            success: true, 
            asaasCustomerId: user.asaasCustomerId,
            message: 'Cliente já existente e validado no Asaas'
          });
        }
      } catch (error) {
        console.log(`Erro ao verificar cliente no Asaas: ${error.message}`);
        // Continua com a criação de um novo cliente se a verificação falhar
      }
    }

    // Cria um novo cliente no Asaas
    const sanitizeName = (inputName) => {
      if (!inputName || inputName.length < 3) {
        return email.split('@')[0]; // Usa parte do email como fallback
      }
      
      // Detecta padrões repetitivos como "aaaaaaa" ou "ffffff"
      const invalidPattern = /^(.)\1{5,}$/;
      if (invalidPattern.test(inputName)) {
        console.log(`Nome inválido detectado: "${inputName}". Usando parte do email.`);
        return email.split('@')[0];
      }
      
      // Remove caracteres especiais e limita o tamanho (Asaas aceita até 60 caracteres)
      const specialCharsPattern = /[^a-zA-Z0-9\s\-_.áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g;
      return (inputName || '')
        .replace(specialCharsPattern, ' ')
        .trim()
        .substring(0, 60) || email.split('@')[0];
    };

    const name = sanitizeName(req.body.name || user.username);
    console.log(`Nome sanitizado para uso no Asaas: "${name}"`);
    
    const customerPayload = {
      name,
      email,
      externalReference: userId
    };

    console.log('Criando cliente no Asaas:', customerPayload);

    try {
      const createCustomerResponse = await axios.post(
        `${process.env.ASAAS_API_URL}/customers`,
        customerPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'access_token': process.env.ASAAS_API_KEY
          }
        }
      );

      if (createCustomerResponse.status !== 200) {
        console.log('Falha na criação do cliente no Asaas', createCustomerResponse.data);
        return res.status(500).json({ 
          success: false, 
          error: 'Falha ao criar o cliente no Asaas' 
        });
      }

      const asaasCustomerId = createCustomerResponse.data.id;
      console.log(`Cliente criado no Asaas com ID: ${asaasCustomerId}`);

      // Atualiza o usuário com o ID do cliente Asaas
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { asaasCustomerId } }
      );

      // Retorna o resultado
      return res.status(200).json({
        success: true,
        asaasCustomerId,
        message: 'Usuário sincronizado com sucesso'
      });
    } catch (asaasError) {
      console.error('Erro na API do Asaas:', asaasError.response?.data || asaasError.message);
      return res.status(500).json({ 
        success: false, 
        error: `Erro na API do Asaas: ${asaasError.response?.data?.errors?.description || asaasError.message}` 
      });
    }

  } catch (error) {
    console.error('Erro ao sincronizar usuário com Asaas:', error);
    return res.status(500).json({ 
      success: false, 
      error: `Erro interno: ${error.message}` 
    });
  }
} 