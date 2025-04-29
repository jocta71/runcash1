// Usando interfaces genéricas em vez de Next.js específicas
interface ApiRequest {
  method: string;
  body: {
    adminToken: string;
    webhookId?: string;
  };
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
}

// Função principal do handler da API
export default async function handler(
  req: ApiRequest,
  res: ApiResponse
) {
  // Apenas permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { adminToken, webhookId } = req.body;

    // Verificação básica de segurança - comparar com token administrativo
    const validToken = process.env.ADMIN_API_TOKEN || 'admin_secure_token';
    if (adminToken !== validToken) {
      console.error('[API] Tentativa de reativação de webhook com token inválido');
      return res.status(401).json({ 
        success: false, 
        error: 'Token administrativo inválido' 
      });
    }
    
    // Obter API key do ambiente
    const apiKey = process.env.ASAAS_API_KEY || '';
    
    if (!apiKey) {
      console.error('[API] ASAAS_API_KEY não configurada');
      return res.status(500).json({ 
        success: false, 
        error: 'ASAAS_API_KEY não configurada' 
      });
    }

    // Determinar o ambiente (sandbox ou produção)
    const baseUrl = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    
    // Se não foi fornecido um webhookId, primeiro buscar os webhooks
    let webhookToReactivate = webhookId;
    
    if (!webhookToReactivate) {
      try {
        // Buscar os webhooks existentes
        const listResponse = await fetch(`${baseUrl}/webhooks`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'access_token': apiKey
          }
        });
        
        if (!listResponse.ok) {
          throw new Error(`Erro ao buscar webhooks: ${listResponse.status}`);
        }
        
        const listData = await listResponse.json();
        
        if (listData && listData.data && Array.isArray(listData.data)) {
          // Procurar o webhook com a URL correta
          const webhook = listData.data.find((wh: any) => 
            wh.url === 'https://runcashh11.vercel.app/api/asaas-webhook'
          );
          
          if (webhook) {
            webhookToReactivate = webhook.id;
            console.log(`[API] Webhook encontrado para reativação: ${webhookToReactivate}`);
          } else {
            return res.status(404).json({ 
              success: false, 
              error: 'Webhook não encontrado' 
            });
          }
        }
      } catch (error) {
        console.error('[API] Erro ao buscar webhooks:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Erro ao buscar webhooks' 
        });
      }
    }
    
    // Reativar webhook
    try {
      // Enviar requisição para reativar a fila
      const reactivateUrl = `${baseUrl}/webhook/${webhookToReactivate}/reactivate`;
      
      console.log(`[API] Tentando reativar webhook em: ${reactivateUrl}`);
      
      const reactivateResponse = await fetch(reactivateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': apiKey
        }
      });
      
      if (!reactivateResponse.ok) {
        const errorData = await reactivateResponse.json();
        throw new Error(`Erro ao reativar webhook: ${JSON.stringify(errorData)}`);
      }
      
      console.log(`[API] Webhook reativado com sucesso: ${webhookToReactivate}`);
      
      return res.status(200).json({
        success: true,
        message: 'Webhook reativado com sucesso',
        webhookId: webhookToReactivate
      });
    } catch (error) {
      console.error('[API] Erro ao reativar webhook:', error);
      return res.status(500).json({ 
        success: false, 
        error: `Erro ao reativar webhook: ${error.message}` 
      });
    }
  } catch (error) {
    console.error('[API] Erro durante processamento:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
} 