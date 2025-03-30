import { useState, useMemo } from 'react';
import { Search, Wallet, Menu, MessageSquare, AlertCircle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import RouletteCard from '@/components/RouletteCard';
import { Input } from '@/components/ui/input';
import ChatUI from '@/components/ChatUI';
import { Button } from '@/components/ui/button';
import AnimatedInsights from '@/components/AnimatedInsights';
import ProfileDropdown from '@/components/ProfileDropdown';
import Layout from '@/components/Layout';

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
  const [isLoading, setIsLoading] = useState(false);
  
  const filteredRoulettes = mockRoulettes.filter(roulette => roulette.name.toLowerCase().includes(search.toLowerCase()));
  const topRoulettes = useMemo(() => {
    return [...mockRoulettes].sort((a, b) => {
      const aWinRate = a.wins / (a.wins + a.losses) * 100;
      const bWinRate = b.wins / (b.wins + b.losses) * 100;
      return bWinRate - aWinRate;
    }).slice(0, 3);
  }, []);

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
                className="bg-gray-800 text-white rounded-lg pl-10 pr-4 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            </div>
          </div>
        </div>

        {/* Grade de roletas com espaçamento adequado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
          {isLoading ? (
            // Esqueletos de carregamento
            Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-4 h-64 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="w-6 h-6 bg-gray-700 rounded-full"></div>
                  ))}
                </div>
                <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-full mb-4"></div>
                <div className="mt-auto flex justify-between">
                  <div className="h-8 bg-gray-700 rounded w-1/3"></div>
                  <div className="h-8 bg-gray-700 rounded w-1/3"></div>
                </div>
              </div>
            ))
          ) : filteredRoulettes.length > 0 ? (
            filteredRoulettes.map((roleta) => (
              <RouletteCard
                key={roleta.roletaId}
                roletaId={roleta.roletaId}
                roletaNome={roleta.name}
                lastNumbers={roleta.lastNumbers}
                estrategia={roleta.trend.map(t => t.value)}
                trend={roleta.trend}
              />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle size={48} className="text-gray-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Nenhuma roleta encontrada</h3>
              <p className="text-gray-400 max-w-md">
                Não encontramos roletas correspondentes à sua busca. Tente com outros termos ou verifique sua conexão.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Index;