import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Wallet, Menu, MessageSquare, AlertCircle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import RouletteCard from '@/components/RouletteCard';
import { Input } from '@/components/ui/input';
import ChatUI from '@/components/ChatUI';
import { Button } from '@/components/ui/button';
import AnimatedInsights from '@/components/AnimatedInsights';
import ProfileDropdown from '@/components/ProfileDropdown';
import Layout from '@/components/Layout';
import { fetchAllRoulettes, RouletteData } from '@/integrations/api/rouletteService';
import EventService from '@/services/EventService';

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

// Mapeamento de IDs de roletas para tipos de roletas conhecidas
const knownRouletteTypes = {
  "2b00051": "Immersive Roulette",
  "2b00081": "Immersive Roulette",
  "2b00091": "Brazilian Mega Roulette",
  "2b00035": "Brazilian Mega Roulette",
  "2b00085": "Speed Auto Roulette",
  "2b00098": "Auto-Roulette VIP",
  "2b00093": "Auto-Roulette",
  "2b00095": "Bucharest Auto-Roulette",
};

// Adicionar área do código para persistência de roletas
interface KnownRoulette {
  id: string;
  nome: string;
  ultima_atualizacao: string;
}

const Index = () => {
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [knownRoulettes, setKnownRoulettes] = useState<Record<string, KnownRoulette>>({});
  
  // Escutar eventos de roletas existentes para persistência
  useEffect(() => {
    const handleRouletteExists = (data: any) => {
      if (!data || !data.id) {
        console.log('[Index] Evento roleta_exists recebido sem ID válido:', data);
        return;
      }
      
      console.log(`[Index] Evento roleta_exists recebido para: ${data.nome} (ID: ${data.id})`);
      
      setKnownRoulettes(prev => {
        const updated = {
          ...prev,
          [data.id]: data
        };
        console.log(`[Index] Atualizado registro de roletas conhecidas. Total: ${Object.keys(updated).length}`);
        return updated;
      });
    };
    
    // Registrar o listener de evento diretamente (sem usar addGlobalListener que pode não estar registrado corretamente)
    EventService.getInstance().subscribe('roleta_exists', handleRouletteExists);
    
    console.log('[Index] Listener para evento roleta_exists registrado');
    
    return () => {
      // Remover o listener ao desmontar o componente
      EventService.getInstance().unsubscribe('roleta_exists', handleRouletteExists);
      console.log('[Index] Listener para evento roleta_exists removido');
    };
  }, []);
  
  // Função para mesclar roletas da API com roletas conhecidas
  const mergeRoulettes = useCallback((apiRoulettes: RouletteData[]): RouletteData[] => {
    const merged: Record<string, RouletteData> = {};
    
    // Primeiro, adicionar todas as roletas da API
    apiRoulettes.forEach(roulette => {
      merged[roulette.id] = roulette;
    });
    
    // Depois, adicionar ou atualizar com roletas conhecidas
    Object.values(knownRoulettes).forEach(known => {
      // Se a roleta já existe na lista da API, não precisamos fazer nada
      if (merged[known.id]) {
        console.log(`[Index] Roleta já existe na API: ${known.nome} (ID: ${known.id})`);
        return;
      }
      
      console.log(`[Index] Adicionando roleta conhecida ausente na API: ${known.nome} (ID: ${known.id})`);
      
      // Criar uma roleta a partir da roleta conhecida
      merged[known.id] = {
        id: known.id,
        nome: known.nome,
        roleta_nome: known.nome,
        numeros: [],
        updated_at: known.ultima_atualizacao,
        estado_estrategia: 'NEUTRAL',
        numero_gatilho: 0,
        numero_gatilho_anterior: 0,
        terminais_gatilho: [],
        terminais_gatilho_anterior: [],
        vitorias: 0,
        derrotas: 0,
        sugestao_display: ''
      };
    });
    
    const result = Object.values(merged);
    console.log(`[Index] Total após mesclagem: ${result.length} roletas (API: ${apiRoulettes.length}, Conhecidas: ${Object.keys(knownRoulettes).length})`);
    
    return result;
  }, [knownRoulettes]);
  
  // Buscar dados da API ao carregar a página
  useEffect(() => {
    const loadRoulettes = async () => {
      try {
        setIsLoading(true);
        const data = await fetchAllRoulettes();
        console.log('Dados da API:', data);
        
        // Mesclar com roletas conhecidas para garantir que nenhuma desaparece
        const mergedRoulettes = mergeRoulettes(data);
        setRoulettes(mergedRoulettes);
        
        console.log(`[Index] Total de roletas após mesclagem: ${mergedRoulettes.length} (API: ${data.length}, Conhecidas: ${Object.keys(knownRoulettes).length})`);
        
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar dados da API:', err);
        setError('Não foi possível carregar os dados das roletas. Por favor, tente novamente.');
        
        // Em caso de erro, tentar usar apenas as roletas conhecidas
        if (Object.keys(knownRoulettes).length > 0) {
          const fallbackRoulettes = mergeRoulettes([]);
          setRoulettes(fallbackRoulettes);
          console.log(`[Index] Usando ${fallbackRoulettes.length} roletas conhecidas como fallback`);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRoulettes();
  }, [knownRoulettes, mergeRoulettes]);
  
  // Recarregar periodicamente as roletas para garantir dados atualizados
  useEffect(() => {
    // Recarregar a cada 60 segundos
    const interval = setInterval(async () => {
      try {
        const data = await fetchAllRoulettes();
        const mergedRoulettes = mergeRoulettes(data);
        setRoulettes(mergedRoulettes);
        console.log('[Index] Roletas recarregadas automaticamente');
      } catch (err) {
        console.error('[Index] Erro ao recarregar roletas:', err);
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [mergeRoulettes]);
  
  const filteredRoulettes = useMemo(() => {
    return roulettes.filter(roulette => 
      roulette.nome.toLowerCase().includes(search.toLowerCase())
    );
  }, [roulettes, search]);
  
  const topRoulettes = useMemo(() => {
    return [...roulettes].sort((a, b) => {
      const aWinRate = a.vitorias / (a.vitorias + a.derrotas) * 100 || 0;
      const bWinRate = b.vitorias / (b.vitorias + b.derrotas) * 100 || 0;
      return bWinRate - aWinRate;
    }).slice(0, 3);
  }, [roulettes]);

  // Renderizar cards de roleta
  const renderRouletteCards = () => {
    if (isLoading) {
      return Array(6).fill(0).map((_, index) => (
        <div key={`skeleton-${index}`} className="bg-zinc-900 rounded-lg shadow-lg h-[250px] animate-pulse"></div>
      ));
    }

    if (error) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar roletas</h3>
          <p className="text-zinc-400 text-center">{error}</p>
          <Button 
            className="mt-4" 
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </Button>
        </div>
      );
    }

    if (filteredRoulettes.length === 0) {
      return (
        <div className="col-span-full flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-lg">
          <Search className="w-16 h-16 text-zinc-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhuma roleta encontrada</h3>
          <p className="text-zinc-400 text-center">Não foram encontradas roletas com o termo de busca.</p>
        </div>
      );
    }

    return filteredRoulettes.map((roulette) => (
      <RouletteCard
        key={roulette.id}
        roletaId={roulette.id}
        name={roulette.nome}
        lastNumbers={roulette.numeros || []}
        wins={roulette.vitorias || 0}
        losses={roulette.derrotas || 0}
      />
    ));
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 pt-4 md:pt-8">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">Roletas Disponíveis</h1>
            <p className="text-sm text-gray-400 mb-4 md:mb-0">
              Escolha uma roleta para começar a jogar
            </p>
        </div>
        
          <div className="w-full md:w-auto flex flex-col md:flex-row gap-3">
            <div className="relative">
              <input
                type="text" 
                placeholder="Buscar roleta..."
                className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 pl-10 w-full md:w-64 text-white"
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-900/30 border border-red-500 p-4 mb-6 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-100">{error}</p>
          </div>
        )}
        
        {/* Estado de carregamento */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#1e1e24] animate-pulse rounded-xl h-64"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {renderRouletteCards()}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;