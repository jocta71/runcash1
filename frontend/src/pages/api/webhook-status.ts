// Usando interfaces genéricas em vez de Next.js específicas
interface ApiRequest {
  method: string;
  query: {
    checkAsaas?: string;
  };
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
}

interface WebhookStatus {
  localEvents: number;
  lastEvent?: {
    event: string;
    timestamp: string;
    paymentId?: string;
    subscriptionId?: string;
  };
  subscriptionCacheSize: number;
  paymentCacheSize: number;
  asaasStatus?: {
    active?: boolean;
    queueStatus?: string;
    error?: string;
  };
}

// Função principal do handler da API
export default async function handler(
  req: ApiRequest,
  res: ApiResponse
) {
  // Apenas permitir método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status: WebhookStatus = {
      localEvents: 0,
      subscriptionCacheSize: 0,
      paymentCacheSize: 0
    };

    // Verificar eventos locais
    const webhookHistory = getLocalStorage('asaas_webhook_history');
    if (webhookHistory && Array.isArray(webhookHistory)) {
      status.localEvents = webhookHistory.length;
      if (webhookHistory.length > 0) {
        status.lastEvent = webhookHistory[webhookHistory.length - 1];
      }
    }

    // Verificar caches
    const subscriptionCache = getLocalStorage('asaas_subscription_cache');
    if (subscriptionCache && typeof subscriptionCache === 'object') {
      status.subscriptionCacheSize = Object.keys(subscriptionCache).length;
    }

    // Contar entradas no cache de pagamentos com prefixo asaas_payment_
    let paymentCount = 0;
    for (const key in memoryStorage) {
      if (key.startsWith('asaas_payment_')) {
        paymentCount++;
      }
    }
    status.paymentCacheSize = paymentCount;

    // Verificar status dos webhooks na Asaas se solicitado
    const { checkAsaas } = req.query;
    if (checkAsaas === 'true') {
      try {
        status.asaasStatus = await checkAsaasWebhookStatus();
      } catch (error) {
        console.error('[API] Erro ao verificar status do webhook na Asaas:', error);
        status.asaasStatus = {
          error: 'Não foi possível verificar o status do webhook na Asaas'
        };
      }
    }

    return res.status(200).json({
      success: true,
      status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Erro ao verificar status dos webhooks:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao verificar status dos webhooks' 
    });
  }
}

// Função para verificar o status dos webhooks na Asaas
async function checkAsaasWebhookStatus(): Promise<any> {
  try {
    // Obter API key do ambiente
    const apiKey = process.env.ASAAS_API_KEY || '';
    
    if (!apiKey) {
      console.error('[API] ASAAS_API_KEY não configurada');
      throw new Error('ASAAS_API_KEY não configurada');
    }

    // Determinar o ambiente (sandbox ou produção)
    const baseUrl = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    
    // Construir URL para verificar webhooks
    const url = `${baseUrl}/webhooks`;
    
    // Fazer requisição para a API do Asaas
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey
      }
    });

    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[API] Erro ao verificar webhooks: ${response.status}`, errorData);
      throw new Error(`Erro na API Asaas: ${response.status}`);
    }

    // Processar resposta
    const data = await response.json();
    
    if (data && data.data && Array.isArray(data.data)) {
      // Verificar o webhook configurado
      const ourWebhook = data.data.find((webhook: any) => 
        webhook.url === 'https://runcashh11.vercel.app/api/asaas-webhook'
      );

      if (ourWebhook) {
        return {
          active: ourWebhook.enabled,
          queueStatus: ourWebhook.interruptionStatus || 'OK',
          id: ourWebhook.id,
          url: ourWebhook.url
        };
      } else {
        return {
          error: 'Webhook não encontrado para o endpoint configurado'
        };
      }
    }
    
    return {
      error: 'Nenhum webhook configurado'
    };
  } catch (error) {
    console.error('[API] Erro ao verificar webhooks na API Asaas:', error);
    throw error;
  }
}

// Funções auxiliares para manipulação de localStorage na API
let memoryStorage: Record<string, any> = {};

function getLocalStorage(key: string): any {
  try {
    return memoryStorage[key] ? JSON.parse(memoryStorage[key]) : null;
  } catch (error) {
    console.error(`[API] Erro ao ler ${key} do armazenamento:`, error);
    return null;
  }
} 