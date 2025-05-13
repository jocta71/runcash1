import React, { useState, useEffect } from 'react';
import RouletteCard from './RouletteCard';
import RouletteSidePanelStats from './RouletteSidePanelStats';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { Button } from './ui/button';
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const RoulettesDashboard = () => {
  const [roulettes, setRoulettes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [reconnecting, setReconnecting] = useState(false);
  const [selectedRoulette, setSelectedRoulette] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');

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
          // Selecionar a primeira roleta por padrão se não houver uma selecionada ainda
          if (!selectedRoulette) {
            setSelectedRoulette(data[0]);
          }
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
        // Preservar a seleção atual quando recebemos novos dados
        if (selectedRoulette) {
          const currentSelectedId = selectedRoulette.id || selectedRoulette.roleta_id;
          console.log(`Preservando seleção atual: ${currentSelectedId}`);
          
          // Atualize apenas a referência para a roleta atualmente selecionada
          const updatedSelected = newRoulettes.find(
            (r: any) => r.id === currentSelectedId || r.roleta_id === currentSelectedId
          );
          
          if (updatedSelected) {
            console.log(`Roleta selecionada encontrada nos novos dados`);
            // Preserva o flag _userSelected para manter o estado da seleção do usuário
            if (selectedRoulette._userSelected) {
              updatedSelected._userSelected = true;
            }
            
            // Atualiza a lista de roletas
            setRoulettes(newRoulettes);
            // Atualiza apenas a referência da roleta selecionada
            setSelectedRoulette(updatedSelected);
          } else {
            console.log(`Roleta selecionada não encontrada nos novos dados, mantendo seleção atual`);
            // Se a roleta selecionada não existe mais na lista, apenas atualize a lista
            setRoulettes(newRoulettes);
          }
        } else {
          // Se não havia seleção, atualize apenas a lista
          console.log(`Sem roleta selecionada anteriormente, atualizando apenas a lista`);
          setRoulettes(newRoulettes);
        }
        
        setLoading(false);
        setError(null);
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
      // Selecionar a primeira roleta por padrão, se ainda não houver uma selecionada
      if (!selectedRoulette) {
        setSelectedRoulette(cachedRoulettes[0]);
      }
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
  }, []); // Removido selectedRoulette das dependências para evitar loop

  // Função para selecionar uma roleta
  const handleSelectRoulette = (roulette: any) => {
    console.log('Roleta selecionada pelo usuário:', roulette);
    // Adiciona um flag para indicar que foi explicitamente selecionada pelo usuário
    roulette._userSelected = true;
    setSelectedRoulette(roulette);
  };

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

  // Filtrar roletas baseado no termo de busca e no filtro de provedor
  const filteredRoulettes = roulettes.filter(roulette => {
    const name = roulette.nome || roulette.name || '';
    const provider = (roulette.provider || roulette.roleta_provider || '').toLowerCase();
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Lógica de filtro de provedor melhorada
    let matchesProvider = false;
    if (providerFilter === 'all') {
      matchesProvider = true;
    } else if (providerFilter === 'evolution') {
      matchesProvider = provider.includes('evolution');
    } else if (providerFilter === 'pragmatic') {
      matchesProvider = provider.includes('pragmatic');
    }
    
    return matchesSearch && matchesProvider;
  });

  // Render loading state
  if (loading && roulettes.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
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
      <div className="flex flex-col sm:flex-row justify-start items-start sm:items-center mb-6 gap-4">
        <div className="flex gap-3 w-full sm:w-auto order-2 sm:order-1">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Buscar roleta..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="evolution">Evolution</SelectItem>
              <SelectItem value="pragmatic">Pragmatic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2 ml-auto order-1 sm:order-2">
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
        <div className="lg:flex">
          {/* Lista de roletas à esquerda - 50% em desktop */}
          <div className="lg:w-1/2 lg:pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2">
              {filteredRoulettes.map((roulette: any) => {
                const rouletteId = roulette.id || roulette.roleta_id;
                const isSelected = selectedRoulette && 
                  (selectedRoulette.id === rouletteId || selectedRoulette.roleta_id === rouletteId);
                  
                return (
                  <div 
                    key={rouletteId}
                    className="relative transition-all"
                    onClick={() => handleSelectRoulette(roulette)}
                  >
                    <div className={cn(
                      "cursor-pointer transition-all",
                      {
                        "ring-2 ring-primary ring-offset-2 ring-offset-background": isSelected
                      }
                    )}>
                      <RouletteCard 
                        data={roulette}
                        // Não passamos isSelected para o RouletteCard para evitar duplicação
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Estatísticas da roleta à direita - 50% em desktop, fixo em scroll */}
          <div className="lg:w-1/2 mt-4 lg:mt-0 lg:sticky lg:top-2 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <div className="h-full">
              {selectedRoulette ? (
                <RouletteSidePanelStats
                  roletaId={selectedRoulette.id || selectedRoulette.roleta_id || ''}
                  roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta'}
                  lastNumbers={selectedRoulette.numero?.map((n: any) => Number(n.numero)) || []}
                  wins={0}
                  losses={0}
                />
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-gray-700 rounded-lg p-8">
                  <p className="text-gray-500">Selecione uma roleta para ver as estatísticas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para mostrar status de conexão
const StatusIndicator = ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-1">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-green-500">Conectado</span>
      </div>
    );
  }
  
  if (status === 'connecting') {
    return (
      <div className="flex items-center gap-1">
        <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-yellow-500 animate-spin"></div>
        <span className="text-sm font-medium text-yellow-500">Conectando...</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1">
      <AlertCircle className="h-4 w-4 text-red-500" />
      <span className="text-sm font-medium text-red-500">Desconectado</span>
    </div>
  );
};

export default RoulettesDashboard; 