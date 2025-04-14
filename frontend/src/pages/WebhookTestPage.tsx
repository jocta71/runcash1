import { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/components/ui/use-toast';

export default function WebhookTestPage() {
  const { user } = useAuth();
  const [userId, setUserId] = useState('');
  const [planId, setPlanId] = useState('basic');
  const [eventType, setEventType] = useState('NewSale');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  
  // Quando o componente montar, preencher o ID do usuário logado
  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
      console.log('ID do usuário logado:', user.id);
    }
  }, [user]);

  // Tipos de eventos suportados
  const eventTypes = [
    'test',
    'NewSale',
    'CanceledSubscription',
    'NewUser',
    'subscription.created',
    'subscription.activated'
  ];

  // Planos suportados
  const planTypes = [
    { id: 'basic', name: 'Plano Básico' },
    { id: 'pro', name: 'Plano Profissional' }
  ];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Enviando simulação para:', `/api/router/simulate-webhook`);
      
      const payload = {
        eventType,
        userId,
        planId,
        metadata: {
          userId,
          planId
        }
      };
      
      console.log('Payload:', payload);
      
      const response = await axios.post('/api/router/simulate-webhook', payload);
      
      console.log('Resposta:', response.data);
      
      setResult(response.data);
      
      toast({
        title: "Webhook simulado com sucesso",
        description: "O evento foi enviado e processado pelo servidor",
      });
    } catch (error) {
      console.error('Erro ao simular webhook:', error);
      
      setResult(
        error instanceof AxiosError 
          ? error.response?.data || { error: error.message }
          : { error: 'Erro desconhecido' }
      );
      
      toast({
        title: "Erro ao simular webhook",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Testar Integração com Webhooks Hubla</h1>
      
      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-bold mb-4">Simular Evento de Webhook</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de Evento</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-vegas-gold focus:ring-1 focus:ring-vegas-gold"
            >
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">ID do Usuário</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Digite o ID do usuário (obrigatório)"
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-vegas-gold focus:ring-1 focus:ring-vegas-gold"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Obrigatório para identificar corretamente a assinatura
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Plano</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-vegas-gold focus:ring-1 focus:ring-vegas-gold"
            >
              {planTypes.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vegas-gold text-black py-2 rounded font-medium hover:bg-vegas-gold/80 transition"
          >
            {loading ? 'Enviando...' : 'Simular Webhook'}
          </button>
        </form>
      </div>
      
      {error && (
        <div className="bg-red-900/30 border border-red-800 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Erro ao simular webhook</h3>
          <pre className="bg-black/50 p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )}
      
      {result && (
        <div className="space-y-4">
          <div className="bg-green-900/30 border border-green-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-400 mb-2">Simulação Concluída</h3>
            <p className="mb-2">
              Evento <code className="bg-black/30 px-1 py-0.5 rounded">{result.event.type}</code> enviado com sucesso.
            </p>
            <div className="mb-2">
              <h4 className="font-medium mb-1">Resposta do Webhook:</h4>
              <pre className="bg-black/50 p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(result.webhook_response, null, 2)}
              </pre>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Detalhes do Evento Simulado</h3>
            <pre className="bg-black/50 p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(result.event, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      <div className="mt-8 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-2">Como usar</h2>
        <ol className="list-decimal ml-5 space-y-2 text-sm">
          <li>Selecione o tipo de evento que deseja simular (NewSale, CanceledSubscription, etc.)</li>
          <li>Insira o ID de um usuário real do sistema para testar a integração completa</li>
          <li>Escolha o plano para simular a assinatura</li>
          <li>Clique em "Simular Webhook" para enviar o evento para processamento</li>
          <li>Verifique os logs do servidor para confirmar que o webhook foi processado corretamente</li>
        </ol>
        <p className="mt-4 text-xs text-gray-400">
          Esta página é apenas para testes locais. Em produção, os webhooks são enviados diretamente pela Hubla.
        </p>
      </div>
    </div>
  );
} 