import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// Interface para o status do webhook
interface WebhookStatus {
  localEvents: number;
  lastEvent?: {
    event: string;
    timestamp: string;
    paymentId?: string;
    subscriptionId?: string;
    customerId?: string;
  };
  subscriptionCacheSize: number;
  paymentCacheSize: number;
  asaasStatus?: {
    active?: boolean;
    queueStatus?: string;
    error?: string;
    id?: string;
    url?: string;
  };
}

// Interface para eventos de webhook
interface WebhookEvent {
  event: string;
  eventId?: string;
  paymentId?: string;
  subscriptionId?: string;
  customerId?: string;
  status?: string;
  timestamp: string;
}

// Interface para tentativas de webhook
interface WebhookAttempt {
  method: string;
  path: string;
  timestamp: string;
}

// Componente principal
export default function WebhookMonitor() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [attempts, setAttempts] = useState<WebhookAttempt[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  
  const router = useRouter();
  
  // Verificar autenticação ao iniciar
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setAdminToken(token);
    }
  }, []);
  
  // Carregar status do webhook
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/webhook-status?checkAsaas=true');
      if (!response.ok) {
        throw new Error(`Erro ao buscar status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.status) {
        setStatus(data.status);
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (err) {
      setError(err.message || 'Erro desconhecido ao buscar status');
    } finally {
      setLoading(false);
    }
  };
  
  // Carregar eventos do webhook
  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/webhook-events');
      if (!response.ok) {
        throw new Error(`Erro ao buscar eventos: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.events && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    }
  };
  
  // Carregar tentativas de webhook
  const fetchAttempts = async () => {
    try {
      const response = await fetch('/api/webhook-attempts');
      if (!response.ok) {
        throw new Error(`Erro ao buscar tentativas: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.attempts && Array.isArray(data.attempts)) {
        setAttempts(data.attempts);
      }
    } catch (err) {
      console.error('Erro ao buscar tentativas:', err);
    }
  };
  
  // Função para confirmação manual de pagamento
  const confirmPayment = async () => {
    if (!customerId || !subscriptionId) {
      setMessage({
        text: 'ID do cliente e ID da assinatura são obrigatórios',
        type: 'error'
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/force-confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          subscriptionId,
          paymentId: paymentId || undefined,
          adminToken
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMessage({
          text: 'Pagamento confirmado manualmente com sucesso!',
          type: 'success'
        });
        
        // Recarregar status
        fetchStatus();
      } else {
        setMessage({
          text: data.error || 'Erro ao confirmar pagamento manualmente',
          type: 'error'
        });
      }
    } catch (err) {
      setMessage({
        text: err.message || 'Erro inesperado ao confirmar pagamento',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Carregar dados ao iniciar
  useEffect(() => {
    if (adminToken) {
      fetchStatus();
      fetchEvents();
      fetchAttempts();
    }
  }, [adminToken]);
  
  // Login de admin
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('admin_token', adminToken);
    fetchStatus();
    fetchEvents();
    fetchAttempts();
  };
  
  // Reativar webhook
  const reactivateWebhook = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/reactivate-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminToken
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMessage({
          text: 'Webhook reativado com sucesso!',
          type: 'success'
        });
        
        // Recarregar status
        fetchStatus();
      } else {
        setMessage({
          text: data.error || 'Erro ao reativar webhook',
          type: 'error'
        });
      }
    } catch (err) {
      setMessage({
        text: err.message || 'Erro inesperado ao reativar webhook',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Tela de login
  if (!adminToken) {
    return (
      <div className="container mx-auto p-4">
        <Head>
          <title>Área Admin - Login</title>
        </Head>
        <h1 className="text-2xl font-bold mb-4">Login Admin</h1>
        <form onSubmit={handleLogin} className="max-w-md">
          <div className="mb-4">
            <label className="block mb-2">Token de Admin:</label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button 
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>Monitor de Webhooks</title>
      </Head>
      
      <h1 className="text-2xl font-bold mb-4">Monitor de Webhooks</h1>
      
      {/* Mensagem de sucesso/erro */}
      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
          <button 
            className="ml-4 text-sm underline"
            onClick={() => setMessage(null)}
          >
            Fechar
          </button>
        </div>
      )}
      
      {/* Ferramentas */}
      <div className="mb-8 p-4 border rounded bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Ferramentas</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Confirmação manual de pagamento */}
          <div className="p-4 border rounded bg-white">
            <h3 className="font-semibold mb-2">Confirmar Pagamento Manualmente</h3>
            <div className="mb-2">
              <label className="block mb-1 text-sm">ID do Cliente (customerId):</label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full p-2 border rounded text-sm"
                placeholder="Ex: cus_000006669032"
              />
            </div>
            <div className="mb-2">
              <label className="block mb-1 text-sm">ID da Assinatura (subscriptionId):</label>
              <input
                type="text"
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                className="w-full p-2 border rounded text-sm"
                placeholder="Ex: sub_c6fr5sug2yhln0y4"
              />
            </div>
            <div className="mb-2">
              <label className="block mb-1 text-sm">ID do Pagamento (opcional):</label>
              <input
                type="text"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="w-full p-2 border rounded text-sm"
                placeholder="Ex: pay_123456789"
              />
            </div>
            <button
              onClick={confirmPayment}
              disabled={loading}
              className="bg-green-500 text-white px-3 py-1 rounded text-sm"
            >
              {loading ? 'Processando...' : 'Confirmar Pagamento'}
            </button>
          </div>
          
          {/* Reativar webhook */}
          <div className="p-4 border rounded bg-white">
            <h3 className="font-semibold mb-2">Reativar Webhook Asaas</h3>
            <p className="text-sm mb-4">
              Use esta opção se a fila de webhooks estiver pausada no painel da Asaas.
            </p>
            <button
              onClick={reactivateWebhook}
              disabled={loading}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
            >
              {loading ? 'Processando...' : 'Reativar Webhook'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Status do webhook */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Status do Webhook</h2>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="bg-gray-200 px-3 py-1 rounded text-sm"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 text-red-800 p-4 mb-4 rounded">
            {error}
          </div>
        )}
        
        {status ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded">
              <h3 className="font-semibold mb-2">Cache Local</h3>
              <ul className="text-sm">
                <li className="mb-1">
                  <span className="font-medium">Eventos armazenados:</span> {status.localEvents}
                </li>
                <li className="mb-1">
                  <span className="font-medium">Assinaturas em cache:</span> {status.subscriptionCacheSize}
                </li>
                <li className="mb-1">
                  <span className="font-medium">Pagamentos em cache:</span> {status.paymentCacheSize}
                </li>
                {status.lastEvent && (
                  <li className="mb-1">
                    <span className="font-medium">Último evento:</span> {status.lastEvent.event} ({new Date(status.lastEvent.timestamp).toLocaleString()})
                  </li>
                )}
              </ul>
            </div>
            
            <div className="p-4 border rounded">
              <h3 className="font-semibold mb-2">Status na Asaas</h3>
              {status.asaasStatus ? (
                <ul className="text-sm">
                  {status.asaasStatus.active !== undefined && (
                    <li className="mb-1">
                      <span className="font-medium">Ativo:</span> {status.asaasStatus.active ? 'Sim' : 'Não'}
                    </li>
                  )}
                  {status.asaasStatus.queueStatus && (
                    <li className="mb-1">
                      <span className="font-medium">Status da fila:</span> {status.asaasStatus.queueStatus}
                    </li>
                  )}
                  {status.asaasStatus.id && (
                    <li className="mb-1">
                      <span className="font-medium">ID do webhook:</span> {status.asaasStatus.id}
                    </li>
                  )}
                  {status.asaasStatus.url && (
                    <li className="mb-1">
                      <span className="font-medium">URL:</span> {status.asaasStatus.url}
                    </li>
                  )}
                  {status.asaasStatus.error && (
                    <li className="mb-1 text-red-500">
                      <span className="font-medium">Erro:</span> {status.asaasStatus.error}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Informações não disponíveis</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Carregando informações de status...</p>
        )}
      </div>
      
      {/* Eventos recebidos */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Eventos Recebidos</h2>
          <button
            onClick={fetchEvents}
            className="bg-gray-200 px-3 py-1 rounded text-sm"
          >
            Atualizar
          </button>
        </div>
        
        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Evento</th>
                  <th className="p-2 text-left">ID</th>
                  <th className="p-2 text-left">Assinatura</th>
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{event.event}</td>
                    <td className="p-2">{event.eventId || 'N/A'}</td>
                    <td className="p-2">{event.subscriptionId || 'N/A'}</td>
                    <td className="p-2">{event.customerId || 'N/A'}</td>
                    <td className="p-2">{new Date(event.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">Nenhum evento recebido</p>
        )}
      </div>
      
      {/* Tentativas de webhook */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Tentativas de Webhook</h2>
          <button
            onClick={fetchAttempts}
            className="bg-gray-200 px-3 py-1 rounded text-sm"
          >
            Atualizar
          </button>
        </div>
        
        {attempts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Método</th>
                  <th className="p-2 text-left">Caminho</th>
                  <th className="p-2 text-left">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{attempt.method}</td>
                    <td className="p-2">{attempt.path}</td>
                    <td className="p-2">{new Date(attempt.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">Nenhuma tentativa registrada</p>
        )}
      </div>
    </div>
  );
} 