import React from 'react';
import { ArrowUpRight, Award, Clock } from 'lucide-react';

interface ProviderInfo {
  name: string;
  description: string;
  totalRoulettes: number;
  rouletteTypes: string[];
  popularRoulettes: string[];
  advantages: string[];
  averageRTP?: number;
}

const providerData: Record<string, ProviderInfo> = {
  'Evolution': {
    name: 'Evolution Gaming',
    description: 'Líder mundial em jogos de cassino ao vivo, oferecendo roletas de alta qualidade com dealers reais e tecnologia inovadora.',
    totalRoulettes: 12,
    rouletteTypes: ['Ao Vivo', 'Auto', 'VIP', 'Lightning'],
    popularRoulettes: ['Immersive Roulette', 'Lightning Roulette', 'Auto-Roulette'],
    advantages: ['Alta qualidade de vídeo', 'Dealers profissionais', 'Interface intuitiva', 'Múltiplas câmeras'],
    averageRTP: 97.3
  },
  'Playtech': {
    name: 'Playtech',
    description: 'Um dos maiores desenvolvedores de software de jogos, conhecido por suas roletas inovadoras e experiência de jogo fluida.',
    totalRoulettes: 8,
    rouletteTypes: ['Ao Vivo', 'Premium', 'Speed'],
    popularRoulettes: ['Premium Roulette', 'Age of the Gods Roulette', 'Quantum Roulette'],
    advantages: ['Gráficos de alta qualidade', 'Recursos exclusivos', 'Jackpots progressivos'],
    averageRTP: 97.1
  },
  'Pragmatic Play': {
    name: 'Pragmatic Play',
    description: 'Fornecedor em rápido crescimento, oferecendo roletas inovadoras com foco em experiência móvel e usabilidade.',
    totalRoulettes: 6,
    rouletteTypes: ['Ao Vivo', 'Speed', 'Auto'],
    popularRoulettes: ['Mega Roulette', 'Speed Roulette', 'Auto-Roulette'],
    advantages: ['Otimizado para dispositivos móveis', 'Carregamento rápido', 'Interface moderna'],
    averageRTP: 97.5
  },
  'Ezugi': {
    name: 'Ezugi',
    description: 'Especialista em jogos ao vivo, conhecido por roletas adaptadas a mercados locais e opções de apostas flexíveis.',
    totalRoulettes: 5,
    rouletteTypes: ['Ao Vivo', 'Auto', 'VIP'],
    popularRoulettes: ['Speed Roulette', 'Auto Roulette', 'VIP Roulette'],
    advantages: ['Suporte a múltiplos idiomas', 'Personalização por região', 'Streaming de alta qualidade'],
    averageRTP: 97.0
  }
};

interface ProviderInfoCardProps {
  providerName: string;
}

export const ProviderInfoCard: React.FC<ProviderInfoCardProps> = ({ providerName }) => {
  // Obter dados do provedor ou usar um genérico se não encontrado
  const providerInfo = providerData[providerName] || {
    name: providerName,
    description: 'Informações detalhadas sobre este provedor não estão disponíveis.',
    totalRoulettes: 0,
    rouletteTypes: [],
    popularRoulettes: [],
    advantages: []
  };
  
  return (
    <div className="bg-[#1a1922] rounded-xl p-6 border border-white/10">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-white">
          {providerInfo.name}
        </h2>
        <div className="flex items-center text-sm bg-green-600/20 text-green-500 px-2 py-1 rounded">
          <Award className="w-3 h-3 mr-1" /> Provedor verificado
        </div>
      </div>
      
      <p className="text-gray-300 mb-6">
        {providerInfo.description}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#23222e] p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-1">Total de Roletas</div>
          <div className="text-white text-2xl font-bold">{providerInfo.totalRoulettes}</div>
        </div>
        
        <div className="bg-[#23222e] p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-1">Tipos de Roletas</div>
          <div className="text-white font-medium">
            {providerInfo.rouletteTypes.length > 0 
              ? providerInfo.rouletteTypes.join(', ') 
              : 'Não disponível'}
          </div>
        </div>
        
        <div className="bg-[#23222e] p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-1">RTP Médio</div>
          <div className="text-white text-2xl font-bold">
            {providerInfo.averageRTP 
              ? `${providerInfo.averageRTP}%` 
              : 'N/A'}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center">
            <Clock className="w-4 h-4 mr-2 text-green-500" /> 
            Roletas Populares
          </h3>
          
          {providerInfo.popularRoulettes.length > 0 ? (
            <ul className="space-y-2">
              {providerInfo.popularRoulettes.map((roulette, index) => (
                <li key={index} className="bg-[#23222e] p-2 px-3 rounded flex justify-between items-center">
                  <span className="text-white">{roulette}</span>
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Não há informações disponíveis.</p>
          )}
        </div>
        
        <div>
          <h3 className="text-white font-semibold mb-3">Diferenciais</h3>
          
          {providerInfo.advantages.length > 0 ? (
            <ul className="space-y-2">
              {providerInfo.advantages.map((advantage, index) => (
                <li key={index} className="bg-[#23222e] p-2 px-3 rounded text-white">
                  {advantage}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Não há informações disponíveis.</p>
          )}
        </div>
      </div>
    </div>
  );
}; 