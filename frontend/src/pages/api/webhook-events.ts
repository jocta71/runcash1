// Usando interfaces genéricas em vez de Next.js específicas
interface ApiRequest {
  method: string;
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
  // Apenas permitir método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Buscar histórico de eventos do webhook
    const events = getLocalStorage('asaas_webhook_history') || [];
    
    return res.status(200).json({
      success: true,
      events: events
    });
  } catch (error) {
    console.error('[API] Erro ao buscar eventos de webhook:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar eventos de webhook' 
    });
  }
}

// Funções auxiliares para manipulação de localStorage (simulado para API)
let memoryStorage: Record<string, any> = {};

function getLocalStorage(key: string): any {
  try {
    return memoryStorage[key] ? JSON.parse(memoryStorage[key]) : null;
  } catch (error) {
    console.error(`[API] Erro ao ler ${key} do armazenamento:`, error);
    return null;
  }
} 