import React, { useState, useEffect, useRef } from 'react';
import RouletteCard from './RouletteCard';
import RouletteSidePanelStats from './RouletteSidePanelStats';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { Button } from './ui/button';
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Obter uma única instância global do cliente para evitar múltiplas inicializações
const unifiedClient = UnifiedRouletteClient.getInstance();

const RoulettesDashboard = () => {
  const [roulettes, setRoulettes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [reconnecting, setReconnecting] = useState(false);
  const [selectedRoulette, setSelectedRoulette] = useState<any>(null);
  
  // Referências para evitar múltiplas inicializações e registros de eventos
  const initialized = useRef(false);
  const updateHandlerRef = useRef<((data: any) => void) | null>(null);

  // Obter dados de roletas e configurar atualizações
  useEffect(() => {
    // Evitar inicializações múltiplas
    if (initialized.current) {
      console.log('Dashboard já inicializado, pulando inicialização duplicada');
      return;
    }
    
    initialized.current = true;
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
        // Obter roletas do UnifiedRouletteClient
        const data = unifiedClient.getAllRoulettes();
        
        if (data && data.length > 0) {
          console.log(`Dados iniciais recebidos: ${data.length} roletas`);
          setRoulettes(data);
          // Selecionar a primeira roleta por padrão se não houver uma selecionada ainda
          if (!selectedRoulette) {
            setSelectedRoulette(data[0]);
          }
          setLoading(false);
          setError(null);
        } else {
          console.log('Sem dados iniciais, aguardando atualizações...');
          // Se não temos dados, forçar uma atualização
          unifiedClient.forceUpdate();
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
      let newRoulettes: any[] = [];
      
      if (data && data.roulettes && Array.isArray(data.roulettes)) {
        console.log(`Atualizando com ${data.roulettes.length} roletas do evento.roulettes`);
        newRoulettes = data.roulettes;
      } 
      // Verificar se temos dados diretamente no objeto all_roulettes_update
      else if (data && data.type === 'all_roulettes_update' && Array.isArray(data.data)) {
        console.log(`Atualizando com ${data.data.length} roletas do evento all_roulettes_update`);
        newRoulettes = data.data;
      }
      // Se o evento não tem os dados, buscamos diretamente do cache do cliente
      else {
        console.log('Evento sem dados estruturados, buscando diretamente do UnifiedClient');
        const allRoulettes = unifiedClient.getAllRoulettes();
        if (allRoulettes && allRoulettes.length > 0) {
          console.log(`Obtidas ${allRoulettes.length} roletas do cache do UnifiedClient`);
          newRoulettes = allRoulettes;
        }
      }
      
      // Atualizar o estado apenas se encontramos dados
      if (newRoulettes.length > 0) {
        setRoulettes(prevRoulettes => {
          // Se não tínhamos roletas antes, simplesmente atualizar
          if (prevRoulettes.length === 0) {
            return newRoulettes;
          }
          
          // Preservar a seleção atual
          setSelectedRoulette(prevSelected => {
            if (!prevSelected) return newRoulettes[0];
            
            const currentSelectedId = prevSelected.id || prevSelected.roleta_id;
            const updatedSelected = newRoulettes.find(
              (r: any) => r.id === currentSelectedId || r.roleta_id === currentSelectedId
            );
            
            // Se encontrarmos a roleta nos novos dados, retornar ela
            // caso contrário, manter a seleção atual
            return updatedSelected || prevSelected;
          });
          
          return newRoulettes;
        });
        
        setLoading(false);
        setError(null);
      }
      
      updateConnectionStatus();
    };

    // Salvar referência ao handler para limpeza
    updateHandlerRef.current = handleRouletteUpdate;
    
    // Registrar para atualizações apenas uma vez
    unifiedClient.subscribe('update', handleRouletteUpdate);
    
    // Buscar roletas iniciais imediatamente após o useEffect ser executado
    fetchInitialRoulettes();
    
    // Status inicial 
    updateConnectionStatus();
    
    // Verificar status a cada 5 segundos
    const statusInterval = setInterval(() => {
      updateConnectionStatus();
    }, 5000);

    // Cleanup
    return () => {
      if (updateHandlerRef.current) {
        unifiedClient.unsubscribe('update', updateHandlerRef.current);
      }
      clearInterval(statusInterval);
      initialized.current = false;
    };
  }, []); // Dependência vazia, executa apenas uma vez

  // Função para selecionar uma roleta
  const handleSelectRoulette = (id: string) => {
    const roulette = roulettes.find(r => r.id === id || r.roleta_id === id);
    if (roulette) {
      console.log('Roleta selecionada pelo usuário:', roulette.nome || roulette.name);
      setSelectedRoulette(roulette);
    }
  };

  // Função para forçar reconexão de todos os serviços
  const handleReconnect = async () => {
    if (reconnecting) return;
    
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
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <p>{error}</p>
          <Button 
            onClick={() => unifiedClient.forceUpdate()} 
            variant="outline" 
            size="sm" 
            className="ml-4"
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Main dashboard view
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {roulettes.map((roulette) => (
              <RouletteCard
                key={roulette.id || roulette.roleta_id}
                data={roulette}
                onSelect={handleSelectRoulette}
                isSelected={(selectedRoulette && 
                  (selectedRoulette.id === roulette.id || 
                   selectedRoulette.roleta_id === roulette.roleta_id))}
              />
            ))}
            {roulettes.length === 0 && !loading && !error && (
              <div className="col-span-full bg-gray-50 border border-gray-200 p-4 rounded-lg text-center">
                <p className="text-gray-500">Nenhuma roleta disponível no momento.</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-card rounded-lg shadow-sm border p-4">
          {selectedRoulette ? (
            <RouletteSidePanelStats
              roletaId={selectedRoulette.id || selectedRoulette.roleta_id || ''}
              roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta'}
              lastNumbers={(selectedRoulette.numeros || []).map((n: any) => Number(n.numero))}
              wins={0}
              losses={0}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <p className="text-muted-foreground">Selecione uma roleta para ver mais detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Status indicator component
const StatusIndicator = ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
  return (
    <div className="flex items-center">
      {status === 'connected' && (
        <div className="flex items-center text-green-600">
          <CheckCircle className="h-4 w-4 mr-1" />
          <span className="text-xs">Conectado</span>
        </div>
      )}
      {status === 'connecting' && (
        <div className="flex items-center text-amber-600">
          <div className="animate-pulse h-4 w-4 rounded-full bg-amber-500 mr-1"></div>
          <span className="text-xs">Conectando...</span>
        </div>
      )}
      {status === 'disconnected' && (
        <div className="flex items-center text-red-600">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span className="text-xs">Desconectado</span>
        </div>
      )}
    </div>
  );
};

export default RoulettesDashboard; 