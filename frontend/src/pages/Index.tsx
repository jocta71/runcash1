import { useState, useMemo, useEffect } from 'react';
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

// Gerador de números aleatórios para simulação apenas no frontend
const generateFakeNumbers = (count = 10) => {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 37));
};

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

const mockRoulettes = [{
  roletaId: "roleta-brasileira-1",
  name: "Roleta Brasileira",
  lastNumbers: [7, 11, 23, 5, 18],
  wins: 150,
  losses: 50,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-europeia-1",
  name: "Roleta Europeia",
  lastNumbers: [32, 15, 3, 26, 8],
  wins: 180,
  losses: 70,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-americana-1",
  name: "Roleta Americana",
  lastNumbers: [0, 12, 28, 35, 14],
  wins: 200,
  losses: 90,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-platinum-vip-1",
  name: "Roleta Platinum VIP",
  lastNumbers: [17, 22, 9, 31, 4],
  wins: 220,
  losses: 65,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-diamond-1",
  name: "Roleta Diamond",
  lastNumbers: [19, 6, 27, 13, 36],
  wins: 190,
  losses: 55,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-gold-1",
  name: "Roleta Gold",
  lastNumbers: [2, 10, 20, 33, 16],
  wins: 170,
  losses: 60,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-lightning-1",
  name: "Roleta Lightning",
  lastNumbers: [29, 24, 1, 30, 21],
  wins: 210,
  losses: 75,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-premium-1",
  name: "Roleta Premium",
  lastNumbers: [5, 18, 34, 11, 25],
  wins: 230,
  losses: 85,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}, {
  roletaId: "roleta-turbo-1",
  name: "Roleta Turbo",
  lastNumbers: [8, 17, 29, 2, 19],
  wins: 185,
  losses: 65,
  trend: Array.from({
    length: 20
  }, () => ({
    value: Math.random() * 100
  }))
}];

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
}, {
  id: '4',
  user: {
    name: 'Eleanor Pena',
    avatar: ''
  },
  message: 'when will it be ready?',
  timestamp: new Date()
}, {
  id: '5',
  user: {
    name: 'Cody Fisher',
    avatar: ''
  },
  message: 'received?',
  timestamp: new Date()
}, {
  id: '6',
  user: {
    name: 'Anonymous Admin',
    avatar: '',
    isAdmin: true
  },
  message: 'Have you spoken to the delivery man? He is more than an hour late',
  timestamp: new Date()
}, {
  id: '7',
  user: {
    name: 'Robert Fox',
    avatar: ''
  },
  message: 'Great service.',
  timestamp: new Date()
}, {
  id: '8',
  user: {
    name: 'Savannah Nguyen',
    avatar: ''
  },
  message: 'tastes amazing!',
  timestamp: new Date()
}, {
  id: '9',
  user: {
    name: 'Arlene McCoy',
    avatar: ''
  },
  message: 'Ok',
  timestamp: new Date()
}, {
  id: '10',
  user: {
    name: 'Mummyland',
    avatar: ''
  },
  message: 'when will it be ready?',
  timestamp: new Date()
}, {
  id: '11',
  user: {
    name: 'You',
    avatar: ''
  },
  message: 'Hi guys! What are you doing?',
  timestamp: new Date()
}];

const Index = () => {
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Buscar dados da API ao carregar a página
  useEffect(() => {
    const loadRoulettes = async () => {
      try {
        setIsLoading(true);
        const data = await fetchAllRoulettes();
        console.log('Dados da API:', data);
        
        // Adicionar números simulados para visualização quando não houver dados reais
        const enhancedData = data.map(roleta => {
          // Se a roleta não tem números, adicionar alguns simulados apenas para exibição frontend
          if (!roleta.numeros || roleta.numeros.length === 0) {
            console.log(`Adicionando números simulados para ${roleta.nome} (apenas para visualização)`);
            return {
              ...roleta,
              // Não modificar o campo numeros real, apenas adicionar campo local
              _displayNumbers: generateFakeNumbers(10)
            };
          }
          return roleta;
        });
        
        setRoulettes(enhancedData);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar dados da API:', err);
        setError('Não foi possível carregar os dados das roletas. Por favor, tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRoulettes();
  }, []);
  
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
        lastNumbers={roulette.numeros.length > 0 ? roulette.numeros : roulette._displayNumbers || []}
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