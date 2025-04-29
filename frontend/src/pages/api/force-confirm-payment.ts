// Usando interfaces genéricas em vez de Next.js específicas
interface ApiRequest {
  method: string;
  body: {
    subscriptionId: string;
    customerId: string;
    paymentId?: string;
    adminToken: string;
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
    const { subscriptionId, customerId, paymentId, adminToken } = req.body;

    // Verificação básica de segurança - comparar com token administrativo
    const validToken = process.env.ADMIN_API_TOKEN || 'admin_secure_token';
    if (adminToken !== validToken) {
      console.error('[API] Tentativa de confirmação manual com token inválido');
      return res.status(401).json({ 
        success: false, 
        error: 'Token administrativo inválido' 
      });
    }

    if (!subscriptionId || !customerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'subscriptionId e customerId são obrigatórios' 
      });
    }

    console.log(`[API] Confirmação manual de pagamento: Assinatura=${subscriptionId}, Cliente=${customerId}`);

    // Armazenar no localStorage simulado da API
    try {
      // Criar cache de assinatura
      const subscriptionCache = getLocalStorage('asaas_subscription_cache') || {};
      
      // Atualizar a entrada para este cliente
      subscriptionCache[customerId] = {
        id: subscriptionId,
        status: 'active',
        updatedAt: new Date().toISOString(),
        hasConfirmedPayment: true
      };
      
      // Salvar cache atualizado
      setLocalStorage('asaas_subscription_cache', subscriptionCache);

      // Se foi fornecido um paymentId, atualizar também o cache de pagamento
      if (paymentId) {
        const cacheData = {
          id: paymentId,
          status: 'confirmed',
          customerId: customerId,
          updatedAt: new Date().toISOString(),
          timestamp: Date.now()
        };
        
        // Salvar no cache específico do pagamento
        setLocalStorage(`asaas_payment_${paymentId}`, JSON.stringify(cacheData));
        
        // Atualizar cache global de pagamentos do usuário
        const userPayments = getLocalStorage(`asaas_user_payments_${customerId}`) || {};
        userPayments[paymentId] = cacheData;
        setLocalStorage(`asaas_user_payments_${customerId}`, userPayments);
      }
      
      console.log(`[API] Confirmação manual de pagamento realizada com sucesso`);
      
      return res.status(200).json({
        success: true,
        message: 'Pagamento confirmado manualmente com sucesso'
      });
    } catch (error) {
      console.error('[API] Erro ao salvar confirmação manual:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao processar confirmação manual' 
      });
    }
  } catch (error) {
    console.error('[API] Erro durante confirmação manual:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
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

function setLocalStorage(key: string, value: any): void {
  try {
    memoryStorage[key] = typeof value === 'string' ? value : JSON.stringify(value);
  } catch (error) {
    console.error(`[API] Erro ao salvar ${key} no armazenamento:`, error);
  }
} 