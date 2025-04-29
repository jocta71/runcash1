// Usando interfaces genéricas em vez de Next.js específicas
interface ApiRequest {
  method: string;
  query: {
    subscriptionId?: string;
    _t?: string;
  };
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
}

interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  netValue: number;
  description?: string;
  billingType: string;
  invoiceUrl?: string;
  dueDate: string;
  originalDueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  installment?: string;
  confirmedDate?: string;
  paymentLink?: string;
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
    const { subscriptionId } = req.query;

    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'subscriptionId é obrigatório' 
      });
    }

    console.log(`[API] Buscando pagamentos para assinatura: ${subscriptionId}`);

    // Buscar pagamentos usando a API do Asaas
    const payments = await fetchPaymentsFromAsaas(subscriptionId as string);

    // Retornar os pagamentos encontrados
    return res.status(200).json({
      success: true,
      payments: payments
    });
  } catch (error) {
    console.error('[API] Erro ao buscar pagamentos:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar pagamentos' 
    });
  }
}

// Função para buscar pagamentos da API do Asaas
async function fetchPaymentsFromAsaas(subscriptionId: string): Promise<AsaasPayment[]> {
  try {
    // Obter API key do ambiente
    const apiKey = process.env.ASAAS_API_KEY || '';
    
    if (!apiKey) {
      console.error('[API] ASAAS_API_KEY não configurada');
      throw new Error('ASAAS_API_KEY não configurada');
    }

    // Determinar o ambiente (sandbox ou produção)
    const baseUrl = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    
    // Construir URL para buscar pagamentos da assinatura
    const url = `${baseUrl}/payments?subscription=${subscriptionId}`;
    
    console.log(`[API] Buscando pagamentos em: ${url}`);

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
      console.error(`[API] Erro ao buscar pagamentos: ${response.status}`, errorData);
      throw new Error(`Erro na API Asaas: ${response.status}`);
    }

    // Processar resposta
    const data = await response.json();
    
    if (data && data.data && Array.isArray(data.data)) {
      console.log(`[API] ${data.data.length} pagamentos encontrados para assinatura ${subscriptionId}`);
      return data.data as AsaasPayment[];
    }
    
    return [];
  } catch (error) {
    console.error('[API] Erro ao buscar pagamentos da API Asaas:', error);
    throw error;
  }
} 