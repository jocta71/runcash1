/**
 * Handler para o webhook do Asaas (versão simplificada)
 * 
 * Esta versão foca em receber e validar os eventos sem depender
 * da conexão com MongoDB, para diagnosticar e resolver problemas.
 */

// Importar body-parser para processar o corpo da requisição
const bodyParser = require('body-parser');

// Criar middleware para parsear JSON
const jsonParser = bodyParser.json();

// Função para processar o corpo da requisição com promessas
const parseBody = (req, res) => {
  return new Promise((resolve, reject) => {
    jsonParser(req, res, (error) => {
      if (error) {
        console.error('Erro ao processar corpo da requisição:', error);
        return reject(error);
      }
      resolve();
    });
  });
};

// Handler principal do webhook
module.exports = async (req, res) => {
  // Configurar CORS para aceitar qualquer origem
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Para requisições GET (verificação do webhook)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Webhook endpoint ativo. Use POST para eventos do Asaas.',
      timestamp: new Date().toISOString() 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
  }

  try {
    // Log dos headers para debug
    console.log('Headers recebidos:', JSON.stringify(req.headers));
    
    // Processar corpo da requisição se necessário
    if (!req.body || typeof req.body === 'string') {
      try {
        await parseBody(req, res);
        console.log('Corpo da requisição processado pelo body-parser');
      } catch (parseError) {
        console.error('Falha ao processar corpo com body-parser:', parseError.message);
      }
    }
    
    // Obter dados do webhook
    let webhookData = req.body;
    
    // Verificar se o corpo é válido
    if (!webhookData || typeof webhookData !== 'object') {
      console.warn('Corpo da requisição inválido, usando objeto vazio');
      webhookData = {};
    }
    
    // Log do corpo recebido
    console.log('Corpo da requisição processado:', JSON.stringify(webhookData));
    
    // Confirmação de recebimento imediata para evitar timeout
    const response = {
      success: true,
      message: 'Evento recebido com sucesso',
      event: webhookData.event || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    // Registrar evento em log
    const eventType = webhookData.event || 'unknown';
    console.log(`[ASAAS WEBHOOK] Evento ${eventType} recebido e processado`);
    
    // Responder sucesso
    return res.status(200).json(response);
  } catch (error) {
    console.error('[ASAAS WEBHOOK] Erro:', error.message);
    
    // Garantir resposta mesmo com erro
    return res.status(200).json({ 
      success: true,
      error_handled: true,
      message: 'Erro durante processamento, mas evento foi recebido',
      error_message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 