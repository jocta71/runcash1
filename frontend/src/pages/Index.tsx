import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, PackageOpen, Loader2 } from 'lucide-react';
import RouletteCard from '@/components/RouletteCard';
import Layout from '@/components/Layout';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { RouletteData } from '@/types';
import EventService, { RouletteNumberEvent, StrategyUpdateEvent } from '@/services/EventService';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import RouletteSidePanelStats from '@/components/RouletteSidePanelStats';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSubscription } from '@/hooks/useSubscription';

interface ChatMessage {
  id: string;
  user: {
    name: string;
    avatar?: string;
    role?: string;
    isAdmin?: boolean;
    isModerator?: boolean;
  };
  message: string;
  timestamp: Date;
}

// Adicionar área do código para persistência de roletas
interface KnownRoulette {
  id: string;
  nome: string;
  ultima_atualizacao: string;
}

// Estendendo o tipo RouletteData para incluir os campos que estamos usando
interface ExtendedRouletteData extends RouletteData {
  ultima_atualizacao?: string;
  isFavorite?: boolean;
}

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [roulettes, setRoulettes] = useState<ExtendedRouletteData[]>([]);
  const [filteredRoulettes, setFilteredRoulettes] = useState<ExtendedRouletteData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [knownRoulettes, setKnownRoulettes] = useState<KnownRoulette[]>([]);
  const [dataFullyLoaded, setDataFullyLoaded] = useState<boolean>(false);
  const [selectedRoulette, setSelectedRoulette] = useState<ExtendedRouletteData | null>(null);
  const [historicalNumbers, setHistoricalNumbers] = useState<number[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasFeatureAccess } = useSubscription();
  
  const hasActivePlan = true; // Todos os usuários agora têm um plano ativo

  // Event listeners for the roulette data
  useEffect(() => {
    // Adicionar os ouvintes de eventos
    EventService.on('roulette:exists', handleRouletteExists);
    EventService.on('roulette:history-loaded', handleHistoricalDataLoaded);
    EventService.on('roulette:real-data-loaded', handleRealDataLoaded);

    // Limpar os ouvintes quando o componente for desmontado
    return () => {
      EventService.off('roulette:exists', handleRouletteExists);
      EventService.off('roulette:history-loaded', handleHistoricalDataLoaded);
      EventService.off('roulette:real-data-loaded', handleRealDataLoaded);
    };
  }, []);

  // Remover verificação por usuário, todos têm acesso
  useEffect(() => {
    loadRoulettes();

    // Função de limpeza
    return () => {
      // Limpeza se necessário
    };
  }, []);

  const handleRouletteExists = (event: RouletteNumberEvent | StrategyUpdateEvent) => {
    // Ajustar acesso às propriedades usando as propriedades corretas do evento
    const roletaId = 'roleta_id' in event ? event.roleta_id : '';
    const nome = 'roleta_nome' in event ? event.roleta_nome : '';
    
    // Remover a verificação do throttler, já que está causando erros
    // e simplesmente processar o evento

    setKnownRoulettes(prev => {
      const existingIndex = prev.findIndex(r => r.id === roletaId);
      
      if (existingIndex === -1) {
        return [...prev, { id: roletaId, nome, ultima_atualizacao: new Date().toISOString() }];
      }
      
      const updated = [...prev];
      updated[existingIndex] = { 
        ...updated[existingIndex], 
        nome, 
        ultima_atualizacao: new Date().toISOString() 
      };
      
      return updated;
    });
  };

  const handleHistoricalDataLoaded = (event: RouletteNumberEvent | StrategyUpdateEvent) => {
    if (!selectedRoulette) return;
    
    // Ajustar acesso às propriedades usando as propriedades corretas do evento
    const roletaId = 'roleta_id' in event ? event.roleta_id : '';
    
    if (selectedRoulette.id !== roletaId) {
      return;
    }
    
    // Verificar e acessar os números corretamente
    if ('numeros' in event && Array.isArray(event.numeros)) {
      setHistoricalNumbers([...event.numeros]);
    }
  };

  const handleRealDataLoaded = () => {
    if (isLoading) {
      setIsLoading(false);
    }
    
    if (!dataFullyLoaded) {
      setDataFullyLoaded(true);
    }
  };

  const loadRoulettes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Usar o método estático do repository em vez de instanciar
      const allRoulettes = await RouletteRepository.fetchAllRoulettesWithNumbers();
      
      if (!allRoulettes || allRoulettes.length === 0) {
        setError('Não foi possível carregar as roletas. Tente novamente mais tarde.');
        setIsLoading(false);
        return;
      }
      
      // Adicionar campo para indicar se a roleta é favorita (implementação simples)
      const processedRoulettes = allRoulettes.map(roulette => ({
        ...roulette,
        isFavorite: false, // Por padrão, nenhuma roleta é favorita
      }));
      
      setRoulettes(processedRoulettes);
      setFilteredRoulettes(processedRoulettes);
      
      // Se já tiver uma roleta selecionada, manter a seleção
      if (selectedRoulette) {
        const updated = processedRoulettes.find(r => r.id === selectedRoulette.id);
        if (updated) {
          setSelectedRoulette(updated);
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao carregar roletas:', error);
      setError('Não foi possível carregar as roletas. Tente novamente mais tarde.');
      setIsLoading(false);
    }
  };

  const scheduleUpdate = () => {
    // Programar atualização periódica (opcional)
    const interval = setInterval(() => {
      loadRoulettes();
    }, 60000); // Atualizar a cada 1 minuto
    
    return () => clearInterval(interval);
  };

  // Efeito para programar atualizações periódicas
  useEffect(() => {
    const cleanupInterval = scheduleUpdate();
    return cleanupInterval;
  }, []);

  // Função para selecionar uma roleta para exibir estatísticas
  const handleRouletteSelect = (roulette: ExtendedRouletteData) => {
    setSelectedRoulette(roulette);
    
    // Se estiver em dispositivo móvel, abrir o painel lateral
    if (window.innerWidth < 1024) {
      setSidebarOpen(true);
    }
  };

  const renderRouletteCards = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const roulettesToShow = filteredRoulettes.slice(startIndex, endIndex);
    
    if (roulettesToShow.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center p-8 bg-[#131614] rounded-lg border border-gray-800/30">
          <PackageOpen className="h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">Nenhuma roleta encontrada</h3>
          <p className="text-gray-400 text-center">Não há roletas disponíveis no momento.</p>
        </div>
      );
    }
    
    return roulettesToShow.map((roulette) => (
      <div 
        key={roulette.id} 
        onClick={() => handleRouletteSelect(roulette)}
        className={`cursor-pointer transition-all rounded-xl ${selectedRoulette?.id === roulette.id ? 'border-2 border-green-500' : ''}`}
      >
        <RouletteCard
          data={roulette}
        />
      </div>
    ));
  };

  const renderPagination = () => {
    const totalPages = Math.ceil(filteredRoulettes.length / itemsPerPage);
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex justify-center mt-6 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-4"
        >
          Anterior
        </Button>
        
        <div className="flex items-center px-4 text-sm text-gray-400">
          Página {currentPage} de {totalPages}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-4"
        >
          Próxima
        </Button>
      </div>
    );
  };

  const handleRouletteFilter = (filtered: ExtendedRouletteData[]) => {
    setFilteredRoulettes(filtered);
    setCurrentPage(1); // Reset to first page after filtering
  };

  const renderRouletteSkeletons = () => {
    return Array(6)
      .fill(0)
      .map((_, index) => (
        <div key={index} className="bg-gray-800/30 rounded-lg p-4 h-40 animate-pulse">
          <div className="flex flex-col h-full space-y-3 justify-between">
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
            <div className="space-y-2">
              <div className="h-8 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="h-6 bg-gray-700 rounded w-1/4"></div>
          </div>
        </div>
      ));
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 pt-4 md:pt-8 min-h-[80vh] relative">
        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 p-4 mb-6 rounded-lg flex items-center z-50 relative">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        )}
        
        {/* Layout principal */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Cards de roleta à esquerda */}
          <div className="w-full lg:w-1/2">
            <div className="mb-4 p-4 bg-[#131614] rounded-lg border border-gray-800/30">
              <div className="flex justify-between items-center">
                <div className="text-white font-bold">
                  Roletas Disponíveis
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? renderRouletteSkeletons() : renderRouletteCards()}
            </div>
            
            {/* Paginação */}
            {renderPagination()}
          </div>
          
          {/* Painel lateral */}
          <div className="w-full lg:w-1/2">
            {selectedRoulette ? (
              <RouletteSidePanelStats
                roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta'}
                lastNumbers={Array.isArray(selectedRoulette.lastNumbers) ? selectedRoulette.lastNumbers : []}
                wins={typeof selectedRoulette.vitorias === 'number' ? selectedRoulette.vitorias : 0}
                losses={typeof selectedRoulette.derrotas === 'number' ? selectedRoulette.derrotas : 0}
                providers={[]} // Se houver uma lista de provedores disponível, passe aqui
              />
            ) : isLoading ? (
              <div className="bg-[#131614] rounded-lg border border-gray-800/30 p-8 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-[hsl(142.1,70.6%,45.3%)] mb-4"></div>
                <p className="text-gray-400">Carregando estatísticas...</p>
              </div>
            ) : (
              <div className="bg-[#131614] rounded-lg border border-gray-800/30 p-4 flex items-center justify-center h-48">
                <p className="text-gray-400">Selecione uma roleta para ver suas estatísticas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;