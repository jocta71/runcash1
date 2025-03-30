import { useState, useMemo, useEffect } from 'react';
import { Search, Menu, MessageSquare, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import RouletteCardRealtime from '@/components/RouletteCardRealtime';
import { Input } from '@/components/ui/input';
import ChatUI from '@/components/ChatUI';
import { Button } from '@/components/ui/button';
import AnimatedInsights from '@/components/AnimatedInsights';
import ProfileDropdown from '@/components/ProfileDropdown';
import { fetchAllRoulettes } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import SocketService from '@/services/SocketService';

interface Roulette {
  id: string;
  name: string;
  roleta_nome?: string;
  wins: number;
  losses: number;
}

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

// Mock chat messages for UI display
const mockChatMessages: ChatMessage[] = [{
  id: '1',
  user: {
    name: 'Wade Warren',
    avatar: ''
  },
  message: 'when will it be ready?',
  timestamp: new Date()
}, {
  id: '2',
  user: {
    name: 'Leslie Alexander',
    avatar: ''
  },
  message: 'when will it be ready?',
  timestamp: new Date()
}, {
  id: '3',
  user: {
    name: 'Moderator',
    avatar: '',
    isModerator: true
  },
  message: 'when will it be ready?',
  timestamp: new Date()
}];

const Index = () => {
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  
  const [roulettes, setRoulettes] = useState<Roulette[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Função para buscar roletas do banco de dados
  const fetchRoulettes = async () => {
    try {
      setIsLoading(true);
      
      console.log('[DEBUG] Iniciando busca de roletas disponíveis...');
      
      // Use the Supabase client to fetch roulettes
      const data = await fetchAllRoulettes();
      console.log('[DEBUG] Roletas recebidas:', data);
      
      if (!data || data.length === 0) {
        console.warn('[DEBUG] ALERTA: Nenhuma roleta encontrada.');
        
        // Sem dados disponíveis
        setRoulettes([]);
        
        // Notificar usuário sobre a falta de dados
        toast({
          title: "Sem roletas disponíveis",
          description: "Não foi possível carregar roletas do servidor. Tente novamente mais tarde.",
          variant: "default",
          duration: 5000
        });
      } else {
        // Formatar dados das roletas para o formato que precisamos
        const formattedData = data.map(item => ({
          id: item.id || item.uuid,
          name: item.nome || item.name,
          roleta_nome: item.roleta_nome || item.nome || item.name,
          wins: item.vitorias || 0,
          losses: item.derrotas || 0
        }));
        
        console.log('[DEBUG] Roletas formatadas:', formattedData);
        setRoulettes(formattedData);
      }
    } catch (error) {
      console.error('[ERROR] Erro ao buscar roletas:', error);
      
      // Sem dados disponíveis em caso de erro
      setRoulettes([]);
      
      toast({
        title: "Erro ao carregar roletas",
        description: "Não foi possível conectar ao servidor. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Inicializar o serviço de Socket no carregamento da página
  useEffect(() => {
    // Inicializar o serviço de Socket.IO
    const socketService = SocketService.getInstance();
    
    // Verificar se a conexão está ativa a cada 5 segundos
    const intervalId = setInterval(() => {
      setSocketConnected(socketService.isSocketConnected());
    }, 5000);
    
    // Forçar uma verificação inicial
    setSocketConnected(socketService.isSocketConnected());
    
    // Carregar roletas
    fetchRoulettes();
    
    // Limpeza ao desmontar o componente
    return () => {
      clearInterval(intervalId);
      // Não desconectamos o Socket.IO aqui para manter a conexão entre páginas
    };
  }, []);
  
  // Filtrar roletas com base na pesquisa
  const filteredRoulettes = useMemo(() => {
    return roulettes.filter(roulette => 
      (roulette.name || roulette.roleta_nome || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [roulettes, search]);

  // Adicionar logs para depuração
  useEffect(() => {
    console.log('[Index] Roletas disponíveis:', roulettes);
    console.log('[Index] Roletas filtradas:', filteredRoulettes);
  }, [roulettes, filteredRoulettes]);

  // Modificar a renderização das roletas para adicionar mais logs
  const renderRoulettes = useMemo(() => {
    console.log('[Index] Renderizando roletas:', filteredRoulettes);
    
    if (isLoading) {
      console.log('[Index] Exibindo estado de carregamento');
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i} 
              className="bg-[#17161e]/50 rounded-xl p-4 h-72 animate-pulse"
            />
          ))}
        </div>
      );
    }
    
    if (filteredRoulettes.length > 0) {
      console.log('[Index] Exibindo roletas filtradas:', filteredRoulettes.length);
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRoulettes.map((roulette) => (
            <RouletteCardRealtime
              key={roulette.id}
              roletaId={roulette.id}
              name={roulette.name}
              roleta_nome={roulette.roleta_nome}
              wins={roulette.wins}
              losses={roulette.losses}
            />
          ))}
        </div>
      );
    }
    
    console.log('[Index] Nenhuma roleta encontrada');
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">
          Nenhuma roleta encontrada. Certifique-se de inserir dados no servidor.
        </p>
        <Button 
          variant="outline" 
          className="border-vegas-gold text-vegas-gold hover:bg-vegas-gold/10"
          onClick={fetchRoulettes}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Recarregar
        </Button>
      </div>
    );
  }, [isLoading, filteredRoulettes, fetchRoulettes]);

  return (
    <div className="min-h-screen flex bg-vegas-black">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Sidebar (drawer) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobile={true} />
      
      <div className="flex-1 relative">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button 
            className="p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} className="text-[#00ff00]" />
          </button>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-2">
            {showMobileSearch ? (
              <div className="absolute top-0 left-0 right-0 z-50 p-2 bg-[#100f13] border-b border-[#33333359]">
                <div className="relative flex items-center w-full">
                  <Search size={16} className="absolute left-3 text-gray-400" />
                  <Input 
                    type="text" 
                    placeholder="Pesquisar roleta..." 
                    className="pl-9 pr-3 h-10 bg-[#1a191f] border-vegas-gold/20"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  <button 
                    className="absolute right-3 text-gray-400"
                    onClick={() => setShowMobileSearch(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="p-2"
                onClick={() => setShowMobileSearch(true)}
              >
                <Search size={24} className="text-[#00ff00]" />
              </button>
            )}
            
            <button 
              className="p-2"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <MessageSquare size={24} className={`${chatOpen ? 'text-vegas-gold' : 'text-[#00ff00]'}`} />
            </button>
            
            <ProfileDropdown />
          </div>
        </div>
        
        {/* Main content area */}
        <div className="p-4 pt-20 md:p-8 md:pt-8 pb-24 md:pb-8">
          {/* Connection status indicator */}
          <div className={`flex items-center mb-4 ${socketConnected ? 'text-green-500' : 'text-red-500'}`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs">
              {socketConnected ? 'Conectado em tempo real' : 'Sem conexão em tempo real'}
            </span>
          </div>
          
          {/* Desktop search */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input 
                type="text" 
                placeholder="Pesquisar roleta..." 
                className="pl-9 pr-3 h-10 bg-[#1a191f] border-vegas-gold/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <AnimatedInsights />
          </div>
          
          {/* Conditional insights display on mobile */}
          <div className="md:hidden mb-4">
            <AnimatedInsights />
          </div>
          
          {/* Button to refresh data */}
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              className="border-vegas-gold text-vegas-gold hover:bg-vegas-gold/10"
              onClick={fetchRoulettes}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Carregando...' : 'Atualizar'}
            </Button>
          </div>
          
          {/* Roulettes grid */}
          {renderRoulettes}
        </div>
        
        {/* Mobile chat drawer */}
        <div className={`fixed inset-y-0 right-0 w-full max-w-md z-40 bg-[#0B0A0F] transform transition-transform duration-300 ease-in-out ${chatOpen ? 'translate-x-0' : 'translate-x-full'} md:hidden`}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-vegas-gold/20 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-vegas-gold">Chat</h2>
              <button onClick={() => setChatOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <ChatUI messages={mockChatMessages} />
          </div>
        </div>
      </div>
      
      {/* Desktop chat sidebar */}
      <div className="hidden md:block w-[345px] border-l border-vegas-gold/20 bg-[#0B0A0F] overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-vegas-gold/20">
            <h2 className="text-lg font-semibold text-vegas-gold">Chat</h2>
          </div>
          <ChatUI messages={mockChatMessages} />
        </div>
      </div>
    </div>
  );
};

export default Index;

