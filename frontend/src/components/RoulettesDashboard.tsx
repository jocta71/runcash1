import React, { useState, useEffect } from 'react';
import RouletteCard from './RouletteCard';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { Button } from './ui/button';
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoulettesDashboardProps {
  onRouletteSelect?: (roulette: any) => void;
}

const RoulettesDashboard: React.FC<RoulettesDashboardProps> = ({ onRouletteSelect }) => {
  const [roulettes, setRoulettes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [reconnecting, setReconnecting] = useState(false);

  // Instância de UnifiedRouletteClient
  const unifiedClient = UnifiedRouletteClient.getInstance();

  // Obter dados de roletas e configurar atualizações
  useEffect(() => {
    console.log('Inicializando painel de roletas...');
    setLoading(true);

    // Atualizar status de conexão
    const updateConnectionStatus = () => {
      const status = unifiedClient.getStatus();
      if (status.isStreamConnected) {
        setConnectionStatus('connected');
      } else if (status.isStreamConnecting) {
        setConnectionStatus('connecting');
      } else {
        setConnectionStatus('disconnected');
      }
    };

    // Buscar roletas iniciais
    const fetchInitialRoulettes = async () => {
      try {
        // Forçar uma atualização
        await unifiedClient.forceUpdate();
        
        // Obter roletas do UnifiedRouletteClient
        const data = unifiedClient.getAllRoulettes();
        
        if (data && data.length > 0) {
          console.log(`Dados iniciais recebidos: ${data.length} roletas`);
          setRoulettes(data);
          setLoading(false);
          setError(null);
        } else {
          console.log('Sem dados iniciais, aguardando atualizações...');
          setLoading(true);
        }
        
        updateConnectionStatus();
      } catch (err) {
        console.error('Erro ao buscar roletas:', err);
        setError('Falha ao obter dados das roletas');
        setLoading(false);
        setConnectionStatus('disconnected');
      }
    };

    // Handler para atualizações
    const handleRouletteUpdate = (data: any) => {
      console.log('Atualização de roletas recebida:', data);
      
      // Verificar se os dados são um array diretamente ou estão em data.roulettes
      if (data && data.roulettes && Array.isArray(data.roulettes)) {
        console.log(`Atualizando com ${data.roulettes.length} roletas do evento.roulettes`);
        setRoulettes(data.roulettes);
        setLoading(false);
        setError(null);
      } 
      // Verificar se temos dados diretamente no objeto all_roulettes_update
      else if (data && data.type === 'all_roulettes_update' && Array.isArray(data.data)) {
        console.log(`Atualizando com ${data.data.length} roletas do evento all_roulettes_update`);
        setRoulettes(data.data);
        setLoading(false);
        setError(null);
      }
      // Se o evento não tem os dados, buscamos diretamente do cache do cliente
      else {
        console.log('Evento sem dados estruturados, buscando diretamente do UnifiedClient');
        const allRoulettes = unifiedClient.getAllRoulettes();
        if (allRoulettes && allRoulettes.length > 0) {
          console.log(`Obtidas ${allRoulettes.length} roletas do cache do UnifiedClient`);
          setRoulettes(allRoulettes);
          setLoading(false);
          setError(null);
        }
      }
      
      updateConnectionStatus();
    };

    // Registrar para atualizações
    unifiedClient.subscribe('update', handleRouletteUpdate);
    
    // Buscar roletas iniciais imediatamente após o useEffect ser executado
    fetchInitialRoulettes();
    
    // Além disso, verificar se já temos os dados no cache
    const cachedRoulettes = unifiedClient.getAllRoulettes();
    if (cachedRoulettes && cachedRoulettes.length > 0) {
      console.log(`Usando ${cachedRoulettes.length} roletas do cache existente`);
      setRoulettes(cachedRoulettes);
      setLoading(false);
      setError(null);
    }
    
    // Status inicial 
    updateConnectionStatus();
    
    // Verificar status a cada 5 segundos
    const statusInterval = setInterval(() => {
      updateConnectionStatus();
    }, 5000);

    // Cleanup
    return () => {
      unifiedClient.unsubscribe('update', handleRouletteUpdate);
      clearInterval(statusInterval);
    };
  }, []);

  // Função para forçar reconexão de todos os serviços
  const handleReconnect = async () => {
    setReconnecting(true);
    
    try {
      // Reconectar stream SSE
      unifiedClient.forceReconnectStream();
      
      // Aguardar 2 segundos para que a conexão seja estabelecida
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Buscar dados novamente
      await unifiedClient.forceUpdate();
      
      // Atualizar status
      const status = unifiedClient.getStatus();
      if (status.isStreamConnected) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (err) {
      console.error('Erro ao reconectar:', err);
    } finally {
      setReconnecting(false);
    }
  };

  // Handler de seleção de roleta
  const handleRouletteSelect = (roulette: any) => {
    console.log('Roleta selecionada:', roulette);
    if (onRouletteSelect) {
      onRouletteSelect(roulette);
    }
  };

  // Render loading state
  if (loading && roulettes.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Roletas Disponíveis</h1>
          <div className="flex items-center gap-2">
            <StatusIndicator status={connectionStatus} />
            <Button 
              onClick={handleReconnect} 
              variant="outline" 
              size="sm"
              disabled={reconnecting}
              className="flex gap-1 items-center"
            >
              <RefreshCw className={cn("h-4 w-4", { "animate-spin": reconnecting })} />
              {reconnecting ? 'Reconectando...' : 'Reconectar'}
            </Button>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando roletas...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && roulettes.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Roletas Disponíveis</h1>
          <div className="flex items-center gap-2">
            <StatusIndicator status={connectionStatus} />
            <Button 
              onClick={handleReconnect} 
              variant="outline" 
              size="sm"
              disabled={reconnecting}
              className="flex gap-1 items-center"
            >
              <RefreshCw className={cn("h-4 w-4", { "animate-spin": reconnecting })} />
              {reconnecting ? 'Reconectando...' : 'Reconectar'}
            </Button>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>{error}</p>
          </div>
          <p className="mt-2 text-sm">Tente reconectar ou recarregar a página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Roletas Disponíveis</h1>
        <div className="flex items-center gap-2">
          <StatusIndicator status={connectionStatus} />
          <Button 
            onClick={handleReconnect} 
            variant="outline" 
            size="sm"
            disabled={reconnecting}
            className="flex gap-1 items-center"
          >
            <RefreshCw className={cn("h-4 w-4", { "animate-spin": reconnecting })} />
            {reconnecting ? 'Reconectando...' : 'Reconectar'}
          </Button>
        </div>
      </div>
      
      {roulettes.length === 0 ? (
        <div className="text-center py-10">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Nenhuma roleta disponível no momento</p>
          <Button onClick={handleReconnect} variant="outline" className="mt-4">
            Tentar Novamente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {roulettes.map((roulette: any) => (
            <div key={roulette.id || roulette._id || roulette.roleta_id} 
                 onClick={() => handleRouletteSelect(roulette)}
                 className="cursor-pointer transition-transform hover:scale-105">
              <RouletteCard 
                data={roulette} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Componente para indicador de status
const StatusIndicator = ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
  const statusConfig = {
    connected: {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      text: 'Conectado',
      color: 'text-green-500'
    },
    connecting: {
      icon: <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />,
      text: 'Conectando',
      color: 'text-amber-500'
    },
    disconnected: {
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      text: 'Desconectado',
      color: 'text-red-500'
    }
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-1 ${config.color} text-xs`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};

export default RoulettesDashboard; 