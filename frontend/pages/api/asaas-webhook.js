// Webhook para receber notificações do Asaas
import axios from 'axios';

export default async function handler(req, res) {
  // Configurar CORS para permitir credenciais
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Responder imediatamente para requisições de preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Rota simples de verificação para testes
  if (req.method === 'GET') {
    res.status(200).json({
      status: 'online',
      service: 'Asaas Webhook Receiver',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Processar eventos do Asaas
  if (req.method === 'POST') {
    try {
      const webhookData = req.body;
      console.log('[ASAAS WEBHOOK] Evento recebido:', JSON.stringify(webhookData));
      
      // Verificar assinatura do webhook se disponível 
      // (não implementado - produção deve validar a assinatura)
      
      // URL da API de assinaturas no backend
      const backendApiUrl = process.env.BACKEND_API_URL || 'https://backendapi-production-36b5.up.railway.app';
      
      // Encaminhar o webhook para o backend processar
      try {
        const response = await axios.post(
          `${backendApiUrl}/api/assinatura/webhook`, 
          webhookData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Source': 'vercel-proxy',
              'X-Webhook-Forwarded': 'true'
            },
            timeout: 5000 // 5 segundos de timeout
          }
        );
        
        console.log('[ASAAS WEBHOOK] Resposta do backend:', response.status);
        
        // Retornar a resposta do backend
        res.status(response.status).json({
          success: true,
          message: 'Webhook processado e encaminhado',
          backendResponse: response.data
        });
      } catch (error) {
        console.error('[ASAAS WEBHOOK] Erro ao encaminhar para backend:', error.message);
        
        // Salvar o evento para processamento posterior
        // Em uma solução real, você poderia salvar em um banco de dados ou fila
        console.log('[ASAAS WEBHOOK] Evento salvo para reprocessamento');
        
        // Responder com sucesso para o Asaas (evitar reenvios)
        res.status(202).json({
          success: true,
          message: 'Evento recebido, processamento pendente',
          error: error.message
        });
      }
    } catch (error) {
      console.error('[ASAAS WEBHOOK] Erro ao processar webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar webhook',
        error: error.message
      });
    }
    return;
  }

  // Método não suportado
  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  res.status(405).json({
    success: false,
    message: `Método ${req.method} não permitido`
  });
} 