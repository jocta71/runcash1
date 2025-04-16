import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dices, Play, ChevronRight, BarChart3, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

interface WelcomeProps {
  userName?: string;
}

const Welcome: React.FC<WelcomeProps> = ({ userName }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [hasData, setHasData] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Simular verificação de conexão
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Substituir por uma chamada real à API
        const response = await fetch('/api/status');
        setIsConnected(response.ok);
      } catch (error) {
        setIsConnected(false);
      }
    };
    
    checkConnection();
    
    // Verificar status a cada 30 segundos
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Redirecionar para página de estatísticas
  const handleViewStats = () => {
    navigate('/estatisticas');
  };
  
  // Redirecionar para a roleta principal
  const handleGoToRoulette = () => {
    navigate('/roulettes');
  };
  
  // Nome de exibição que usa o userName da prop ou o nome do usuário logado
  const displayName = userName || (user?.username || user?.email?.split('@')[0] || 'jogador');
  
  return (
    <div className="max-w-4xl mx-auto p-6 bg-[#17161e] rounded-xl border border-[#33333359] shadow-lg">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-3">
          Bem-vindo, <span className="text-[#00ff00]">{displayName}</span>!
        </h1>
        <p className="text-gray-400">
          Comece agora sua experiência nos melhores jogos de cassino
        </p>
      </div>
      
      {/* Cards de opções */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#1a1922] rounded-lg p-5 border border-[#33333359] hover:border-[#00ff00]/50 transition-all">
          <div className="flex items-start mb-4">
            <div className="bg-[#00baff]/20 p-3 rounded-lg mr-3">
              <BarChart3 className="h-6 w-6 text-[#00baff]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-1">Estatísticas Detalhadas</h3>
              <p className="text-gray-400 text-sm">Visualize análises completas das roletas e tendências de números</p>
            </div>
          </div>
          
          <Button 
            onClick={handleViewStats}
            className="w-full bg-[#00baff] hover:bg-[#00baff]/80 text-black font-medium"
          >
            Ver Estatísticas <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
        
        <div className="bg-[#1a1922] rounded-lg p-5 border border-[#33333359] hover:border-[#00ff00]/50 transition-all">
          <div className="flex items-start mb-4">
            <div className="bg-[#00ff00]/20 p-3 rounded-lg mr-3">
              <Play className="h-6 w-6 text-[#00ff00]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-1">Jogar Agora</h3>
              <p className="text-gray-400 text-sm">Acesse as roletas em tempo real e comece a jogar imediatamente</p>
            </div>
          </div>
          
          <Button 
            className={`w-full text-black font-medium ${isConnected ? 'animate-pulse-neon' : ''} 
              bg-gradient-to-b from-[#00ff00] to-[#8bff00] hover:from-[#00ff00]/90 hover:to-[#8bff00]/90`}
            onClick={handleGoToRoulette}
          >
            Ir para a Roleta <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
      
      {/* Barra de atalhos */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Button variant="outline" className="border-gray-700 hover:border-[#00ff00]">
          <PieChart size={16} className="mr-2" />
          Estratégias
        </Button>
        
        <Button variant="outline" className="border-gray-700 hover:border-[#00ff00]">
          <Dices size={16} className="mr-2" />
          Histórico
        </Button>
        
        <Button variant="outline" className="border-gray-700 hover:border-[#00ff00]">
          <BarChart3 size={16} className="mr-2" />
          Análises
        </Button>
      </div>
      
      {/* Mensagem de status */}
      {!isConnected && (
        <div className="mt-6 py-2 px-4 bg-amber-900/30 border border-amber-500/50 rounded text-amber-200 text-sm text-center">
          Atenção: A conexão com o servidor está instável. Algumas funcionalidades podem estar limitadas.
        </div>
      )}
    </div>
  );
};

export default Welcome; 