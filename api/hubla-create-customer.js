const axios = require('axios');

// API handler para o Vercel Serverless
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter a chave da API da Hubla
    const apiKey = process.env.HUBLA_API_KEY;
    
    // Verificar se a chave da API está configurada
    if (!apiKey) {
      console.error('HUBLA_API_KEY não está configurada');
      return res.status(500).json({ error: 'Erro de configuração: HUBLA_API_KEY não encontrada' });
    }
    
    // Logar os primeiros caracteres da chave (para depuração)
    console.log(`Usando HUBLA_API_KEY: ${apiKey.substring(0, 5)}...`);

    // Obter dados do cliente do corpo da requisição
    const { name, email, cpfCnpj, mobilePhone } = req.body;

    // Validar campos obrigatórios
    if (!name || !email || !cpfCnpj) {
      console.error('Dados de cliente incompletos:', { name, email, cpfCnpj });
      return res.status(400).json({ error: 'Dados incompletos: nome, e-mail e CPF/CNPJ são obrigatórios' });
    }

    // Formatar CPF/CNPJ (remover caracteres especiais)
    const formattedCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');

    // Formatar telefone (remover caracteres especiais) se fornecido
    const formattedPhone = mobilePhone ? mobilePhone.replace(/[^\d]/g, '') : undefined;

    // Preparar dados do cliente para a Hubla
    const customerData = {
      name,
      email,
      document: formattedCpfCnpj,
      phone: formattedPhone
    };

    console.log(`Criando cliente na Hubla: ${name} (${email})`);

    // Fazer requisição para API da Hubla
    const response = await axios.post(
      'https://api.hubla.com.br/v1/customers',
      customerData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Verificar se a requisição foi bem-sucedida
    if (response.status === 200 || response.status === 201) {
      console.log(`Cliente criado/atualizado com sucesso: ${response.data.id}`);
      
      // Retornar o ID do cliente
      return res.status(200).json({ 
        customerId: response.data.id,
        message: 'Cliente criado com sucesso'
      });
    } else {
      console.error('Resposta inesperada da Hubla:', response.status, response.data);
      return res.status(response.status).json({
        error: 'Erro ao criar cliente na Hubla',
        details: response.data
      });
    }
  } catch (error) {
    // Tratar erros de API
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com um status fora do intervalo 2xx
      console.error('Erro na API da Hubla:', error.response.status, error.response.data);
      
      // Verificar se o cliente já existe
      if (error.response.status === 409 && error.response.data && error.response.data.id) {
        // Cliente já existe, retornar o ID existente
        console.log(`Cliente já existe: ${error.response.data.id}`);
        return res.status(200).json({ 
          customerId: error.response.data.id,
          message: 'Cliente já existe na Hubla'
        });
      }
      
      return res.status(error.response.status).json({
        error: 'Erro ao criar cliente na Hubla',
        details: error.response.data
      });
    } else if (error.request) {
      // A requisição foi feita mas nenhuma resposta foi recebida
      console.error('Sem resposta da API da Hubla:', error.request);
      return res.status(500).json({ error: 'Erro de conexão com a API da Hubla' });
    } else {
      // Algo aconteceu na configuração da requisição que causou um erro
      console.error('Erro ao configurar requisição para a Hubla:', error.message);
      return res.status(500).json({ error: 'Erro interno ao criar cliente', details: error.message });
    }
  }
}; 